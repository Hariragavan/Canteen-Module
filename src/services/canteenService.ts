import type { Employee, MealSlotConfig, MealSlotName, Order, VerificationResult } from '../types';
import { supabaseManager } from './supabase';

const STORAGE_ORDERS_KEY = 'canteen_local_orders_v3';
const STORAGE_TOKEN_KEY = 'canteen_token_seq_v3';
const STORAGE_EMPLOYEES_KEY = 'canteen_local_employees_v3';

// Standard Canteen Meal Slots matching user sketch: Breakfast, Lunch, Tea & Snacks, Dinner
export const MEAL_SLOTS: MealSlotConfig[] = [
  {
    name: 'Breakfast',
    startTime: '07:30',
    endTime: '10:30',
    displayName: 'Breakfast Special',
    emoji: '🥞',
    category: 'Morning',
    description: 'Steamed Idli, Crispy Medu Vada, Sambar & Filter Coffee',
    calories: 420,
    isEligible: true,
  },
  {
    name: 'Lunch',
    startTime: '12:00',
    endTime: '15:00',
    displayName: 'Executive Lunch Platter',
    emoji: '🍛',
    category: 'Active Now',
    description: 'Paneer Butter Masala, Dal Makhani, Steamed Basmati, Phulka & Sweet',
    calories: 740,
    isEligible: true,
  },
  {
    name: 'Tea & Snacks',
    startTime: '15:30',
    endTime: '18:00',
    displayName: 'Tea & Evening Snacks',
    emoji: '☕',
    category: 'Evening',
    description: 'Hot Cardamom Masala Chai / Filter Coffee with Crispy Samosa & Chutney',
    calories: 380,
    isEligible: true,
  },
  {
    name: 'Dinner',
    startTime: '19:30',
    endTime: '22:00',
    displayName: 'Gourmet Dinner Feast',
    emoji: '🍲',
    category: 'Night Slot',
    description: 'Butter Roti, Dal Tadka, Seasonal Veg Curry, Jeera Rice & Curd',
    calories: 650,
    isEligible: true,
  },
];

export function normalizeDescriptor(val: unknown): number[] | null {
  if (!val) return null;
  if (Array.isArray(val) && val.length === 128) {
    return val.map(Number);
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length === 128) {
        return parsed.map(Number);
      }
      if (typeof parsed === 'object' && parsed !== null) {
        const values = Object.values(parsed).map(Number);
        if (values.length === 128) return values;
      }
    } catch {
      return null;
    }
  }
  if (typeof val === 'object' && val !== null) {
    const values = Object.values(val).map(Number);
    if (values.length === 128) return values;
  }
  return null;
}

// Clean Slate: Empty initial employees so admin can register new users
export const INITIAL_EMPLOYEES: Employee[] = [];

class CanteenService {
  private employees: Employee[] = [];
  private orders: Order[] = [];
  private tokenSeq: number = 150;
  private isLoaded: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isLoaded) return;
    try {
      const storedOrders = localStorage.getItem(STORAGE_ORDERS_KEY);
      const storedSeq = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedEmployees = localStorage.getItem(STORAGE_EMPLOYEES_KEY);

      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      } else {
        this.seedDefaultOrders();
      }

      if (storedEmployees) {
        // Normalize any legacy department names to strictly 'Staff' or 'Employee'
        this.employees = JSON.parse(storedEmployees).map((emp: Employee) => {
          const isStaff = emp.dept?.toLowerCase().includes('staff') || emp.role === 'Staff';
          const descriptor = normalizeDescriptor(emp.face_descriptor || emp.embedding);
          return {
            ...emp,
            dept: isStaff ? 'Staff' : 'Employee',
            role: isStaff ? 'Staff' : 'Employee',
            face_descriptor: descriptor,
            embedding: descriptor,
          };
        });
        this.saveEmployeesLocal();
      } else {
        this.employees = [...INITIAL_EMPLOYEES];
        this.saveEmployeesLocal();
      }

      if (storedSeq) {
        this.tokenSeq = parseInt(storedSeq, 10) || 101;
      }
      this.isLoaded = true;
      // Also try syncing from remote Supabase tables if connected
      this.syncFromSupabase().catch(() => {});
    } catch (e) {
      console.warn('Failed loading local canteen data:', e);
      this.orders = [];
      this.employees = [];
    }
  }

  private saveEmployeesLocal() {
    try {
      localStorage.setItem(STORAGE_EMPLOYEES_KEY, JSON.stringify(this.employees));
    } catch (e) {
      console.warn('Failed saving employees to localStorage:', e);
    }
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(this.orders));
      localStorage.setItem(STORAGE_TOKEN_KEY, String(this.tokenSeq));
    } catch (e) {
      console.warn('Failed saving orders to localStorage:', e);
    }
  }

  private seedDefaultOrders() {
    this.orders = [];
    this.tokenSeq = 101;
    this.saveLocal();
  }

  /**
   * Synchronize live data from separate Supabase tables: canteen_employees & canteen_orders
   */
  public async syncFromSupabase(): Promise<void> {
    const client = supabaseManager.getClient();
    if (!client) return;

    try {
      // 1. Fetch remote employees
      const { data: remoteEmployees, error: empErr } = await client
        .from('canteen_employees')
        .select('*');

      if (!empErr && remoteEmployees) {
        const remoteList: Employee[] = remoteEmployees.map((rem: any) => {
          const descriptor = normalizeDescriptor(rem.face_descriptor);
          return {
            id: rem.id,
            name: rem.name,
            dept: rem.dept,
            photo: rem.photo_url,
            confidence: rem.confidence_score ?? 0.98,
            subsidyRate: rem.subsidy_rate ?? 1.0,
            role: rem.role || (rem.dept?.toLowerCase().includes('staff') ? 'Staff' : 'Employee'),
            face_descriptor: descriptor,
            embedding: descriptor,
          };
        });

        // Two-way synchronization: If local storage has employees not yet in Supabase, auto-upload them!
        const remoteIds = new Set(remoteList.map((r) => r.id.toLowerCase()));
        const missingFromRemote = this.employees.filter((loc) => !remoteIds.has(loc.id.toLowerCase()));

        for (const loc of missingFromRemote) {
          try {
            const { error: insErr } = await client.from('canteen_employees').insert({
              id: loc.id,
              name: loc.name,
              dept: loc.dept,
              photo_url: loc.photo,
              confidence_score: loc.confidence,
              subsidy_rate: loc.subsidyRate,
              role: loc.role,
              face_descriptor: loc.face_descriptor || loc.embedding || null,
            });
            if (!insErr) {
              remoteList.unshift(loc);
            } else {
              console.warn('Auto-upload local employee error:', insErr);
            }
          } catch (e) {
            console.warn('Failed auto-uploading local employee to Supabase:', e);
          }
        }

        this.employees = remoteList;
        this.saveEmployeesLocal();
        supabaseManager.broadcastChange('canteen_employees', 'UPDATE', this.employees);
      }

      // 2. Fetch remote orders for today
      const today = new Date().toISOString().slice(0, 10);
      const { data: remoteOrders, error: ordErr } = await client
        .from('canteen_orders')
        .select('*')
        .eq('order_date', today)
        .order('token_number', { ascending: true });

      if (!ordErr && remoteOrders && remoteOrders.length > 0) {
        this.orders = remoteOrders.map((rem: any) => ({
          id: rem.id,
          token: rem.token_number,
          orderUuid: rem.order_uuid,
          userId: rem.user_id,
          name: rem.user_name,
          dept: rem.department,
          meal: rem.meal_slot,
          items: rem.items || [],
          status: rem.status,
          issuedAt: rem.issued_at && rem.issued_at.includes('T') ? new Date(rem.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rem.issued_at || ''),
          servedAt: rem.served_at && rem.served_at.includes('T') ? new Date(rem.served_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rem.served_at || null),
          timestamp: rem.created_at ? new Date(rem.created_at).getTime() : Date.now(),
          dateStr: rem.order_date,
        }));
        const maxToken = Math.max(...this.orders.map((o) => o.token));
        if (maxToken >= 100) {
          this.tokenSeq = maxToken + 1;
        }
        this.saveLocal();
        supabaseManager.broadcastChange('canteen_orders', 'UPDATE', this.orders);
      }
    } catch (err) {
      console.warn('Sync from Supabase fallback:', err);
    }
  }

  public getEmployees(): Employee[] {
    return [...this.employees];
  }

  public async addEmployee(emp: Employee): Promise<void> {
    const existingIndex = this.employees.findIndex((e) => e.id.toLowerCase() === emp.id.toLowerCase());
    if (existingIndex >= 0) {
      throw new Error(`User with ID ${emp.id} already exists.`);
    }

    const descriptor = emp.face_descriptor || emp.embedding || null;
    const cleanEmp: Employee = {
      ...emp,
      face_descriptor: descriptor,
      embedding: descriptor,
    };

    // Sync to Supabase if connected
    const client = supabaseManager.getClient();
    if (client) {
      const { error } = await client.from('canteen_employees').insert({
        id: cleanEmp.id,
        name: cleanEmp.name,
        dept: cleanEmp.dept,
        photo_url: cleanEmp.photo,
        confidence_score: cleanEmp.confidence,
        subsidy_rate: cleanEmp.subsidyRate,
        role: cleanEmp.role,
        face_descriptor: descriptor,
      });
      if (error) {
        console.error('Supabase employee insert error:', error);
        throw new Error(`Database error: ${error.message}`);
      }
    }

    this.employees.unshift(cleanEmp);
    this.saveEmployeesLocal();
    supabaseManager.broadcastChange('canteen_employees', 'INSERT', cleanEmp);
  }

  public async updateEmployee(id: string, updated: Partial<Employee>): Promise<void> {
    const index = this.employees.findIndex((e) => e.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }

    if (updated.id && updated.id !== id) {
      const duplicateIndex = this.employees.findIndex(
        (e) => e.id.toLowerCase() === updated.id!.toLowerCase() && e.id !== id
      );
      if (duplicateIndex >= 0) {
        throw new Error(`User with ID ${updated.id} already exists.`);
      }
    }

    this.employees[index] = { ...this.employees[index], ...updated };
    this.saveEmployeesLocal();
    supabaseManager.broadcastChange('canteen_employees', 'UPDATE', this.employees[index]);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        const toUpdate: Record<string, unknown> = {};
        if (updated.id) toUpdate.id = updated.id;
        if (updated.name) toUpdate.name = updated.name;
        if (updated.dept) toUpdate.dept = updated.dept;
        if (updated.photo) toUpdate.photo_url = updated.photo;
        if (updated.role) toUpdate.role = updated.role;
        if (updated.subsidyRate !== undefined) toUpdate.subsidy_rate = updated.subsidyRate;
        if (updated.face_descriptor !== undefined || updated.embedding !== undefined) {
          toUpdate.face_descriptor = updated.face_descriptor || updated.embedding || null;
        }

        await client.from('canteen_employees').update(toUpdate).eq('id', id);
      } catch (err) {
        console.warn('Supabase remote employee update fallback:', err);
      }
    }
  }

  public async deleteEmployee(id: string): Promise<void> {
    const index = this.employees.findIndex((e) => e.id === id);
    if (index === -1) return;

    const removed = this.employees.splice(index, 1)[0];
    this.saveEmployeesLocal();
    supabaseManager.broadcastChange('canteen_employees', 'DELETE', removed);

    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client.from('canteen_employees').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase remote employee delete fallback:', err);
      }
    }
  }

  public getOrders(): Order[] {
    return [...this.orders];
  }

  /**
   * Determine active meal slot based on current 24h clock
   */
  public getActiveMealSlot(): MealSlotName {
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    // Breakfast: 07:30 (450) to 10:30 (630)
    if (curMinutes >= 450 && curMinutes <= 630) return 'Breakfast';
    // Lunch: 12:00 (720) to 15:00 (900)
    if (curMinutes >= 720 && curMinutes <= 900) return 'Lunch';
    // Tea & Snacks: 15:30 (930) to 18:00 (1080)
    if (curMinutes >= 930 && curMinutes <= 1080) return 'Tea & Snacks';
    // Dinner: 19:30 (1170) to 22:00 (1320)
    if (curMinutes >= 1170 && curMinutes <= 1320) return 'Dinner';

    // Default to Lunch for daytime simulation or closest
    return 'Lunch';
  }

  /**
   * Duplicate Order Prevention: Checks if this user has already booked this slot today
   */
  public checkDuplicateBooking(userId: string, meal: MealSlotName): Order | undefined {
    const today = new Date().toISOString().slice(0, 10);
    return this.orders.find(o => 
      o.userId === userId && 
      o.meal.toLowerCase() === meal.toLowerCase() && 
      o.dateStr === today
    );
  }

  /**
   * Creates new order, assigns incremental daily token, saves to store and Supabase
   */
  public async createOrder(employee: Employee, meal: MealSlotName, items: any[] = []): Promise<Order> {
    // 1. Guard against duplicate booking
    const existing = this.checkDuplicateBooking(employee.id, meal);
    if (existing) {
      throw new Error(`Duplicate Lock: ${meal} already issued for ${employee.name} at ${existing.issuedAt}`);
    }

    let tokenNo = this.tokenSeq++;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);
    let orderUuid = `ORD-${Date.now().toString(36).toUpperCase()}-${tokenNo}`;

    // Sync to Supabase if connected (Supabase trigger set_daily_token_number generates atomic token)
    const client = supabaseManager.getClient();
    if (client) {
      try {
        const { data: inserted, error } = await client.from('canteen_orders').insert({
          user_id: employee.id,
          user_name: employee.name,
          department: employee.dept,
          meal_slot: meal,
          items: items || [],
          status: 'PRINTED',
          issued_at: new Date().toISOString(),
          order_date: dateStr,
        }).select().single();

        if (!error && inserted) {
          if (inserted.token_number) tokenNo = inserted.token_number;
          if (inserted.order_uuid) orderUuid = inserted.order_uuid;
        }
      } catch (err) {
        console.warn('Supabase remote insert fallback:', err);
      }
    }

    const newOrder: Order = {
      id: orderUuid.toLowerCase(),
      token: tokenNo,
      orderUuid,
      userId: employee.id,
      name: employee.name,
      dept: employee.dept,
      meal,
      items: items || [],
      status: 'PRINTED',
      issuedAt: timeStr,
      servedAt: null,
      timestamp: now.getTime(),
      dateStr,
    };

    // Save locally
    this.orders.unshift(newOrder);
    this.saveLocal();

    // Broadcast change
    supabaseManager.broadcastChange('canteen_orders', 'INSERT', newOrder);

    return newOrder;
  }

  /**
   * Food Counter Verification (2D Barcode Scanner / Manual)
   */
  public async verifyAndServe(rawQuery: string): Promise<VerificationResult> {
    const query = rawQuery.trim();
    if (!query) {
      return { type: 'INVALID_TOKEN', message: 'Empty scan payload' };
    }

    // Match by exact orderUuid, pure token number, or substring
    const order = this.orders.find(o => 
      o.orderUuid.toUpperCase() === query.toUpperCase() ||
      String(o.token) === query ||
      query.toUpperCase().includes(o.orderUuid.toUpperCase())
    );

    if (!order) {
      return {
        type: 'INVALID_TOKEN',
        message: `Token "${query}" does not exist in the active canteen ledger.`,
      };
    }

    // Check if already claimed / served
    if (order.status === 'SERVED') {
      return {
        type: 'DUPLICATE_CLAIM',
        order,
        message: `SECURITY ALERT: This meal was already claimed at ${order.servedAt}!`,
        previousServedTime: order.servedAt || 'Earlier today',
      };
    }

    // Valid & Unclaimed: Mark as served
    const now = new Date();
    const servedTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    order.status = 'SERVED';
    order.servedAt = servedTimeStr;

    this.saveLocal();
    supabaseManager.broadcastChange('canteen_orders', 'UPDATE', order);

    // Sync update to Supabase
    const client = supabaseManager.getClient();
    if (client) {
      try {
        await client
          .from('canteen_orders')
          .update({ status: 'SERVED', served_at: new Date().toISOString() })
          .eq('order_uuid', order.orderUuid);
      } catch (err) {
        console.warn('Supabase remote update fallback:', err);
      }
    }

    return {
      type: 'SUCCESS',
      order,
      scanTime: servedTimeStr,
      message: 'ORDER VERIFIED & DISPENSED',
    };
  }

  /**
   * Simulate peak rush by issuing and claiming 5 rapid orders
   */
  public simulatePeakRush(): void {
    const rushEmployees = [
      { id: 'EMP-1006', name: 'Sneha Patil', dept: 'Electronics & Comm' },
      { id: 'EMP-1007', name: 'Varun Nair', dept: 'Mechanical Engineering' },
      { id: 'EMP-1008', name: 'Megha Iyer', dept: 'Administration & HR' },
      { id: 'EMP-1009', name: 'Ashwin Kumar', dept: 'Computer Science & Engg' },
      { id: 'EMP-1010', name: 'Ananya Roy', dept: 'Electronics & Comm' },
    ];

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    rushEmployees.forEach((emp, i) => {
      const token = this.tokenSeq++;
      const timeMs = now.getTime() - (rushEmployees.length - i) * 25000;
      const timeDate = new Date(timeMs);
      const isServed = i < 3; // First 3 are served, last 2 in queue

      const newOrder: Order = {
        id: `ord-rush-${token}`,
        token,
        orderUuid: `ORD-RUSH-${token}`,
        userId: emp.id,
        name: emp.name,
        dept: emp.dept,
        meal: 'Lunch',
        status: isServed ? 'SERVED' : 'PRINTED',
        issuedAt: timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        servedAt: isServed ? new Date(timeMs + 35000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        timestamp: timeMs,
        dateStr,
      };

      this.orders.unshift(newOrder);
    });

    this.saveLocal();
    supabaseManager.broadcastChange('canteen_orders', 'INSERT', { type: 'RUSH_SIMULATION' });
  }

  public resetAllData(): void {
    this.seedDefaultOrders();
    this.employees = [...INITIAL_EMPLOYEES];
    this.saveEmployeesLocal();
    supabaseManager.broadcastChange('canteen_orders', 'DELETE', { type: 'RESET' });
    supabaseManager.broadcastChange('canteen_employees', 'DELETE', { type: 'RESET' });
  }

  public exportAuditCSV(): void {
    if (this.orders.length === 0) return;

    const headers = [
      'Token Number',
      'Order UUID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Meal Slot',
      'Status',
      'Issued Time',
      'Served Time',
      'Date',
    ];

    const rows = this.orders.map(o => [
      o.token,
      `"${o.orderUuid}"`,
      `"${o.userId}"`,
      `"${o.name}"`,
      `"${o.dept}"`,
      `"${o.meal}"`,
      o.status,
      `"${o.issuedAt}"`,
      `"${o.servedAt || ''}"`,
      `"${o.dateStr}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Canteen_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const canteenService = new CanteenService();
