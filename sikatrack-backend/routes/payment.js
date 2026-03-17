// ============================================================
// routes/payment.js — Paystack MoMo payments for SikaTrack
// ============================================================
const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const MONTHLY_AMOUNT  = 3000;   // GH₵30 in pesewas
const YEARLY_AMOUNT   = 27000;  // GH₵270 in pesewas

// ── Helper: activate Pro in Supabase ──────────────────────
async function activatePro(phone, plan) {
  try {
    const supabase = require('../supabase');
    const months   = plan === 'yearly' ? 12 : 1;
    const expiry   = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    const { error } = await supabase
      .from('users')
      .update({
        is_pro:     true,
        pro_plan:   plan,
        pro_since:  new Date().toISOString(),
        pro_expiry: expiry.toISOString(),
      })
      .eq('phone', phone);

    if (error) console.error('Supabase activatePro error:', error);
    return !error;
  } catch (err) {
    console.error('activatePro exception:', err);
    return false;
  }
}

// ── POST /payment/initiate ─────────────────────────────────
// Trader taps Pay → app calls this → returns Paystack auth_url
// Body: { phone, momoNumber, momoNetwork, plan }
router.post('/initiate', async (req, res) => {
  try {
    const { phone, momoNumber, momoNetwork, plan } = req.body;

    if (!phone || !momoNumber || !momoNetwork || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amount   = plan === 'yearly' ? YEARLY_AMOUNT : MONTHLY_AMOUNT;
    const ref      = `ST-${phone.slice(-6)}-${Date.now()}`;
    const network  = momoNetwork.toUpperCase(); // MTN or VDF

    // Map network codes for Paystack
    const networkMap = { 'MTN': 'mtn', 'VODAFONE': 'vod', 'VDF': 'vod', 'AIRTELTIGO': 'tgo' };
    const psNetwork  = networkMap[network] || 'mtn';

    // Format MoMo number — Paystack needs 0XXXXXXXXX format
    let formattedMomo = momoNumber.replace(/\D/g, '');
    if (formattedMomo.startsWith('233')) formattedMomo = '0' + formattedMomo.slice(3);
    if (!formattedMomo.startsWith('0'))  formattedMomo = '0' + formattedMomo;

    const payload = {
      amount,
      email:    `${phone}@sikatrack.app`,   // Paystack needs email; we generate one
      currency: 'GHS',
      reference: ref,
      mobile_money: {
        phone:   formattedMomo,
        provider: psNetwork,
      },
      metadata: {
        phone,
        plan,
        shopName: req.body.shopName || '',
        custom_fields: [
          { display_name: 'Trader Phone', variable_name: 'trader_phone', value: phone },
          { display_name: 'Plan',         variable_name: 'plan',         value: plan },
        ],
      },
    };

    const response = await fetch('https://api.paystack.co/charge', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.status) {
      console.error('Paystack charge error:', data);
      return res.status(400).json({ error: data.message || 'Payment initiation failed' });
    }

    // data.data.status can be: 'send_otp', 'pay_offline', 'pending', 'success'
    return res.json({
      status:    data.data.status,
      reference: ref,
      message:   data.data.display_text || data.message,
    });

  } catch (err) {
    console.error('Payment initiate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /payment/submit-otp ───────────────────────────────
// Vodafone Cash requires OTP — trader enters it here
// Body: { reference, otp }
router.post('/submit-otp', async (req, res) => {
  try {
    const { reference, otp } = req.body;
    if (!reference || !otp) return res.status(400).json({ error: 'Missing reference or OTP' });

    const response = await fetch('https://api.paystack.co/charge/submit_otp', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ reference, otp }),
    });

    const data = await response.json();
    return res.json({
      status:  data.data?.status,
      message: data.data?.display_text || data.message,
    });

  } catch (err) {
    console.error('Submit OTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /payment/verify ───────────────────────────────────
// App polls this to check if payment completed
// Body: { reference }
router.post('/verify', async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: 'Missing reference' });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET}` },
    });

    const data = await response.json();

    if (!data.status || !data.data) {
      return res.json({ paid: false, message: 'Transaction not found' });
    }

    const tx = data.data;

    if (tx.status === 'success') {
      const phone = tx.metadata?.phone;
      const plan  = tx.metadata?.plan || 'monthly';
      if (phone) await activatePro(phone, plan);
      return res.json({ paid: true, plan });
    }

    return res.json({ paid: false, status: tx.status });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /payment/webhook ──────────────────────────────────
// Paystack calls this automatically when payment succeeds
// Add this URL in Paystack Dashboard → Settings → Webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.body);

    if (event.event === 'charge.success') {
      const tx    = event.data;
      const phone = tx.metadata?.phone;
      const plan  = tx.metadata?.plan || 'monthly';

      if (phone) {
        const activated = await activatePro(phone, plan);
        console.log(`Pro activated for ${phone} (${plan}): ${activated}`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;