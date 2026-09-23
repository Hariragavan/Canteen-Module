-- ==============================================================================
-- SMART CANTEEN OS: PRODUCTION SUPABASE POSTGRESQL SCHEMA (FINAL HARDENED)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. DEPARTMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_departments (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed departments (Includes Staff and Employee to match kiosk roster requirements)
INSERT INTO canteen_departments (id, name, description)
VALUES 
  ('STAFF', 'Staff', 'Canteen, Executive & Administrative Staff'),
  ('EMPLOYEE', 'Employee', 'Company & Technical Employees'),
  ('GENERAL', 'General / Unassigned', 'General staff and visitors'),
  ('ADMIN', 'Administration & HR', 'Management and Administrative Staff'),
  ('ENGG', 'Engineering & Tech', 'Engineering and Technical Teams'),
  ('OPS', 'Operations & Logistics', 'Operations and Facilities Staff')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. EMPLOYEES / BIOMETRIC ROSTER TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_employees (
  id TEXT PRIMARY KEY,                       -- e.g. 'EMP-1001', 'STF-2001'
  name TEXT NOT NULL,
  dept TEXT NOT NULL REFERENCES canteen_departments(name) ON UPDATE CASCADE,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'Employee',
  face_descriptor JSONB DEFAULT NULL,        -- 128D array from @vladmandic/face-api
  confidence_score NUMERIC DEFAULT 0.98,
  subsidy_rate NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canteen_emp_active ON canteen_employees (is_active);

-- Schema Migration (ensures face_descriptor column is present if table already existed)
ALTER TABLE public.canteen_employees 
ADD COLUMN IF NOT EXISTS face_descriptor jsonb DEFAULT NULL;

-- ------------------------------------------------------------------------------
-- 3. MEAL SLOTS & MENU TIMINGS TABLE
-- ------------------------------------------------------------------------------
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

-- Deactivate legacy slots if they exist
UPDATE canteen_meal_slots SET is_active = false WHERE id IN ('BREAKFAST', 'TEA', 'SNACKS', 'DINNER');

-- ------------------------------------------------------------------------------
-- 4. DAILY ATOMIC TOKEN COUNTER (Prevents duplicate tokens during rush hour)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_daily_counter (
  counter_date DATE PRIMARY KEY,
  last_token INTEGER NOT NULL DEFAULT 100
);

-- ------------------------------------------------------------------------------
-- 5. ORDERS & THERMAL SLIP LEDGER TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_number INTEGER NOT NULL DEFAULT 0,
  order_uuid TEXT UNIQUE NOT NULL DEFAULT ('ORD-' || to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  user_id TEXT NOT NULL REFERENCES canteen_employees(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  department TEXT NOT NULL,
  meal_slot TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,           -- Selected dishes from vertical scroll menu
  rate NUMERIC DEFAULT 40.00,                -- Token unit rate
  qty INTEGER DEFAULT 1,                     -- Quantity ordered
  status TEXT NOT NULL DEFAULT 'PRINTED',    -- 'PRINTED', 'SERVED', 'CANCELLED'
  issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  served_at TIMESTAMPTZ,
  served_by TEXT,
  -- Timezone locked to IST so midnight rollovers never desync
  order_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema Migrations for existing deployments
ALTER TABLE canteen_orders ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 40.00;
ALTER TABLE canteen_orders ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;

-- Only Lunch has a 1-meal-per-day restriction. Tiffin and Tea/Snacks allow multiple quantity/bookings.
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
    
    -- Atomic upsert: increments token atomically with zero race conditions
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_canteen_orders_uuid ON canteen_orders (order_uuid);
CREATE INDEX IF NOT EXISTS idx_canteen_orders_token ON canteen_orders (token_number);
CREATE INDEX IF NOT EXISTS idx_canteen_orders_status ON canteen_orders (status);
CREATE INDEX IF NOT EXISTS idx_canteen_orders_date ON canteen_orders (order_date);
CREATE INDEX IF NOT EXISTS idx_canteen_orders_user ON canteen_orders (user_id);

-- ------------------------------------------------------------------------------
-- 6. BIOMETRIC AUDIT & PUNCH SCAN LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_face_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES canteen_employees(id) ON DELETE SET NULL,
  user_name TEXT,
  match_distance NUMERIC,
  confidence_score NUMERIC,
  status TEXT NOT NULL,                      -- 'VERIFIED', 'UNREGISTERED', 'SPOOF_REJECTED'
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canteen_face_logs_date ON canteen_face_scan_logs (scanned_at);

-- ------------------------------------------------------------------------------
-- 7. COMPATIBILITY VIEWS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.employees AS SELECT * FROM public.canteen_employees;
CREATE OR REPLACE VIEW public.orders AS SELECT * FROM public.canteen_orders;
CREATE OR REPLACE VIEW public.departments AS SELECT * FROM public.canteen_departments;
CREATE OR REPLACE VIEW public.meal_slots AS SELECT * FROM public.canteen_meal_slots;

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE canteen_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_meal_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_daily_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE canteen_face_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on departments" ON canteen_departments;
CREATE POLICY "Allow public read on departments" ON canteen_departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public all on employees" ON canteen_employees;
CREATE POLICY "Allow public all on employees" ON canteen_employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on meal slots" ON canteen_meal_slots;
CREATE POLICY "Allow public read on meal slots" ON canteen_meal_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public all on daily counter" ON canteen_daily_counter;
CREATE POLICY "Allow public all on daily counter" ON canteen_daily_counter FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on orders" ON canteen_orders;
CREATE POLICY "Allow public all on orders" ON canteen_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on scan logs" ON canteen_face_scan_logs;
CREATE POLICY "Allow public all on scan logs" ON canteen_face_scan_logs FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. SUPABASE REALTIME REPLICATION
-- ------------------------------------------------------------------------------
ALTER TABLE canteen_orders REPLICA IDENTITY FULL;
ALTER TABLE canteen_employees REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_employees;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE canteen_face_scan_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------------------------
-- 10. CUSTOMER FOOD & SERVICE FEEDBACK TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canteen_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_slot TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE canteen_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on feedback" ON canteen_feedback;
CREATE POLICY "Allow public all on feedback" ON canteen_feedback FOR ALL USING (true) WITH CHECK (true);

