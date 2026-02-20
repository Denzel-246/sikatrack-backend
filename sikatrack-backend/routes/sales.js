// ============================================================
// routes/sales.js — Sales CRUD
// ============================================================
const express  = require('express');
const supabase = require('../supabase');
const { requireAuth } = require('./auth');
const router   = express.Router();

/* All routes require login */
router.use(requireAuth);

/* ── GET /sales — Get all sales for this user ── */
router.get('/', async (req, res) => {
  try {
    const { from, to, search } = req.query;
    let query = supabase
      .from('sales')
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
    res.status(500).json({ error: 'Failed to get sales' });
  }
});

/* ── POST /sales — Add a sale ── */
router.post('/', async (req, res) => {
  try {
    const { name, qty, price } = req.body;
    if (!name || !qty || !price) return res.status(400).json({ error: 'Name, qty and price are required' });

    const total = parseFloat(qty) * parseFloat(price);

    const { data, error } = await supabase
      .from('sales')
      .insert({
        user_id:    req.userId,
        name,
        qty:        parseFloat(qty),
        price:      parseFloat(price),
        total,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    /* Auto deduct from inventory if item exists */
    const { data: invItem } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.userId)
      .ilike('name', name)
      .single();

    if (invItem) {
      await supabase
        .from('inventory')
        .update({ qty: Math.max(0, invItem.qty - parseFloat(qty)) })
        .eq('id', invItem.id);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add sale' });
  }
});

/* ── DELETE /sales/:id — Delete a sale ── */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId); // security — can only delete own sales

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete sale' });
  }
});

/* ── DELETE /sales — Clear all sales ── */
router.delete('/', async (req, res) => {
  try {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear sales' });
  }
});

module.exports = router;
