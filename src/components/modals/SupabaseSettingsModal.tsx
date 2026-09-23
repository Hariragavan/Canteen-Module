import React, { useState, useEffect } from 'react';
import { X, Database, Check, Copy, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabaseManager } from '../../services/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

const SQL_SCHEMA_SNIPPET = `-- ==============================================================================
-- SMART CANTEEN OS: PRODUCTION SUPABASE POSTGRESQL SCHEMA (REVISED & TESTED)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS canteen_departments (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO canteen_departments (id, name, description)
VALUES 
  ('STAFF', 'Staff', 'Canteen, Executive & Administrative Staff'),
  ('EMPLOYEE', 'Employee', 'Company & Technical Employees'),
  ('GENERAL', 'General / Unassigned', 'General staff and visitors'),
  ('ADMIN', 'Administration & HR', 'Management and Administrative Staff'),
  ('ENGG', 'Engineering & Tech', 'Engineering and Technical Teams'),
  ('OPS', 'Operations & Logistics', 'Operations and Facilities Staff')
ON CONFLICT (id) DO NOTHING;

-- 2. EMPLOYEES / BIOMETRIC ROSTER TABLE
CREATE TABLE IF NOT EXISTS canteen_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL REFERENCES canteen_departments(name) ON UPDATE CASCADE,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'Employee',
  face_descriptor JSONB DEFAULT NULL,
  confidence_score NUMERIC DEFAULT 0.98,
  subsidy_rate NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canteen_emp_active ON canteen_employees (is_active);
ALTER TABLE public.canteen_employees ADD COLUMN IF NOT EXISTS face_descriptor jsonb DEFAULT NULL;

-- 3. MEAL SLOTS & MENU TIMINGS TABLE
CREATE TABLE IF NOT EXISTS canteen_meal_slots (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  price NUMERIC(6, 2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active 3 meal slots: Tiffin, Lunch, Tea/Snacks
INSERT INTO canteen_meal_slots (id, name, display_name, start_time, end_time, emoji, description, price)
VALUES 
  ('TIFFIN', 'Tiffin', 'Tiffin Special', '07:30', '10:30', '🥞', 'Steamed Idli, Crispy Vada & Sambar', 35.00),
  ('LUNCH', 'Lunch', 'Executive Lunch Platter', '12:00', '15:00', '🍛', 'Complete South Indian Veg Thali', 60.00),
  ('TEASNACKS', 'Tea/Snacks', 'Tea & Evening Snacks', '15:30', '18:30', '☕', 'Special Masala Chai & Hot Snacks', 20.00)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  display_name = EXCLUDED.display_name,
  price = EXCLUDED.price;

-- 4. DAILY ATOMIC TOKEN COUNTER
CREATE TABLE IF NOT EXISTS canteen_daily_counter (
  counter_date DATE PRIMARY KEY,
  last_token INTEGER NOT NULL DEFAULT 100
);

-- 5. ORDERS & THERMAL SLIP LEDGER TABLE
CREATE TABLE IF NOT EXISTS canteen_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_number INTEGER NOT NULL DEFAULT 0,
  order_uuid TEXT UNIQUE NOT NULL DEFAULT ('ORD-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  user_id TEXT NOT NULL REFERENCES canteen_employees(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  department TEXT NOT NULL,
  meal_slot TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  rate NUMERIC DEFAULT 40.00,
  qty INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PRINTED',
  issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  served_at TIMESTAMPTZ,
  served_by TEXT,
  order_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE canteen_orders ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 40.00;
ALTER TABLE canteen_orders ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;

DROP INDEX IF EXISTS idx_canteen_unique_daily_booking;
CREATE UNIQUE INDEX IF NOT EXISTS idx_canteen_unique_daily_lunch 
ON canteen_orders (user_id, order_date) 
WHERE meal_slot = 'Lunch' AND status != 'CANCELLED';

-- Concurrency-Safe Atomic Token Generator Trigger
CREATE OR REPLACE FUNCTION set_daily_token_number()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
  today_dt DATE;
  next_tok INTEGER;
BEGIN
  IF NEW.token_number IS NULL OR NEW.token_number = 0 THEN
    today_dt := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    INSERT INTO canteen_daily_counter (counter_date, last_token)
    VALUES (today_dt, 101)
    ON CONFLICT (counter_date) 
    DO UPDATE SET last_token = canteen_daily_counter.last_token + 1
    RETURNING last_token INTO next_tok;
    
    NEW.token_number := next_tok;
    NEW.order_date := today_dt;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_token_number ON canteen_orders;
CREATE TRIGGER trg_set_token_number
BEFORE INSERT ON canteen_orders
FOR EACH ROW
EXECUTE FUNCTION set_daily_token_number();

-- 6. BIOMETRIC AUDIT & PUNCH SCAN LOGS
CREATE TABLE IF NOT EXISTS canteen_face_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES canteen_employees(id) ON DELETE SET NULL,
  user_name TEXT,
  match_distance NUMERIC,
  confidence_score NUMERIC,
  status TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE canteen_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_meal_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_daily_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_face_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on departments" ON canteen_departments FOR SELECT USING (true);
CREATE POLICY "Allow public all on employees" ON canteen_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on meal slots" ON canteen_meal_slots FOR SELECT USING (true);
CREATE POLICY "Allow public all on daily counter" ON canteen_daily_counter FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on orders" ON canteen_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on scan logs" ON canteen_face_scan_logs FOR ALL USING (true) WITH CHECK (true);

-- 8. SUPABASE REALTIME REPLICATION
ALTER TABLE canteen_orders REPLICA IDENTITY FULL;
ALTER TABLE canteen_employees REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_employees;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_face_scan_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;`;

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [url, setUrl] = useState<string>('');
  const [anonKey, setAnonKey] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const config = supabaseManager.getConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestStatus(config.isConnected ? 'SUCCESS' : 'IDLE');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestStatus('IDLE');

    const success = await supabaseManager.updateCredentials(url.trim(), anonKey.trim());
    setIsTesting(false);
    setTestStatus(success ? 'SUCCESS' : 'ERROR');

    if (onConfigChanged) onConfigChanged();
  };

  const handleClearToDemo = async () => {
    await supabaseManager.updateCredentials('', '');
    setUrl('');
    setAnonKey('');
    setTestStatus('IDLE');
    if (onConfigChanged) onConfigChanged();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-modal flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Supabase Backend Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Connect your live PostgreSQL database or continue in offline demo mode.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          <form onSubmit={handleSaveAndTest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Project URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Public Anon Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center space-x-2">
                <button
                  type="submit"
                  disabled={isTesting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing Connection...' : 'Save & Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearToDemo}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Use Offline Demo Mode
                </button>
              </div>

              {testStatus === 'SUCCESS' && (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Supabase Connected & Live</span>
                </div>
              )}

              {testStatus === 'ERROR' && (
                <div className="flex items-center space-x-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Credentials Saved (Running with local fallback)</span>
                </div>
              )}
            </div>
          </form>

          {/* SQL Schema Copy Section */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">PostgreSQL Schema & RLS Script</h4>
                <p className="text-[11px] text-slate-500">
                  Run this inside your Supabase project SQL Editor to initialize tables, indexes & policies.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <pre className="p-3.5 bg-slate-950 text-slate-300 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800 leading-relaxed">
              {SQL_SCHEMA_SNIPPET}
            </pre>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
