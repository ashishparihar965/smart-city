const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema, createUserSchema } = require('../validations/authSchemas');
const router = express.Router();

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip;
};

// POST /api/auth/register — public registration defaults to 'user' role
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, zone, phone } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Public registration always creates 'user' role
    const user = await User.create({
      name, email, password,
      role: 'user',
      department: 'general',
      zone: zone || 'central',
      phone: phone || ''
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      action: 'User Registered',
      module: 'auth',
      details: `New citizen account created for ${user.email} (zone: ${user.zone})`
    });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, zone: user.zone },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const clientIp = getClientIp(req);
    console.info(`[AUTH][LOGIN_ATTEMPT] email=${normalizedEmail || 'missing'} ip=${clientIp}`);

    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      console.warn(`[AUTH][LOGIN_FAILED] reason=user_not_found email=${normalizedEmail} ip=${clientIp}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      console.warn(`[AUTH][LOGIN_FAILED] reason=inactive_account email=${normalizedEmail} userId=${user._id} ip=${clientIp}`);
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.warn(`[AUTH][LOGIN_FAILED] reason=invalid_password email=${normalizedEmail} userId=${user._id} ip=${clientIp}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    await ActivityLog.create({
      userId: user._id,
      userName: user.name,
      action: 'User Login',
      module: 'auth',
      details: `${user.role} logged in`
    });

    console.info(`[AUTH][LOGIN_SUCCESS] userId=${user._id} role=${user.role} email=${normalizedEmail} ip=${clientIp}`);

    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, zone: user.zone },
        token
      }
    });
  } catch (error) {
    console.error('[AUTH][LOGIN_ERROR]', {
      email: String(req.body?.email || '').trim().toLowerCase(),
      ip: getClientIp(req),
      message: error.message,
    });
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ success: true, data: req.user });
});

// ──── Admin: User Management ────

// GET /api/auth/users — list all users (admin only)
router.get('/users', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { role, zone } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (zone) filter.zone = zone;
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) { next(error); }
});

// GET /api/auth/operators — list operators (admin only, for assignment dropdowns)
router.get('/operators', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const operators = await User.find({ role: 'operator', isActive: true }).select('name email department zone');
    res.json({ success: true, data: operators });
  } catch (error) { next(error); }
});

// POST /api/auth/users — admin creates operator/admin accounts
router.post('/users', auth, roleCheck('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, department, zone, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });

    const user = await User.create({
      name, email, password, role,
      department: department || 'general',
      zone: zone || 'central',
      phone: phone || ''
    });

    await ActivityLog.create({
      userId: req.user.id, userName: req.user.name,
      action: 'Created User', module: 'auth',
      details: `Admin created ${role} account: ${email} (zone: ${zone || 'central'})`
    });

    res.status(201).json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department, zone: user.zone }
    });
  } catch (error) { next(error); }
});

module.exports = router;
