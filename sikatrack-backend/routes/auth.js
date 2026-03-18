// ============================================================
// routes/auth.js — Phone number OTP + PIN authentication
// ============================================================
const express  = require('express');
const jwt      = require('jsonwebtoken');
const supabase = require('../supabase');
const router   = express.Router();

const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhone(phone) {
  phone = phone.replace(/[\s-]/g, '');
  if (phone.startsWith('0')) phone = '233' + phone.slice(1);
  if (phone.startsWith('+233')) phone = phone.slice(1);
  if (!phone.startsWith('233')) phone = '233' + phone;
  return phone;
}

async function sendOTP(phone, otp) {
  try {
    const apiKey    = process.env.SENDEXA_API_KEY;
    const apiSecret = process.env.SENDEXA_API_SECRET;
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    // Use plain SMS — send OUR code directly in the message
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const body = {
      to:      formattedPhone,
      from:    'Exa Auth',
      message: `Your SikaTrack code is ${otp}. Valid for 10 minutes. Do not share.`,
    };

    console.log('Sending plain SMS to:', formattedPhone, 'OTP:', otp);

    const response = await fetch('https://api.sendexa.co/v1/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('Sendexa SMS response:', JSON.stringify(data));

    if (response.ok && data.success !== false) {
      console.log(`✅ SMS sent to ${formattedPhone}`);
    } else {
      console.error('Sendexa SMS failed:', data);
      console.log(`📱 FALLBACK OTP for ${phone}: ${otp}`);
    }
    return true;

  } catch (err) {
    console.error('Sendexa error:', err.message);
    console.log(`📱 FALLBACK OTP for ${phone}: ${otp}`);
    return true;
  }
}

/* ══════════════════════════════════
   POST /auth/send-otp
══════════════════════════════════ */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const formattedPhone = formatPhone(phone);

    if (!formattedPhone.match(/^233[0-9]{9}$/)) {
      return res.status(400).json({ error: 'Enter a valid Ghana phone number' });
    }

    const otp    = generateOTP();
    const expiry = Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) * 60 * 1000);
    otpStore.set(formattedPhone, { otp, expiry, name });
    await sendOTP(formattedPhone, otp);

    res.json({
      success: true,
      message: `OTP sent to ${formattedPhone}`,
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/* ══════════════════════════════════
   POST /auth/verify-otp
══════════════════════════════════ */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const formattedPhone = formatPhone(phone);
    const stored         = otpStore.get(formattedPhone);

    if (!stored) return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    if (Date.now() > stored.expiry) {
      otpStore.delete(formattedPhone);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Verify against our own generated OTP
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ error: 'Wrong OTP. Try again.' });
    }

    otpStore.delete(formattedPhone);

    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone:      formattedPhone,
          name:       stored.name || 'My Shop',
          plan:       'free',
          trial_ends: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) { console.error('Supabase insert error:', error); throw error; }
      user = newUser;
    }

    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id:         user.id,
        name:       user.name,
        phone:      user.phone,
        plan:       user.plan,
        trial_ends: user.trial_ends,
        has_pin:    !!user.pin
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* ══════════════════════════════════
   POST /auth/set-pin
══════════════════════════════════ */
router.post('/set-pin', requireAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    const { error } = await supabase
      .from('users')
      .update({ pin })
      .eq('id', req.userId);

    if (error) throw error;

    res.json({ success: true, message: 'PIN saved successfully' });
  } catch (err) {
    console.error('Set PIN error:', err);
    res.status(500).json({ error: 'Failed to save PIN' });
  }
});

/* ══════════════════════════════════
   POST /auth/verify-pin
══════════════════════════════════ */
router.post('/verify-pin', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ error: 'Phone and PIN are required' });

    const formattedPhone = formatPhone(phone);

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (!user) return res.status(400).json({ error: 'No account found for this number' });
    if (!user.pin) return res.status(400).json({ error: 'No PIN set. Please log in with OTP.' });
    if (user.pin !== pin) return res.status(400).json({ error: 'Wrong PIN. Try again.' });

    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id:         user.id,
        name:       user.name,
        phone:      user.phone,
        plan:       user.plan,
        trial_ends: user.trial_ends,
        has_pin:    true
      }
    });
  } catch (err) {
    console.error('Verify PIN error:', err);
    res.status(500).json({ error: 'PIN verification failed' });
  }
});

/* ══════════════════════════════════
   GET /auth/me
══════════════════════════════════ */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id:         user.id,
      name:       user.name,
      phone:      user.phone,
      plan:       user.plan,
      trial_ends: user.trial_ends,
      has_pin:    !!user.pin
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/* ── Auth middleware ── */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.userId    = decoded.userId;
    req.phone     = decoded.phone;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;