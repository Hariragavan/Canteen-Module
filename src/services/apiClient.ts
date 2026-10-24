import type {
  Employee,
  FoodTransportRecord,
  MealFeedback,
  MealSlotConfig,
  Order,
  TransportUnit,
} from '../types';

export interface DbStatusInfo {
  isConnected: boolean;
  readyState: number;
  host: string;
  name: string;
  uri?: string;
  counts?: {
    employees: number;
    orders: number;
    mealSlots: number;
    foodTransports: number;
    feedbacks: number;
  };
}

class ApiClient {
  private baseUrl = '/api';
  private subscribers: Set<() => void> = new Set();
  private pollInterval: number | null = null;

  constructor() {
    this.startPolling();
  }

  // Helper method enforcing no-cache and fresh 200 OK responses
  private async request(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(init.headers || {});
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return fetch(url, {
      ...init,
      cache: 'no-store',
      headers,
    });
  }

  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public notifySubscribers(): void {
    this.subscribers.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.warn('Subscriber callback error:', err);
      }
    });
  }

  private startPolling(): void {
    if (typeof window !== 'undefined' && !this.pollInterval) {
      this.pollInterval = window.setInterval(() => {
        this.notifySubscribers();
      }, 15000);
    }
  }

  // ==========================================================================
  // STATUS / HEALTH
  // ==========================================================================
  public async getDbStatus(): Promise<DbStatusInfo> {
    try {
      const res = await this.request('/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        isConnected: false,
        readyState: 0,
        host: '127.0.0.1',
        name: 'canteen_db (offline/disconnected)',
      };
    }
  }

  // ==========================================================================
  // EMPLOYEES
  // ==========================================================================
  public async getEmployees(): Promise<Employee[]> {
    try {
      const res = await this.request('/employees');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        dept: d.dept,
        role: d.role || (d.dept?.toLowerCase().includes('staff') ? 'Staff' : 'Employee'),
        photo: d.photo_url || '',
        confidence: d.confidence_score ?? 0.98,
        subsidyRate: d.subsidy_rate ?? 1.0,
        face_descriptor: d.face_descriptor || null,
        embedding: d.face_descriptor || null,
      }));
    } catch (e) {
      console.warn('API getEmployees offline, falling back to local state:', e);
      return [];
    }
  }

  public async createEmployee(emp: Partial<Employee>): Promise<Employee | null> {
    try {
      const payload = {
        id: emp.id,
        name: emp.name,
        dept: emp.dept,
        role: emp.role,
        photo_url: emp.photo,
        face_descriptor: emp.face_descriptor || emp.embedding || null,
        confidence_score: emp.confidence ?? 0.98,
        subsidy_rate: emp.subsidyRate ?? 1.0,
      };

      const res = await this.request('/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create employee (HTTP ${res.status})`);
      }

      const created = await res.json();
      this.notifySubscribers();
      return {
        id: created.id,
        name: created.name,
        dept: created.dept,
        role: created.role,
        photo: created.photo_url,
        confidence: created.confidence_score,
        subsidyRate: created.subsidy_rate,
        face_descriptor: created.face_descriptor,
        embedding: created.face_descriptor,
      };
    } catch (err) {
      console.warn('API createEmployee error:', err);
      throw err;
    }
  }

  public async updateEmployee(id: string, emp: Partial<Employee>): Promise<void> {
    try {
      const payload: Record<string, any> = {};
      if (emp.id) payload.id = emp.id;
      if (emp.name) payload.name = emp.name;
      if (emp.dept) payload.dept = emp.dept;
      if (emp.role) payload.role = emp.role;
      if (emp.photo !== undefined) payload.photo_url = emp.photo;
      if (emp.face_descriptor !== undefined) payload.face_descriptor = emp.face_descriptor;
      if (emp.subsidyRate !== undefined) payload.subsidy_rate = emp.subsidyRate;

      const res = await this.request(`/employees/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to update employee (HTTP ${res.status})`);
      }
      this.notifySubscribers();
    } catch (err) {
      console.warn('API updateEmployee error:', err);
      throw err;
    }
  }

  public async deleteEmployee(id: string): Promise<void> {
    try {
      const res = await this.request(`/employees/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.notifySubscribers();
    } catch (err) {
      console.warn('API deleteEmployee error:', err);
      throw err;
    }
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================
  public async getOrders(limit = 3000): Promise<Order[]> {
    try {
      const res = await this.request(`/orders?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map((o: any) => ({
        id: o._id || o.id,
        token: o.token,
        orderUuid: o.orderUuid,
        userId: o.userId,
        name: o.name,
        dept: o.dept,
        meal: o.meal,
        items: o.items || [],
        rate: o.rate ?? 40,
        qty: o.qty ?? 1,
        status: o.status,
        issuedAt: o.issuedAt,
        servedAt: o.servedAt,
        timestamp: o.timestamp,
        dateStr: o.dateStr,
      }));
    } catch (e) {
      console.warn('API getOrders offline:', e);
      return [];
    }
  }

  public async createOrdersBatch(orders: Order[]): Promise<Order[]> {
    try {
      const res = await this.request('/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const inserted = await res.json();
      this.notifySubscribers();
      return inserted.map((o: any) => ({
        id: o._id || o.id,
        token: o.token,
        orderUuid: o.orderUuid,
        userId: o.userId,
        name: o.name,
        dept: o.dept,
        meal: o.meal,
        items: o.items || [],
        rate: o.rate ?? 40,
        qty: o.qty ?? 1,
        status: o.status,
        issuedAt: o.issuedAt,
        servedAt: o.servedAt,
        timestamp: o.timestamp,
        dateStr: o.dateStr,
      }));
    } catch (err) {
      console.warn('API createOrdersBatch error:', err);
      throw err;
    }
  }

  public async serveOrder(orderUuid: string): Promise<any> {
    try {
      const res = await this.request(`/orders/${encodeURIComponent(orderUuid)}/serve`, {
        method: 'PATCH',
      });
      const data = await res.json();
      this.notifySubscribers();
      return data;
    } catch (err) {
      console.warn('API serveOrder error:', err);
      throw err;
    }
  }

  public async cancelOrder(orderUuid: string): Promise<void> {
    try {
      await this.request(`/orders/${encodeURIComponent(orderUuid)}`, {
        method: 'DELETE',
      });
      this.notifySubscribers();
    } catch (err) {
      console.warn('API cancelOrder error:', err);
    }
  }

  // ==========================================================================
  // MEAL SLOTS
  // ==========================================================================
  public async getMealSlots(): Promise<MealSlotConfig[]> {
    try {
      const res = await this.request('/meal-slots');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('API getMealSlots offline:', e);
      return [];
    }
  }

  public async updateMealSlots(slots: MealSlotConfig[]): Promise<MealSlotConfig[]> {
    try {
      const res = await this.request('/meal-slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      this.notifySubscribers();
      return updated;
    } catch (err) {
      console.warn('API updateMealSlots error:', err);
      throw err;
    }
  }

  // ==========================================================================
  // TRANSPORT UNITS
  // ==========================================================================
  public async getTransportUnits(): Promise<TransportUnit[]> {
    try {
      const res = await this.request('/transport-units');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('API getTransportUnits offline:', e);
      return [];
    }
  }

  public async createTransportUnit(unit: TransportUnit): Promise<TransportUnit> {
    try {
      const res = await this.request('/transport-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unit),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      this.notifySubscribers();
      return created;
    } catch (err) {
      console.warn('API createTransportUnit error:', err);
      throw err;
    }
  }

  public async deleteTransportUnit(id: string): Promise<void> {
    try {
      await this.request(`/transport-units/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      this.notifySubscribers();
    } catch (err) {
      console.warn('API deleteTransportUnit error:', err);
    }
  }

  // ==========================================================================
  // FOOD TRANSPORTS
  // ==========================================================================
  public async getFoodTransports(): Promise<FoodTransportRecord[]> {
    try {
      const res = await this.request('/food-transports');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map((t: any) => ({
        id: t._id || t.id,
        unitName: t.unitName,
        mealType: t.mealType,
        menuItems: t.menuItems,
        personCount: t.personCount,
        primaryQuantity: t.primaryQuantity,
        primaryUnit: t.primaryUnit,
        items: t.items || [],
        dispatchDate: t.dispatchDate,
        dispatchTime: t.dispatchTime,
        vehicleOrDriver: t.vehicleOrDriver,
        status: t.status,
        notes: t.notes,
        timestamp: t.timestamp,
        created_at: t.createdAt,
      }));
    } catch (e) {
      console.warn('API getFoodTransports offline:', e);
      return [];
    }
  }

  public async createFoodTransport(record: Partial<FoodTransportRecord>): Promise<FoodTransportRecord> {
    try {
      const res = await this.request('/food-transports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      this.notifySubscribers();
      return created;
    } catch (err) {
      console.warn('API createFoodTransport error:', err);
      throw err;
    }
  }

  public async deleteFoodTransport(id: string): Promise<void> {
    try {
      await this.request(`/food-transports/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      this.notifySubscribers();
    } catch (err) {
      console.warn('API deleteFoodTransport error:', err);
    }
  }

  // ==========================================================================
  // FEEDBACKS
  // ==========================================================================
  public async getFeedbacks(): Promise<MealFeedback[]> {
    try {
      const res = await this.request('/feedbacks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.map((f: any) => ({
        id: f._id || f.id,
        mealSlot: f.mealSlot,
        rating: f.rating,
        comment: f.comment,
        timestamp: f.timestamp,
        dateStr: f.dateStr,
      }));
    } catch (e) {
      console.warn('API getFeedbacks offline:', e);
      return [];
    }
  }

  public async createFeedback(fb: MealFeedback): Promise<MealFeedback> {
    try {
      const res = await this.request('/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fb),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      this.notifySubscribers();
      return created;
    } catch (err) {
      console.warn('API createFeedback error:', err);
      throw err;
    }
  }

  public async deleteFeedback(id: string): Promise<void> {
    try {
      await this.request(`/feedbacks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      this.notifySubscribers();
    } catch (err) {
      console.warn('API deleteFeedback error:', err);
    }
  }
}

export const apiClient = new ApiClient();
