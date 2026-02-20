// ============================================================
// routes/expenses.js — Expenses CRUD
// ============================================================
const express  = require('express');
const supabase = require('../supabase');
const { requireAuth } = require('./auth');
const router   = express.Router();

router.use(requireAuth);

/* ── GET /expenses ── */
router.get('/', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (from)   query = query.gte('created_at', from);
    if (to)     query = query.lte('created_at', to + 'T23:59:59');
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

/* ── POST /expenses ── */
router.post('/', async (req, res) => {
  try {
    const { name, amount } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount are required' });

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id:    req.userId,
        name,
        amount:     parseFloat(amount),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

/* ── DELETE /expenses/:id ── */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

/* ── DELETE /expenses — Clear all ── */
router.delete('/', async (req, res) => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear expenses' });
  }
});

module.exports = router;
