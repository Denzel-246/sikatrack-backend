// ============================================================
// supabase.js — Supabase client
// ============================================================
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY  // service_role key — bypasses RLS safely from backend
);

module.exports = supabase;