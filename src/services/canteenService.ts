import type {
  Employee,
  MealFeedback,
  MealSlotConfig,
  MealSlotName,
  Order,
  VerificationResult,
  TransportUnit,
  FoodTransportRecord,
} from '../types';
import { apiClient } from './apiClient';
import { exportOrdersToCSV, exportOrdersToExcel, exportOrdersToPDF } from './reportExportService';

const STORAGE_ORDERS_KEY = 'canteen_local_orders_v3';
const STORAGE_TOKEN_KEY = 'canteen_token_seq_v3';
const STORAGE_EMPLOYEES_KEY = 'canteen_local_employees_v3';
const STORAGE_MEAL_SLOTS_KEY = 'canteen_custom_menu_slots_permanent';
const STORAGE_FEEDBACK_KEY = 'canteen_customer_feedbacks_v1';
const STORAGE_DELETED_EMPLOYEES_KEY = 'canteen_deleted_employees_tombstone_v1';
const STORAGE_TRANSPORT_UNITS_KEY = 'canteen_transport_units_v1';
const STORAGE_FOOD_TRANSPORT_KEY = 'canteen_food_transport_records_v1';
export const HARD_PURGED_USER_IDS = new Set<string>(['1212', '1234']);

export const DEFAULT_TRANSPORT_UNITS: TransportUnit[] = [
  { id: 'UNIT-1', name: 'Unit 1 - Spinning Division', location: 'Block A, North Wing', contactPerson: 'Suresh Kumar' },
  { id: 'UNIT-2', name: 'Unit 2 - Weaving Division', location: 'Block B, Main Plant', contactPerson: 'Murugan R' },
  { id: 'UNIT-3', name: 'Unit 3 - Processing & Dyeing', location: 'Industrial Sector 4', contactPerson: 'Anand P' },
  { id: 'UNIT-4', name: 'Unit 4 - Garments & Packing', location: 'South Campus Gate 2', contactPerson: 'Karthik S' },
  { id: 'UNIT-HQ', name: 'Admin Block & Executive Office', location: 'Central Headquarters', contactPerson: 'HR Frontdesk' },
];

export const DEFAULT_MEAL_SLOTS: MealSlotConfig[] = [
  {
    name: 'Tiffin',
    startTime: '07:30',
    endTime: '11:00',
    displayName: 'Tiffin',
    tamilDisplayName: 'காலை உணவு',
    emoji: '🥞',
    category: 'Morning',
    description: '',
    rate: 40,
    cost: 40,
    isEligible: true,
    isActive: true,
  },
  {
    name: 'Lunch',
    startTime: '12:00',
    endTime: '15:30',
    displayName: 'Lunch',
    tamilDisplayName: 'மதிய உணவு',
    emoji: '🍛',
    category: 'Active Now',
    description: '',
    rate: 40,
    cost: 40,
    isEligible: true,
    isActive: true,
  },
  {
    name: 'Tea/Snacks',
    startTime: '15:30',
    endTime: '18:30',
    displayName: 'Tea/Snacks',
    tamilDisplayName: 'தேநீர் & ஸ்நாக்ஸ்',
    emoji: '☕',
    category: 'Evening',
    description: '',
    rate: 20,
    cost: 20,
    isEligible: true,
    isActive: true,
  },
];

export const MEAL_SLOTS: MealSlotConfig[] = DEFAULT_MEAL_SLOTS;

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

export const INITIAL_EMPLOYEES: Employee[] = [];

export const isStaleDummyDescription = (desc?: string): boolean => {
  if (!desc) return false;
  const d = desc.toLowerCase().trim();
  return (
    d.includes('steamed idli, crispy medu vada') ||
    d.includes('executive lunch platter') ||
    d.includes('executive meals, basmati rice') ||
    d.includes('special masala tea, filter coffee, hot samosa') ||
    d.includes('complete south indian veg thali') ||
    d.includes('special masala chai & hot snacks')
  );
};

class CanteenService {
  private employees: Employee[] = [];
  private orders: Order[] = [];
  private mealSlots: MealSlotConfig[] = [...DEFAULT_MEAL_SLOTS];
  private transportUnits: TransportUnit[] = [...DEFAULT_TRANSPORT_UNITS];
  private foodTransports: FoodTransportRecord[] = [];
  private feedbacks: MealFeedback[] = [];
  private tokenSeq: number = 101;
  private isLoaded: boolean = false;

  constructor() {
    this.init();
  }

  public getDeletedEmployeeIds(): Set<string> {
    const s = new Set<string>(['1212', '1234']);
    try {
      const raw = localStorage.getItem(STORAGE_DELETED_EMPLOYEES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id: string) => s.add(String(id).trim().toLowerCase()));
        }
      }
    } catch {}
    return s;
  }

  public addDeletedEmployeeId(id: string) {
    const s = this.getDeletedEmployeeIds();
    s.add(String(id).trim().toLowerCase());
    try {
      localStorage.setItem(STORAGE_DELETED_EMPLOYEES_KEY, JSON.stringify(Array.from(s)));
    } catch {}
  }

  public removeDeletedEmployeeId(id: string) {
    const s = this.getDeletedEmployeeIds();
    s.delete(String(id).trim().toLowerCase());
    try {
      localStorage.setItem(STORAGE_DELETED_EMPLOYEES_KEY, JSON.stringify(Array.from(s)));
    } catch {}
  }

  public isDeletedOrSystemId(id: string): boolean {
    if (!id) return true;
    const clean = String(id).trim().toLowerCase();
    if (clean.startsWith('__system_')) return true;
    if (HARD_PURGED_USER_IDS.has(clean)) return true;
    if (this.getDeletedEmployeeIds().has(clean)) return true;
    return false;
  }

  private init() {
    if (this.isLoaded) return;
    try {
      const storedOrders = localStorage.getItem(STORAGE_ORDERS_KEY);
      const storedSeq = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedEmployees = localStorage.getItem(STORAGE_EMPLOYEES_KEY);
      const rawSlots = localStorage.getItem(STORAGE_MEAL_SLOTS_KEY);

      if (rawSlots) {
        try {
          const parsed = JSON.parse(rawSlots);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.mealSlots = parsed;
          }
        } catch {
          this.mealSlots = [...DEFAULT_MEAL_SLOTS];
        }
      }

      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      } else {
        this.seedDefaultOrders();
      }

      if (storedEmployees) {
        this.employees = JSON.parse(storedEmployees)
          .filter((emp: any) => !this.isDeletedOrSystemId(emp.id))
          .map((emp: Employee) => ({
            ...emp,
            face_descriptor: normalizeDescriptor(emp.face_descriptor || emp.embedding),
            embedding: normalizeDescriptor(emp.face_descriptor || emp.embedding),
          }));
      } else {
        this.employees = [...INITIAL_EMPLOYEES];
      }

      if (storedSeq) {
        this.tokenSeq = parseInt(storedSeq, 10) || 101;
      }

      const storedUnits = localStorage.getItem(STORAGE_TRANSPORT_UNITS_KEY);
      if (storedUnits) {
        try {
          this.transportUnits = JSON.parse(storedUnits);
        } catch {
          this.transportUnits = [...DEFAULT_TRANSPORT_UNITS];
        }
      }

      const storedTransports = localStorage.getItem(STORAGE_FOOD_TRANSPORT_KEY);
      if (storedTransports) {
        try {
          this.foodTransports = JSON.parse(storedTransports);
        } catch {
          this.foodTransports = [];
        }
      }

      const storedFeedbacks = localStorage.getItem(STORAGE_FEEDBACK_KEY);
      if (storedFeedbacks) {
        try {
          this.feedbacks = JSON.parse(storedFeedbacks);
        } catch {
          this.feedbacks = [];
        }
      }

      this.isLoaded = true;

      // Subscribe to backend updates
      apiClient.subscribe(() => {
        this.syncFromDatabase().catch(() => {});
      });

      // Sync immediately with backend
      this.syncFromDatabase().catch(() => {});

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.syncFromDatabase().catch(() => {});
        });
      }
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

  private saveTransportUnitsLocal() {
    try {
      localStorage.setItem(STORAGE_TRANSPORT_UNITS_KEY, JSON.stringify(this.transportUnits));
    } catch (e) {
      console.warn('Failed saving transport units to localStorage:', e);
    }
  }

  private saveFoodTransportsLocal() {
    try {
      localStorage.setItem(STORAGE_FOOD_TRANSPORT_KEY, JSON.stringify(this.foodTransports));
    } catch (e) {
      console.warn('Failed saving food transports to localStorage:', e);
    }
  }

  private saveFeedbacksLocal() {
    try {
      localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(this.feedbacks));
    } catch (e) {
      console.warn('Failed saving feedbacks to localStorage:', e);
    }
  }

  private seedDefaultOrders() {
    this.orders = [];
    this.tokenSeq = 101;
    this.saveLocal();
  }

  public applyRemoteMenuSlots(remoteSlots: MealSlotConfig[]): void {
    if (!Array.isArray(remoteSlots) || remoteSlots.length === 0) return;
    this.mealSlots = remoteSlots;
    this.saveMealSlotsLocal();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: this.mealSlots }));
    }
  }

  /**
   * Synchronize data with MongoDB backend
   */
  public async syncFromDatabase(): Promise<void> {
    try {
      // 1. Fetch remote employees
      const remoteEmps = await apiClient.getEmployees();
      if (Array.isArray(remoteEmps) && remoteEmps.length > 0) {
        this.employees = remoteEmps.filter((e) => !this.isDeletedOrSystemId(e.id));
        this.saveEmployeesLocal();
      }

      // 2. Fetch remote orders
      const remoteOrders = await apiClient.getOrders();
      if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
        const orderMap = new Map<string, Order>();
        this.orders.forEach((o) => orderMap.set((o.orderUuid || o.id).toLowerCase(), o));
        remoteOrders.forEach((o) => orderMap.set((o.orderUuid || o.id).toLowerCase(), o));
        this.orders = Array.from(orderMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const today = new Date().toISOString().slice(0, 10);
        const todayTokens = this.orders.filter((o) => o.dateStr === today).map((o) => o.token);
        const maxTodayToken = todayTokens.length > 0 ? Math.max(...todayTokens) : 100;
        if (maxTodayToken >= 100) {
          this.tokenSeq = maxTodayToken + 1;
        }
        this.saveLocal();
      }

      // 3. Fetch remote meal slots
      const remoteSlots = await apiClient.getMealSlots();
      if (Array.isArray(remoteSlots) && remoteSlots.length > 0) {
        this.applyRemoteMenuSlots(remoteSlots);
      }

      // 4. Fetch transport units
      const remoteUnits = await apiClient.getTransportUnits();
      if (Array.isArray(remoteUnits) && remoteUnits.length > 0) {
        this.transportUnits = remoteUnits;
        this.saveTransportUnitsLocal();
      }

      // 5. Fetch food transports
      const remoteTrans = await apiClient.getFoodTransports();
      if (Array.isArray(remoteTrans) && remoteTrans.length > 0) {
        this.foodTransports = remoteTrans;
        this.saveFoodTransportsLocal();
      }

      // 6. Fetch feedbacks
      const remoteFbs = await apiClient.getFeedbacks();
      if (Array.isArray(remoteFbs) && remoteFbs.length > 0) {
        this.feedbacks = remoteFbs;
        this.saveFeedbacksLocal();
      }
    } catch (err) {
      console.warn('syncFromDatabase warning:', err);
    }
  }

  // Alias for backward compatibility
  public async syncFromSupabase(): Promise<void> {
    return this.syncFromDatabase();
  }

  public getEmployees(): Employee[] {
    return this.employees.filter((e) => !this.isDeletedOrSystemId(e.id));
  }

  public async addEmployee(emp: Employee): Promise<void> {
    const targetId = String(emp.id).trim().toUpperCase();
    this.removeDeletedEmployeeId(emp.id);

    const existingIndex = this.employees.findIndex((e) => String(e.id).trim().toUpperCase() === targetId);
    if (existingIndex >= 0) {
      throw new Error(`User with ID ${emp.id} already exists.`);
    }

    const cleanEmp: Employee = {
      ...emp,
      id: targetId,
      face_descriptor: emp.face_descriptor || emp.embedding || null,
      embedding: emp.face_descriptor || emp.embedding || null,
    };

    // Save to MongoDB backend
    try {
      await apiClient.createEmployee(cleanEmp);
    } catch (err) {
      console.warn('Backend employee creation warning:', err);
    }

    this.employees.unshift(cleanEmp);
    this.saveEmployeesLocal();
  }

  public async updateEmployee(id: string, updated: Partial<Employee>): Promise<void> {
    const targetId = String(id).trim().toUpperCase();
    const index = this.employees.findIndex((e) => String(e.id).trim().toUpperCase() === targetId);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }

    this.employees[index] = { ...this.employees[index], ...updated };
    this.saveEmployeesLocal();

    try {
      await apiClient.updateEmployee(id, updated);
    } catch (err) {
      console.warn('Backend employee update warning:', err);
    }
  }

  public async deleteEmployee(id: string): Promise<void> {
    const targetId = String(id).trim().toUpperCase();
    this.addDeletedEmployeeId(id);

    this.employees = this.employees.filter((e) => String(e.id).trim().toUpperCase() !== targetId);
    this.saveEmployeesLocal();

    try {
      await apiClient.deleteEmployee(id);
    } catch (err) {
      console.warn('Backend employee delete warning:', err);
    }
  }

  public getOrders(): Order[] {
    return [...this.orders];
  }

  public getOrdersByDate(dateStr: string): Order[] {
    return this.orders.filter((o) => o.dateStr === dateStr);
  }

  public getMealSlots(): MealSlotConfig[] {
    return [...this.mealSlots];
  }

  public saveMealSlotsLocal(): void {
    try {
      localStorage.setItem(STORAGE_MEAL_SLOTS_KEY, JSON.stringify(this.mealSlots));
    } catch (e) {
      console.warn('Failed saving meal slots to localStorage:', e);
    }
  }

  public async updateMealSlots(newSlots: MealSlotConfig[]): Promise<void> {
    this.applyRemoteMenuSlots(newSlots);

    try {
      await apiClient.updateMealSlots(this.mealSlots);
    } catch (e) {
      console.warn('Failed saving meal slots to backend:', e);
    }
  }

  public getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public getEmployeeMealTokensCountToday(userId: string, meal: MealSlotName): number {
    const today = this.getTodayDateString();
    const userOrdersToday = this.orders.filter(
      (o) =>
        o.userId === userId &&
        (o.meal === meal ||
          (meal === 'Tiffin' && (o.meal === 'Tiffin' || o.meal === 'Breakfast')) ||
          (meal === 'Tea/Snacks' &&
            (o.meal === 'Tea/Snacks' || o.meal === 'Snacks' || (o.meal as string) === 'Tea' || o.meal === 'Tea or Coffee'))) &&
        o.dateStr === today &&
        o.status !== 'CANCELLED'
    );
    return userOrdersToday.reduce((sum, o) => sum + (o.qty ?? 1), 0);
  }

  public getActiveMealSlot(): MealSlotName {
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const activeSlots = this.mealSlots.filter((s) => s.isActive !== false);
    for (const slot of activeSlots) {
      const [startH, startM] = (slot.startTime || '00:00').split(':').map(Number);
      const [endH, endM] = (slot.endTime || '23:59').split(':').map(Number);
      const startMin = (startH || 0) * 60 + (startM || 0);
      const endMin = (endH || 0) * 60 + (endM || 0);

      if (curMinutes >= startMin && curMinutes <= endMin) {
        return slot.name;
      }
    }

    return activeSlots[0]?.name || 'Lunch';
  }

  public checkDuplicateBooking(userId: string, meal: MealSlotName): Order | undefined {
    if (meal.toLowerCase() !== 'lunch') {
      return undefined;
    }
    const today = new Date().toISOString().slice(0, 10);
    return this.orders.find(
      (o) =>
        o.userId === userId &&
        o.meal.toLowerCase() === 'lunch' &&
        o.dateStr === today &&
        o.status !== 'CANCELLED'
    );
  }

  public async createOrdersBatch(
    employee: Employee,
    meal: MealSlotName,
    items: any[] = [],
    qty: number = 1,
    rate?: number
  ): Promise<Order[]> {
    const existing = this.checkDuplicateBooking(employee.id, meal);
    if (existing) {
      throw new Error(`Duplicate Lock: ${meal} already issued for ${employee.name} at ${existing.issuedAt}`);
    }

    const count = Math.max(1, Math.min(10, qty || 1));

    if (meal.toLowerCase() !== 'lunch') {
      const alreadyTaken = this.getEmployeeMealTokensCountToday(employee.id, meal);
      if (alreadyTaken + count > 10) {
        const remaining = Math.max(0, 10 - alreadyTaken);
        throw new Error(
          `Daily Limit Exceeded: Maximum 10 tokens per day for ${meal}. You have already taken ${alreadyTaken}, only ${remaining} remaining today.`
        );
      }
    }
    const configuredSlot = this.getMealSlots().find((s) => s.name === meal);
    const resolvedRate =
      rate !== undefined && rate !== null ? rate : (configuredSlot?.rate ?? configuredSlot?.cost ?? 40);

    const createdOrders: Order[] = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);

    for (let i = 0; i < count; i++) {
      const tokenNo = this.tokenSeq++;
      const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderUuid = `ORD-${Date.now().toString(36).toUpperCase()}-${tokenNo}-${uniqueSuffix}`;

      const newOrder: Order = {
        id: orderUuid.toLowerCase(),
        token: tokenNo,
        orderUuid,
        userId: employee.id,
        name: employee.name,
        dept: employee.dept,
        meal,
        items: items || [],
        rate: resolvedRate,
        qty: 1,
        status: 'PRINTED',
        issuedAt: timeStr,
        servedAt: null,
        timestamp: now.getTime() + i,
        dateStr,
      };

      createdOrders.push(newOrder);
      this.orders.unshift(newOrder);
    }

    this.saveLocal();

    // Async sync to MongoDB backend
    try {
      await apiClient.createOrdersBatch(createdOrders);
    } catch (e) {
      console.warn('Backend createOrdersBatch warning:', e);
    }

    return createdOrders;
  }

  public async createOrder(
    employee: Employee,
    meal: MealSlotName,
    items: any[] = [],
    qty: number = 1,
    rate?: number
  ): Promise<Order> {
    const orders = await this.createOrdersBatch(employee, meal, items, qty, rate);
    return orders[0];
  }

  public async verifyAndServe(rawQuery: string): Promise<VerificationResult> {
    const query = rawQuery.trim();
    if (!query) {
      return { type: 'INVALID_TOKEN', message: 'Empty scan payload' };
    }

    const order = this.orders.find(
      (o) =>
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

    if (order.status === 'SERVED') {
      return {
        type: 'DUPLICATE_CLAIM',
        order,
        message: `SECURITY ALERT: This meal was already claimed at ${order.servedAt}!`,
        previousServedTime: order.servedAt || 'Earlier today',
      };
    }

    const now = new Date();
    const servedTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    order.status = 'SERVED';
    order.servedAt = servedTimeStr;

    this.saveLocal();

    try {
      await apiClient.serveOrder(order.orderUuid);
    } catch (err) {
      console.warn('Backend serveOrder warning:', err);
    }

    return {
      type: 'SUCCESS',
      order,
      scanTime: servedTimeStr,
      message: 'ORDER VERIFIED & DISPENSED',
    };
  }

  public async resetOrder(orderUuidOrId: string): Promise<boolean> {
    const target = this.orders.find(
      (o) => o.orderUuid === orderUuidOrId || o.id === orderUuidOrId || String(o.token) === orderUuidOrId
    );
    if (!target) return false;

    this.orders = this.orders.filter(
      (o) => o.orderUuid !== target.orderUuid && o.id !== target.id
    );
    this.saveLocal();

    try {
      await apiClient.cancelOrder(target.orderUuid);
    } catch (err) {
      console.warn('Backend cancelOrder warning:', err);
    }

    return true;
  }

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
      const isServed = i < 3;

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
  }

  public resetAllData(): void {
    this.seedDefaultOrders();
    this.employees = [...INITIAL_EMPLOYEES];
    this.saveEmployeesLocal();
  }

  private getTargetOrdersForExport(fromDate?: string, toDate?: string, customOrders?: Order[]): Order[] {
    if (customOrders && customOrders.length > 0) {
      return [...customOrders];
    }
    let targetOrders = [...this.orders];
    if (fromDate && toDate) {
      targetOrders = targetOrders.filter((o) => o.dateStr >= fromDate && o.dateStr <= toDate);
    } else if (fromDate) {
      targetOrders = targetOrders.filter((o) => o.dateStr === fromDate);
    }
    return targetOrders;
  }

  public exportAuditCSV(fromDate?: string, toDate?: string, customOrders?: Order[]): void {
    const targetOrders = this.getTargetOrdersForExport(fromDate, toDate, customOrders);
    exportOrdersToCSV(targetOrders, fromDate, toDate);
  }

  public exportAuditExcel(fromDate?: string, toDate?: string, customOrders?: Order[]): void {
    const targetOrders = this.getTargetOrdersForExport(fromDate, toDate, customOrders);
    exportOrdersToExcel(targetOrders, fromDate, toDate);
  }

  public exportAuditPDF(fromDate?: string, toDate?: string, customOrders?: Order[]): void {
    const targetOrders = this.getTargetOrdersForExport(fromDate, toDate, customOrders);
    exportOrdersToPDF(targetOrders, fromDate, toDate);
  }

  // =========================================================================
  // 1. TRANSPORT UNITS MANAGEMENT
  // =========================================================================
  public getTransportUnits(): TransportUnit[] {
    return [...this.transportUnits];
  }

  public async addTransportUnit(unit: Omit<TransportUnit, 'id'> | TransportUnit): Promise<TransportUnit> {
    const newUnit: TransportUnit = {
      ...unit,
      id: 'id' in unit && unit.id ? unit.id : `UNIT-${Date.now().toString(36).toUpperCase()}`,
    };
    this.transportUnits.push(newUnit);
    this.saveTransportUnitsLocal();

    try {
      await apiClient.createTransportUnit(newUnit);
    } catch (e) {
      console.warn('Transport unit backend save warning:', e);
    }
    return newUnit;
  }

  public async deleteTransportUnit(id: string): Promise<void> {
    this.transportUnits = this.transportUnits.filter((u) => u.id !== id);
    this.saveTransportUnitsLocal();

    try {
      await apiClient.deleteTransportUnit(id);
    } catch (e) {
      console.warn('Transport unit backend delete warning:', e);
    }
  }

  // =========================================================================
  // 2. FOOD TRANSPORT & DISPATCH LEDGER
  // =========================================================================
  public getFoodTransports(): FoodTransportRecord[] {
    return [...this.foodTransports];
  }

  public async addFoodTransport(
    record: Omit<FoodTransportRecord, 'id' | 'timestamp'>
  ): Promise<FoodTransportRecord> {
    const timestamp = Date.now();
    const id = `TRP-${Date.now().toString(36).toUpperCase()}`;
    const newRecord: FoodTransportRecord = {
      ...record,
      id,
      timestamp,
      created_at: new Date(timestamp).toISOString(),
    };

    this.foodTransports.unshift(newRecord);
    this.saveFoodTransportsLocal();

    try {
      await apiClient.createFoodTransport(newRecord);
    } catch (e) {
      console.warn('Food transport backend save warning:', e);
    }
    return newRecord;
  }

  public async deleteFoodTransport(id: string): Promise<void> {
    this.foodTransports = this.foodTransports.filter((t) => t.id !== id);
    this.saveFoodTransportsLocal();

    try {
      await apiClient.deleteFoodTransport(id);
    } catch (e) {
      console.warn('Food transport backend delete warning:', e);
    }
  }

  // =========================================================================
  // 3. MEAL FEEDBACK & EMPLOYEE REVIEWS
  // =========================================================================
  public getFeedbacks(): MealFeedback[] {
    return [...this.feedbacks];
  }

  public async submitFeedback(feedback: MealFeedback): Promise<void> {
    const fb: MealFeedback = {
      ...feedback,
      id: feedback.id || `FB-${Date.now().toString(36).toUpperCase()}`,
    };
    this.feedbacks.unshift(fb);
    this.saveFeedbacksLocal();

    try {
      await apiClient.createFeedback(fb);
    } catch (e) {
      console.warn('Feedback save warning:', e);
    }
  }

  public async deleteFeedback(id: string): Promise<void> {
    this.feedbacks = this.feedbacks.filter((f) => f.id !== id);
    this.saveFeedbacksLocal();

    try {
      await apiClient.deleteFeedback(id);
    } catch (e) {
      console.warn('Feedback delete warning:', e);
    }
  }
}

export const canteenService = new CanteenService();
