// ============================================================
// routes/payments.js — Paystack subscription payments
// ============================================================
const express  = require('express');
const axios    = require('axios');
const supabase = require('../supabase');
const { requireAuth } = require('./auth');
const router   = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const MONTHLY_AMOUNT  = 2000; // GHS 20.00 in pesewas (Paystack uses pesewas)
const PLAN_CODE       = process.env.PAYSTACK_PLAN_CODE || ''; // set after creating plan

/* ── GET /payments/status — Check subscription status ── */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('plan, trial_ends, subscription_expires')
      .eq('id', req.userId)
      .single();

    const now         = new Date();
    const trialEnd    = new Date(user.trial_ends);
    const subEnd      = user.subscription_expires ? new Date(user.subscription_expires) : null;
    const isOnTrial   = user.plan === 'free' && trialEnd > now;
    const isSubscribed= user.plan === 'paid'  && subEnd && subEnd > now;
    const hasAccess   = isOnTrial || isSubscribed;

    res.json({
      plan:                user.plan,
      has_access:          hasAccess,
      is_on_trial:         isOnTrial,
      trial_ends:          user.trial_ends,
      subscription_expires:user.subscription_expires,
      days_left:           isOnTrial
        ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
        : isSubscribed
          ? Math.ceil((subEnd - now) / (1000 * 60 * 60 * 24))
          : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

/* ── POST /payments/initialize — Start payment ── */
router.post('/initialize', requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    /* Initialize Paystack transaction */
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email:      `${user.phone.replace('+', '')}@sikatrack.app`, // fake email for Paystack
        amount:     MONTHLY_AMOUNT,
        currency:   'GHS',
        reference:  `ST_${req.userId}_${Date.now()}`,
        metadata: {
          user_id:    req.userId,
          phone:      user.phone,
          plan:       'monthly'
        },
        callback_url: `${process.env.APP_URL || 'http://localhost:3000'}/payments/verify`
      },
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
      }
    );

    res.json({
      payment_url:  response.data.data.authorization_url,
      reference:    response.data.data.reference
    });
  } catch (err) {
    console.error('Payment init error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

/* ── GET /payments/verify — Verify payment after redirect ── */
router.get('/verify', async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ error: 'Reference required' });

    /* Verify with Paystack */
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const payment = response.data.data;
    if (payment.status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const userId = payment.metadata.user_id;

    /* Update user subscription — add 30 days */
    const { data: user } = await supabase
      .from('users')
      .select('subscription_expires')
      .eq('id', userId)
      .single();

    const currentExpiry = user.subscription_expires
      ? new Date(user.subscription_expires)
      : new Date();

    const newExpiry = currentExpiry > new Date()
      ? new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000)
      : new Date(Date.now()           + 30 * 24 * 60 * 60 * 1000);

    await supabase
      .from('users')
      .update({
        plan:                 'paid',
        subscription_expires: newExpiry.toISOString()
      })
      .eq('id', userId);

    /* Save payment record */
    await supabase
      .from('payments')
      .insert({
        user_id:   userId,
        reference,
        amount:    payment.amount / 100,
        currency:  'GHS',
        status:    'success',
        paid_at:   new Date().toISOString()
      });

    /* Redirect back to app */
    res.redirect(`${process.env.FRONTEND_URL || '/'}?payment=success`);

  } catch (err) {
    console.error('Payment verify error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || '/'}?payment=failed`);
  }
});

/* ── POST /payments/webhook — Paystack webhook ── */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const crypto = require('crypto');
  const hash   = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  if (event.event === 'charge.success') {
    const userId = event.data.metadata?.user_id;
    if (userId) {
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await supabase
        .from('users')
        .update({ plan: 'paid', subscription_expires: newExpiry.toISOString() })
        .eq('id', userId);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
