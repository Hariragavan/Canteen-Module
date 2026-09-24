import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Default Supabase config stored in localStorage or fallback placeholder
const STORAGE_KEY_URL = 'canteen_supabase_url';
const STORAGE_KEY_KEY = 'canteen_supabase_anon_key';

// Built-in project credentials (ensures every new device automatically connects)
export const DEFAULT_SUPABASE_URL = 'https://ppyasypabniuhoqpglay.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_ZKBs3ehomxW6UVPL9II0IA_3cVIA55Q';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  isCustom: boolean;
}

class SupabaseManager {
  private client: SupabaseClient | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private config: SupabaseConfig = {
    url: '',
    anonKey: '',
    isConnected: false,
    isCustom: false,
  };

  // Listeners for internal real-time event distribution
  private subscribers: Set<(event: { table: string; eventType: string; payload: unknown }) => void> = new Set();

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage() {
    const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
    const savedKey = localStorage.getItem(STORAGE_KEY_KEY) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_KEY;

    if (savedUrl && savedKey && savedUrl.startsWith('http')) {
      try {
        this.client = createClient(savedUrl, savedKey);
        this.config = {
          url: savedUrl,
          anonKey: savedKey,
          isConnected: true,
          isCustom: true,
        };
        this.setupRealtimeChannel();
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
        this.config.isConnected = false;
      }
    } else {
      this.config = {
        url: '',
        anonKey: '',
        isConnected: false,
        isCustom: false,
      };
    }
  }

  private setupRealtimeChannel() {
    if (!this.client) return;
    try {
      if (this.realtimeChannel) {
        try {
          this.client.removeChannel(this.realtimeChannel);
        } catch {}
        this.realtimeChannel = null;
      }

      this.realtimeChannel = this.client.channel('canteen_realtime_sync', {
        config: { broadcast: { self: false } },
      });

      // 1. Cross-device Broadcast: Menu updates from any device
      this.realtimeChannel.on('broadcast', { event: 'menu_updated' }, ({ payload }) => {
        this.broadcastChange('canteen_meal_slots', 'UPDATE', payload);
      });

      // 2. Cross-device Broadcast: Employee deleted
      this.realtimeChannel.on('broadcast', { event: 'employee_deleted' }, ({ payload }) => {
        this.broadcastChange('canteen_employees', 'DELETE', payload);
      });

      // 3. Cross-device Broadcast: Employee added or updated
      this.realtimeChannel.on('broadcast', { event: 'employee_updated' }, ({ payload }) => {
        this.broadcastChange('canteen_employees', 'UPDATE', payload);
      });

      // 4. Postgres DB changes: canteen_employees
      this.realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'canteen_employees' }, (change) => {
        const eventType = (change.eventType as 'INSERT' | 'UPDATE' | 'DELETE') || 'UPDATE';
        this.broadcastChange('canteen_employees', eventType, change.new || change.old);
      });

      // 5. Postgres DB changes: canteen_orders
      this.realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'canteen_orders' }, (change) => {
        const eventType = (change.eventType as 'INSERT' | 'UPDATE' | 'DELETE') || 'UPDATE';
        this.broadcastChange('canteen_orders', eventType, change.new || change.old);
      });

      this.realtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] sync channel connected across all devices');
        }
      });
    } catch (e) {
      console.warn('Failed setting up Supabase realtime channel:', e);
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public async updateCredentials(url: string, anonKey: string): Promise<boolean> {
    if (!url || !anonKey) {
      // Revert to demo mode
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
      this.client = null;
      this.config = {
        url: '',
        anonKey: '',
        isConnected: false,
        isCustom: false,
      };
      return true;
    }

    try {
      const testClient = createClient(url, anonKey);
      // Quick ping test
      const { error } = await testClient.from('canteen_employees').select('id').limit(1);
      
      this.client = testClient;
      localStorage.setItem(STORAGE_KEY_URL, url);
      localStorage.setItem(STORAGE_KEY_KEY, anonKey);
      this.config = {
        url,
        anonKey,
        isConnected: !error,
        isCustom: true,
      };
      this.setupRealtimeChannel();
      return !error;
    } catch (err) {
      console.warn('Supabase connection verification failed:', err);
      // Still store if valid URL syntax
      this.client = createClient(url, anonKey);
      localStorage.setItem(STORAGE_KEY_URL, url);
      localStorage.setItem(STORAGE_KEY_KEY, anonKey);
      this.config = {
        url,
        anonKey,
        isConnected: false,
        isCustom: true,
      };
      this.setupRealtimeChannel();
      return false;
    }
  }

  /**
   * Broadcast real-time change to all active components locally
   */
  public broadcastChange(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', payload: unknown) {
    this.subscribers.forEach(cb => cb({ table, eventType, payload }));
  }

  /**
   * Broadcast an event across ALL connected devices via Supabase Realtime
   */
  public async broadcastRemote(event: string, payload: unknown): Promise<void> {
    if (this.realtimeChannel) {
      try {
        await this.realtimeChannel.send({
          type: 'broadcast',
          event,
          payload,
        });
      } catch (err) {
        console.warn('Failed sending remote broadcast:', err);
      }
    }
  }

  /**
   * Subscribe to real-time events
   */
  public onRealtimeChange(callback: (event: { table: string; eventType: string; payload: unknown }) => void) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

export const supabaseManager = new SupabaseManager();
