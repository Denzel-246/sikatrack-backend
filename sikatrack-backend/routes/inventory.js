// ============================================================
// routes/inventory.js — Inventory CRUD
// ============================================================
const express  = require('express');
const supabase = require('../supabase');
const { requireAuth } = require('./auth');
const router   = express.Router();

router.use(requireAuth);

/* ── GET /inventory ── */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', req.userId)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

/* ── POST /inventory ── */
router.post('/', async (req, res) => {
  try {
    const { name, qty, low_threshold } = req.body;
    if (!name || qty === undefined) return res.status(400).json({ error: 'Name and qty are required' });

    /* Check if item already exists */
    const { data: existing } = await supabase
      .from('inventory')
      .select('id')
      .eq('user_id', req.userId)
      .ilike('name', name)
      .single();

    if (existing) return res.status(400).json({ error: 'Item already in inventory' });

    const { data, error } = await supabase
      .from('inventory')
      .insert({
        user_id:       req.userId,
        name,
        qty:           parseInt(qty),
        low_threshold: parseInt(low_threshold) || 5,
        created_at:    new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

/* ── PATCH /inventory/:id — Adjust stock ── */
router.patch('/:id', async (req, res) => {
  try {
    const { qty, delta } = req.body;

    /* Get current item */
    const { data: item } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const newQty = delta !== undefined
      ? Math.max(0, item.qty + parseInt(delta))
      : parseInt(qty);

    const { data, error } = await supabase
      .from('inventory')
      .update({ qty: newQty })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

/* ── DELETE /inventory/:id ── */
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

module.exports = router;
