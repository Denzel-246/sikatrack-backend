-- ============================================================
-- SikaTrack — Supabase Database Setup
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── USERS TABLE ──
CREATE TABLE IF NOT EXISTS users (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone                 TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL DEFAULT 'My Shop',
  plan                  TEXT NOT NULL DEFAULT 'free',
  trial_ends            TIMESTAMPTZ,
  subscription_expires  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── SALES TABLE ──
CREATE TABLE IF NOT EXISTS sales (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  qty         NUMERIC NOT NULL,
  price       NUMERIC NOT NULL,
  total       NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENSES TABLE ──
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVENTORY TABLE ──
CREATE TABLE IF NOT EXISTS inventory (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 0,
  low_threshold INTEGER NOT NULL DEFAULT 5,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENTS TABLE ──
CREATE TABLE IF NOT EXISTS payments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference   TEXT UNIQUE NOT NULL,
  amount      NUMERIC NOT NULL,
  currency    TEXT DEFAULT 'GHS',
  status      TEXT NOT NULL,
  paid_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ──
-- Users can only see their own data

ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments   ENABLE ROW LEVEL SECURITY;

-- Users policy
CREATE POLICY "users_own" ON users
  FOR ALL USING (id = auth.uid());

-- Sales policy
CREATE POLICY "sales_own" ON sales
  FOR ALL USING (user_id = auth.uid());

-- Expenses policy
CREATE POLICY "expenses_own" ON expenses
  FOR ALL USING (user_id = auth.uid());

-- Inventory policy
CREATE POLICY "inventory_own" ON inventory
  FOR ALL USING (user_id = auth.uid());

-- Payments policy
CREATE POLICY "payments_own" ON payments
  FOR ALL USING (user_id = auth.uid());

-- ── INDEXES for fast queries ──
CREATE INDEX IF NOT EXISTS idx_sales_user     ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user  ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date  ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);

-- ── DONE ──
SELECT 'SikaTrack database setup complete! 🇬🇭' AS message;
