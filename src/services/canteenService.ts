import type { Employee, MealFeedback, MealSlotConfig, MealSlotName, Order, VerificationResult } from '../types';
import { supabaseManager } from './supabase';

const STORAGE_ORDERS_KEY = 'canteen_local_orders_v3';
const STORAGE_TOKEN_KEY = 'canteen_token_seq_v3';
const STORAGE_EMPLOYEES_KEY = 'canteen_local_employees_v3';
const STORAGE_MEAL_SLOTS_KEY = 'canteen_custom_menu_slots_permanent';
const STORAGE_FEEDBACK_KEY = 'canteen_customer_feedbacks_v1';

// Strictly 3 Canteen Meal Slots: Tiffin, Lunch, Tea/Snacks with pure Tamil text (no brackets)
// Clean slate: description starts empty so user menu updates are saved without default placeholder data
export const DEFAULT_MEAL_SLOTS: MealSlotConfig[] = [
  {
    name: 'Tiffin',
    startTime: '07:30',
    endTime: '11:00',
    displayName: 'Tiffin',
    tamilDisplayName: 'டிபன்',
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

// Clean Slate: Empty initial employees so admin can register new users
export const INITIAL_EMPLOYEES: Employee[] = [];

export const isStaleDummyDescription = (desc?: string): boolean => {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return (
    d.includes('steamed idli') ||
    d.includes('crispy medu vada') ||
    d.includes('crispy vada') ||
    d.includes('executive lunch') ||
    d.includes('executive meals') ||
    d.includes('special masala tea') ||
    d.includes('complete south indian') ||
    d.includes('special masala chai')
  );
};

class CanteenService {
  private employees: Employee[] = [];
  private orders: Order[] = [];
  private mealSlots: MealSlotConfig[] = [...DEFAULT_MEAL_SLOTS];
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

      // Load custom menu slots from permanent key, or fallback to any previously stored keys
      let rawSlots = localStorage.getItem(STORAGE_MEAL_SLOTS_KEY);
      if (!rawSlots) {
        rawSlots = localStorage.getItem('canteen_meal_slots_v8') ||
                   localStorage.getItem('canteen_meal_slots_v7') ||
                   localStorage.getItem('canteen_meal_slots_v6') ||
                   localStorage.getItem('canteen_meal_slots');
      }

      if (rawSlots) {
        try {
          const parsedSlots: any[] = JSON.parse(rawSlots);
          if (Array.isArray(parsedSlots) && parsedSlots.length > 0) {
            const slotNames: MealSlotName[] = ['Tiffin', 'Lunch', 'Tea/Snacks'];
            this.mealSlots = slotNames.map(name => {
              const def = DEFAULT_MEAL_SLOTS.find(d => d.name === name)!;
              const existing = parsedSlots.find(ps => 
                ps.name === name ||
                (name === 'Tiffin' && ps.name === 'Breakfast') ||
                (name === 'Tea/Snacks' && (ps.name === 'Tea or Coffee' || ps.name === 'Snacks' || ps.name === 'Tea'))
              );

              if (existing) {
                // Preserve exact user settings (what was typed, what amount fixed, what times fixed)
                const userRate = existing.rate !== undefined ? existing.rate : (existing.cost !== undefined ? existing.cost : def.rate);
                const cleanTamil = (existing.tamilDisplayName || def.tamilDisplayName || '')
                  .replace(/\(.*?\)/g, '')
                  .replace(/[a-zA-Z]/g, '')
                  .trim();
                
                // If existing description had legacy hardcoded dummy strings, purge it to empty string
                let userDesc = existing.description;
                if (userDesc === undefined || userDesc === null || isStaleDummyDescription(userDesc)) {
                  userDesc = '';
                }

                return {
                  ...def,
                  ...existing,
                  name,
                  displayName: existing.displayName || def.displayName,
                  description: userDesc,
                  startTime: existing.startTime || def.startTime,
                  endTime: existing.endTime || def.endTime,
                  rate: userRate,
                  cost: userRate,
                  tamilDisplayName: cleanTamil || def.tamilDisplayName,
                  isActive: existing.isActive !== false,
                };
              }
              return { ...def };
            });
            this.saveMealSlotsLocal();
          } else {
            this.mealSlots = [...DEFAULT_MEAL_SLOTS];
            this.saveMealSlotsLocal();
          }
        } catch {
          this.mealSlots = [...DEFAULT_MEAL_SLOTS];
        }
      } else {
        this.mealSlots = [...DEFAULT_MEAL_SLOTS];
        this.saveMealSlotsLocal();
      }

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

      // 2. Fetch remote orders across all dates (up to 3000 records)
      const { data: remoteOrders, error: ordErr } = await client
        .from('canteen_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);

      if (!ordErr && remoteOrders && remoteOrders.length > 0) {
        const mappedRemote: Order[] = remoteOrders.map((rem: any) => ({
          id: rem.id,
          token: rem.token_number,
          orderUuid: rem.order_uuid,
          userId: rem.user_id,
          name: rem.user_name,
          dept: rem.department,
          meal: rem.meal_slot,
          items: rem.items || [],
          rate: rem.rate ?? 40,
          qty: rem.qty ?? 1,
          status: rem.status,
          issuedAt: rem.issued_at && rem.issued_at.includes('T') ? new Date(rem.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rem.issued_at || ''),
          servedAt: rem.served_at && rem.served_at.includes('T') ? new Date(rem.served_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rem.served_at || null),
          timestamp: rem.created_at ? new Date(rem.created_at).getTime() : Date.now(),
          dateStr: rem.order_date,
        }));

        // Merge local and remote orders without duplicates (keyed by orderUuid or id)
        const orderMap = new Map<string, Order>();
        this.orders.forEach(o => {
          const key = (o.orderUuid || o.id).toLowerCase();
          orderMap.set(key, o);
        });
        mappedRemote.forEach(o => {
          const key = (o.orderUuid || o.id).toLowerCase();
          orderMap.set(key, o);
        });

        // Store all merged historical orders sorted descending by timestamp
        this.orders = Array.from(orderMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Token sequence is based strictly on TODAY's orders so daily numbering is clean
        const today = new Date().toISOString().slice(0, 10);
        const todayTokens = this.orders.filter(o => o.dateStr === today).map(o => o.token);
        const maxTodayToken = todayTokens.length > 0 ? Math.max(...todayTokens) : 100;
        if (maxTodayToken >= 100) {
          this.tokenSeq = maxTodayToken + 1;
        }
        this.saveLocal();
        supabaseManager.broadcastChange('canteen_orders', 'UPDATE', this.orders);
      }

      // 3. Sync Meal Slots: Protect user custom menu data from being overwritten by stale defaults
      const userHasSavedLocally = Boolean(localStorage.getItem('canteen_menu_last_saved'));

      if (userHasSavedLocally) {
        // User's local edits are authoritative: push to Supabase to keep remote updated
        for (const s of this.mealSlots) {
          const slotId = s.name === 'Tea/Snacks' ? 'TEASNACKS' : s.name.toUpperCase();
          await client.from('canteen_meal_slots').upsert({
            id: slotId,
            name: s.name,
            display_name: s.displayName,
            start_time: s.startTime,
            end_time: s.endTime,
            emoji: s.emoji,
            description: s.description || '',
            price: s.rate ?? s.cost ?? 40,
            is_active: s.isActive !== false,
          }, { onConflict: 'id' });
        }
      } else {
        // Only pull from Supabase if user has not yet customized slots locally
        const { data: remoteSlots, error: slotErr } = await client
          .from('canteen_meal_slots')
          .select('*');

        if (!slotErr && remoteSlots && remoteSlots.length > 0) {
          this.mealSlots = this.mealSlots.map(localSlot => {
            const rem = remoteSlots.find((r: any) => 
              r.name?.toLowerCase() === localSlot.name.toLowerCase() ||
              (localSlot.name === 'Tea/Snacks' && (r.id === 'TEASNACKS' || r.name === 'Tea/Snacks'))
            );
            if (rem) {
              const p = rem.price !== undefined && rem.price !== null ? Number(rem.price) : (localSlot.rate ?? 40);
              const remDesc = isStaleDummyDescription(rem.description) ? '' : (rem.description ?? localSlot.description);
              return {
                ...localSlot,
                description: remDesc || '',
                rate: p,
                cost: p,
                startTime: rem.start_time ? String(rem.start_time).slice(0, 5) : localSlot.startTime,
                endTime: rem.end_time ? String(rem.end_time).slice(0, 5) : localSlot.endTime,
              };
            }
            return localSlot;
          });
          this.saveMealSlotsLocal();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: this.mealSlots }));
          }
        }
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

  public getOrdersByDate(dateStr: string): Order[] {
    return this.orders.filter(o => o.dateStr === dateStr);
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
    this.mealSlots = newSlots.map(s => {
      const def = DEFAULT_MEAL_SLOTS.find(d => d.name === s.name);
      const r = s.rate !== undefined ? s.rate : (s.cost !== undefined ? s.cost : (def?.rate ?? 40));
      const cleanTamil = (s.tamilDisplayName || def?.tamilDisplayName || '')
        .replace(/\(.*?\)/g, '')
        .replace(/[a-zA-Z]/g, '')
        .trim();
      return {
        ...s,
        description: s.description || '',
        rate: r,
        cost: r,
        tamilDisplayName: cleanTamil || def?.tamilDisplayName,
      };
    });
    this.saveMealSlotsLocal();
    try {
      localStorage.setItem('canteen_menu_last_saved', Date.now().toString());
    } catch {}

    // Persist to Supabase so menu changes survive across all devices and reloads
    try {
      const client = supabaseManager.getClient();
      if (client) {
        for (const s of this.mealSlots) {
          const slotId = s.name === 'Tea/Snacks' ? 'TEASNACKS' : s.name.toUpperCase();
          await client.from('canteen_meal_slots').upsert({
            id: slotId,
            name: s.name,
            display_name: s.displayName,
            start_time: s.startTime,
            end_time: s.endTime,
            emoji: s.emoji,
            description: s.description || '',
            price: s.rate ?? s.cost ?? 40,
            is_active: s.isActive !== false,
          }, { onConflict: 'id' });
        }
      }
    } catch (e) {
      console.warn('Failed saving meal slots to Supabase:', e);
    }

    supabaseManager.broadcastChange('canteen_meal_slots', 'UPDATE', this.mealSlots);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: this.mealSlots }));
    }
  }

  public getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Calculates total tokens already taken by an employee for a specific food type today.
   * Maximum allowed is 10 tokens per day per food type.
   */
  public getEmployeeMealTokensCountToday(userId: string, meal: MealSlotName): number {
    const today = this.getTodayDateString();
    const userOrdersToday = this.orders.filter(
      o => o.userId === userId && 
           (o.meal === meal || 
            (meal === 'Tiffin' && (o.meal === 'Tiffin' || o.meal === 'Breakfast')) ||
            (meal === 'Tea/Snacks' && (o.meal === 'Tea/Snacks' || o.meal === 'Snacks' || (o.meal as string) === 'Tea' || o.meal === 'Tea or Coffee'))) &&
           o.dateStr === today &&
           o.status !== 'CANCELLED'
    );
    return userOrdersToday.reduce((sum, o) => sum + (o.qty ?? 1), 0);
  }

  /**
   * Determine active meal slot based on configured start and end times
   */
  public getActiveMealSlot(): MealSlotName {
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    const activeSlots = this.mealSlots.filter(s => s.isActive !== false);
    for (const slot of activeSlots) {
      const [startH, startM] = (slot.startTime || '00:00').split(':').map(Number);
      const [endH, endM] = (slot.endTime || '23:59').split(':').map(Number);
      const startMin = (startH || 0) * 60 + (startM || 0);
      const endMin = (endH || 0) * 60 + (endM || 0);

      if (curMinutes >= startMin && curMinutes <= endMin) {
        return slot.name;
      }
    }

    // Default fallback to first active slot or Lunch
    return activeSlots[0]?.name || 'Lunch';
  }

  /**
   * Duplicate Order Prevention: Only Lunch is restricted to 1 meal per employee per day.
   * Tiffin and Tea/Snacks allow multiple quantities / orders up to 10 per day.
   */
  public checkDuplicateBooking(userId: string, meal: MealSlotName): Order | undefined {
    if (meal.toLowerCase() !== 'lunch') {
      return undefined;
    }
    const today = new Date().toISOString().slice(0, 10);
    return this.orders.find(o => 
      o.userId === userId && 
      o.meal.toLowerCase() === 'lunch' && 
      o.dateStr === today &&
      o.status !== 'CANCELLED'
    );
  }

  /**
   * Creates multiple sequential orders/tokens when quantity > 1
   * Each token gets its own unique token number, order UUID, and QR code!
   * Enforces 10 tokens maximum per day per person for Tiffin / Tea/Snacks.
   */
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

    // Non-lunch tokens daily limit check (10 max per employee per day)
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
    const resolvedRate = (rate !== undefined && rate !== null) 
      ? rate 
      : (configuredSlot?.rate ?? configuredSlot?.cost ?? 40);

    const client = supabaseManager.getClient();
    const createdOrders: Order[] = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);

    for (let i = 0; i < count; i++) {
      let tokenNo = this.tokenSeq++;
      const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      let orderUuid = `ORD-${Date.now().toString(36).toUpperCase()}-${tokenNo}-${uniqueSuffix}`;

      if (client) {
        try {
          const { data: inserted, error } = await client.from('canteen_orders').insert({
            user_id: employee.id,
            user_name: employee.name,
            department: employee.dept,
            meal_slot: meal,
            items: items || [],
            rate: resolvedRate,
            qty: 1,
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
      supabaseManager.broadcastChange('canteen_orders', 'INSERT', newOrder);
    }

    this.saveLocal();
    return createdOrders;
  }

  /**
   * Creates new single order, or delegates to createOrdersBatch if qty > 1
   */
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

  public exportAuditCSV(fromDate?: string, toDate?: string): void {
    let targetOrders = [...this.orders];
    if (fromDate && toDate) {
      targetOrders = targetOrders.filter(o => o.dateStr >= fromDate && o.dateStr <= toDate);
    } else if (fromDate) {
      targetOrders = targetOrders.filter(o => o.dateStr === fromDate);
    }

    if (targetOrders.length === 0) {
      alert(`No records found to export for ${fromDate ? `date range ${fromDate} to ${toDate || fromDate}` : 'the ledger'}.`);
      return;
    }

    const headers = [
      'Token Number',
      'Order UUID',
      'Employee ID',
      'Employee Name',
      'Department',
      'Meal Slot',
      'Rate (₹)',
      'Quantity',
      'Total Amount (₹)',
      'Menu Items',
      'Status',
      'Issued Time',
      'Served Time',
      'Date',
    ];

    const rows = targetOrders.map(o => {
      const itemDesc = Array.isArray(o.items) && o.items.length > 0
        ? o.items.map(it => (typeof it === 'string' ? it : it?.description || it?.name || '')).join('; ')
        : '';
      const rateVal = o.rate ?? 40;
      const qtyVal = o.qty ?? 1;
      const totalAmount = rateVal * qtyVal;
      return [
        o.token,
        `"${o.orderUuid}"`,
        `"${o.userId}"`,
        `"${o.name}"`,
        `"${o.dept}"`,
        `"${o.meal}"`,
        rateVal,
        qtyVal,
        totalAmount,
        `"${itemDesc.replace(/"/g, '""')}"`,
        o.status,
        `"${o.issuedAt}"`,
        `"${o.servedAt || ''}"`,
        `"${o.dateStr}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = fromDate && toDate
      ? `Canteen_Audit_${fromDate}_to_${toDate}.csv`
      : fromDate
      ? `Canteen_Audit_${fromDate}.csv`
      : `Canteen_Audit_All_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Save customer feedback locally and sync to Supabase
   */
  public async submitFeedback(feedback: MealFeedback): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_FEEDBACK_KEY);
      const list: MealFeedback[] = stored ? JSON.parse(stored) : [];
      list.unshift(feedback);
      localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(list));

      const client = supabaseManager.getClient();
      if (client) {
        await client.from('canteen_feedback').insert({
          meal_slot: feedback.mealSlot,
          rating: feedback.rating,
          comment: feedback.comment || null,
          created_at: new Date(feedback.timestamp).toISOString(),
        });
      }
    } catch (e) {
      console.warn('Feedback save fallback:', e);
    }
  }

  public getFeedbacks(): MealFeedback[] {
    try {
      const stored = localStorage.getItem(STORAGE_FEEDBACK_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

export const canteenService = new CanteenService();
