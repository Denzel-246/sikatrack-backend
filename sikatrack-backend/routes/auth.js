// ============================================================
// routes/auth.js — Phone number OTP authentication
// ============================================================
const express  = require('express');
const jwt      = require('jsonwebtoken');
const supabase = require('../supabase');
const router   = express.Router();

/* ── In-memory OTP store (works for small scale) ── */
/* For production use Redis or store in Supabase */
const otpStore = new Map();

/* ── Generate 6-digit OTP ── */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ── Format Ghana phone number ── */
function formatPhone(phone) {
  // Remove spaces and dashes
  phone = phone.replace(/[\s-]/g, '');
  // Add Ghana country code if not present
  if (phone.startsWith('0')) phone = '+233' + phone.slice(1);
  if (!phone.startsWith('+')) phone = '+233' + phone;
  return phone;
}

/* ── Send OTP via console (replace with SMS provider later) ── */
async function sendOTP(phone, otp) {
  // For now we log it — in production integrate with
  // Hubtel SMS, mNotify, or Africa's Talking for Ghana SMS
  console.log(`\n📱 OTP for ${phone}: ${otp}\n`);
  // TODO: Replace with real SMS sending:
  // await sendSMS(phone, `Your SikaTrack OTP is: ${otp}. Valid for 10 minutes.`);
  return true;
}

/* ══════════════════════════════════
   POST /auth/send-otp
   Send OTP to phone number
══════════════════════════════════ */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const formattedPhone = formatPhone(phone);

    // Validate Ghana phone number
    if (!formattedPhone.match(/^\+233[0-9]{9}$/)) {
      return res.status(400).json({ error: 'Enter a valid Ghana phone number' });
    }

    // Generate OTP
    const otp     = generateOTP();
    const expiry  = Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) * 60 * 1000);

    // Store OTP
    otpStore.set(formattedPhone, { otp, expiry, name });

    // Send OTP
    await sendOTP(formattedPhone, otp);

    res.json({
      success: true,
      message: `OTP sent to ${formattedPhone}`,
      // Remove this in production — only for testing:
      dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/* ══════════════════════════════════
   POST /auth/verify-otp
   Verify OTP and log in / sign up
══════════════════════════════════ */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });

    const formattedPhone = formatPhone(phone);
    const stored         = otpStore.get(formattedPhone);

    // Check OTP exists
    if (!stored) return res.status(400).json({ error: 'No OTP found. Please request a new one.' });

    // Check OTP expiry
    if (Date.now() > stored.expiry) {
      otpStore.delete(formattedPhone);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Check OTP matches
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ error: 'Wrong OTP. Try again.' });
    }

    // OTP is valid — clear it
    otpStore.delete(formattedPhone);

    // Check if user exists in Supabase
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    // If no user — create one
    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone:        formattedPhone,
          name:         stored.name || 'My Shop',
          plan:         'free',
          trial_ends:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 day trial
          created_at:   new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      user = newUser;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id:          user.id,
        name:        user.name,
        phone:       user.phone,
        plan:        user.plan,
        trial_ends:  user.trial_ends
      }
    });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/* ══════════════════════════════════
   GET /auth/me
   Get current user info
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
      trial_ends: user.trial_ends
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
