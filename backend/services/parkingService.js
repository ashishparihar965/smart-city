const crypto = require('crypto');
const QRCode = require('qrcode');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const ActivityLog = require('../models/ActivityLog');
const { getIo } = require('../utils/socket');

const SLOT_LOCK_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const QR_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// ─── HELPERS ───────────────────────────────────────────────────

function getHmacSecret() {
  return process.env.JWT_SECRET || 'parking-secret-fallback';
}

function signPayload(data) {
  const json = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', getHmacSecret()).update(json).digest('hex');
  return Buffer.from(JSON.stringify({ data, hmac })).toString('base64');
}

function verifyPayload(encoded) {
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    const { data, hmac } = decoded;
    const expected = crypto.createHmac('sha256', getHmacSecret()).update(JSON.stringify(data)).digest('hex');
    if (hmac !== expected) return null;
    return data;
  } catch {
    return null;
  }
}

function emitParkingUpdate(parkingId, eventData) {
  const io = getIo();
  if (io) {
    io.to(`parking:${parkingId}`).emit('parking:slot_update', eventData);
    io.emit('parking:global_update', { parkingId, ...eventData });
  }
}

// ─── SLOT MANAGEMENT ───────────────────────────────────────────

/**
 * Auto-create slot documents when admin adds a parking location.
 */
async function autoCreateSlots(parkingId, totalSlots, allowedVehicles) {
  const slots = [];
  for (const type of allowedVehicles) {
    const count = totalSlots[type] || 0;
    for (let i = 1; i <= count; i++) {
      const prefix = type.charAt(0).toUpperCase();
      slots.push({
        parkingId,
        vehicleType: type,
        slotNumber: `${prefix}${String(i).padStart(3, '0')}`,
        status: 'available'
      });
    }
  }
  if (slots.length > 0) {
    await ParkingSlot.insertMany(slots, { ordered: false });
  }
  return slots.length;
}

/**
 * Atomically lock a slot for 2 minutes. Concurrency-safe via findOneAndUpdate.
 */
async function lockSlot(slotId, userId) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + SLOT_LOCK_DURATION_MS);

  // Atomic: only succeeds if slot is available OR lock has expired
  const slot = await ParkingSlot.findOneAndUpdate(
    {
      _id: slotId,
      $or: [
        { status: 'available' },
        { status: 'reserved', lockedUntil: { $lt: now } } // expired lock
      ]
    },
    {
      $set: {
        status: 'reserved',
        lockedBy: userId,
        lockedUntil
      }
    },
    { new: true }
  );

  if (!slot) {
    throw new Error('Slot is not available or is already locked by another user.');
  }

  emitParkingUpdate(slot.parkingId.toString(), {
    slotId: slot._id,
    slotNumber: slot.slotNumber,
    vehicleType: slot.vehicleType,
    status: 'reserved'
  });

  return slot;
}

/**
 * Release a slot back to available.
 */
async function releaseSlot(slotId) {
  const slot = await ParkingSlot.findByIdAndUpdate(
    slotId,
    {
      $set: {
        status: 'available',
        lockedBy: null,
        lockedUntil: null,
        currentBookingId: null
      }
    },
    { new: true }
  );

  if (slot) {
    emitParkingUpdate(slot.parkingId.toString(), {
      slotId: slot._id,
      slotNumber: slot.slotNumber,
      vehicleType: slot.vehicleType,
      status: 'available'
    });
  }
  return slot;
}

/**
 * Get availability summary for a parking location.
 */
async function getAvailability(parkingId) {
  const pipeline = [
    { $match: { parkingId: require('mongoose').Types.ObjectId.createFromHexString(parkingId) } },
    {
      $group: {
        _id: { vehicleType: '$vehicleType', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ];

  const results = await ParkingSlot.aggregate(pipeline);

  const summary = {};
  for (const r of results) {
    const { vehicleType, status } = r._id;
    if (!summary[vehicleType]) {
      summary[vehicleType] = { available: 0, reserved: 0, occupied: 0, total: 0 };
    }
    summary[vehicleType][status] = r.count;
    summary[vehicleType].total += r.count;
  }

  return summary;
}

// ─── BOOKING ───────────────────────────────────────────────────

/**
 * Create a booking after slot is locked.
 */
async function createBooking(userId, { parkingId, slotId, vehicleNumber, vehicleType, durationMinutes }) {
  // Verify slot is locked by this user
  const slot = await ParkingSlot.findOne({
    _id: slotId,
    parkingId,
    status: 'reserved',
    lockedBy: userId,
    lockedUntil: { $gt: new Date() }
  });

  if (!slot) {
    throw new Error('Slot lock expired or not locked by you. Please select a slot again.');
  }

  // Get parking info for pricing
  const parking = await ParkingLocation.findById(parkingId);
  if (!parking || !parking.isActive) {
    throw new Error('Parking location not found or inactive.');
  }

  const now = new Date();
  const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

  // Calculate amount
  const hours = Math.ceil(durationMinutes / 60);
  const pricePerHour = parking.isPaid ? (parking.pricePerHour[vehicleType] || 0) : 0;
  const amount = parking.isPaid ? hours * pricePerHour : 0;

  // Create booking
  const booking = await Booking.create({
    userId,
    parkingId,
    slotId,
    vehicleNumber,
    vehicleType,
    startTime: now,
    endTime,
    duration: durationMinutes,
    amount,
    isPaid: parking.isPaid,
    status: parking.isPaid ? 'pending' : 'active' // free = instant active
  });

  // Generate QR
  const qrExpiresAt = new Date(now.getTime() + QR_EXPIRY_MS);
  const qrPayload = signPayload({
    bookingId: booking._id.toString(),
    slotNumber: slot.slotNumber,
    vehicleNumber,
    parkingId: parkingId.toString(),
    expiresAt: qrExpiresAt.toISOString()
  });
  const qrImage = await QRCode.toDataURL(qrPayload, { width: 300, margin: 2 });

  booking.qrCode = qrImage;
  booking.qrPayload = qrPayload;
  booking.qrExpiresAt = qrExpiresAt;
  await booking.save();

  // If free parking, mark slot occupied immediately
  if (!parking.isPaid) {
    await ParkingSlot.findByIdAndUpdate(slotId, {
      status: 'occupied',
      lockedBy: null,
      lockedUntil: null,
      currentBookingId: booking._id
    });

    // Create free payment record
    await Payment.create({
      bookingId: booking._id,
      userId,
      amount: 0,
      status: 'success',
      paymentMethod: 'free',
      transactionId: `FREE-${booking._id}`,
      description: 'Free parking - no charge'
    });

    emitParkingUpdate(parkingId.toString(), {
      slotId: slot._id,
      slotNumber: slot.slotNumber,
      vehicleType: slot.vehicleType,
      status: 'occupied'
    });
  }

  return booking;
}

/**
 * Confirm a paid booking after payment.
 */
async function confirmBooking(bookingId, userId, paymentData = {}) {
  const booking = await Booking.findOne({ _id: bookingId, userId, status: 'pending' });
  if (!booking) {
    throw new Error('Booking not found or already processed.');
  }

  // Simulate payment processing (in production, integrate Razorpay/Stripe here)
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const payment = await Payment.create({
    bookingId: booking._id,
    userId,
    amount: booking.amount,
    status: 'success',
    paymentMethod: paymentData.method || 'upi',
    transactionId,
    description: `Parking payment for ${booking.vehicleNumber}`
  });

  // Activate booking
  booking.status = 'active';
  await booking.save();

  // Mark slot as occupied
  await ParkingSlot.findByIdAndUpdate(booking.slotId, {
    status: 'occupied',
    lockedBy: null,
    lockedUntil: null,
    currentBookingId: booking._id
  });

  emitParkingUpdate(booking.parkingId.toString(), {
    slotId: booking.slotId,
    status: 'occupied',
    bookingId: booking._id
  });

  return { booking, payment };
}

/**
 * Cancel a booking and release the slot.
 */
async function cancelBooking(bookingId, userId) {
  const booking = await Booking.findOne({
    _id: bookingId,
    userId,
    status: { $in: ['pending', 'active'] }
  });

  if (!booking) {
    throw new Error('Booking not found or cannot be cancelled.');
  }

  booking.status = 'cancelled';
  await booking.save();

  // Release the slot
  await releaseSlot(booking.slotId);

  // If paid and was active, create refund record
  if (booking.isPaid && booking.amount > 0) {
    const originalPayment = await Payment.findOne({ bookingId: booking._id, status: 'success' });
    if (originalPayment) {
      await Payment.create({
        bookingId: booking._id,
        userId,
        amount: -booking.amount,
        status: 'refunded',
        paymentMethod: originalPayment.paymentMethod,
        transactionId: `REFUND-${originalPayment.transactionId}`,
        description: 'Booking cancelled - refund initiated'
      });
    }
  }

  return booking;
}

/**
 * Extend a booking's duration.
 */
async function extendBooking(bookingId, userId, additionalMinutes) {
  const booking = await Booking.findOne({ _id: bookingId, userId, status: 'active' });
  if (!booking) {
    throw new Error('Active booking not found.');
  }

  const parking = await ParkingLocation.findById(booking.parkingId);
  const oldEndTime = booking.endTime;
  booking.endTime = new Date(oldEndTime.getTime() + additionalMinutes * 60 * 1000);
  booking.duration += additionalMinutes;

  // Calculate extra cost
  if (parking.isPaid) {
    const extraHours = Math.ceil(additionalMinutes / 60);
    const extraAmount = extraHours * (parking.pricePerHour[booking.vehicleType] || 0);
    booking.amount += extraAmount;

    // Create extension payment
    await Payment.create({
      bookingId: booking._id,
      userId,
      amount: extraAmount,
      status: 'success',
      paymentMethod: 'upi',
      transactionId: `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      description: `Extended parking by ${additionalMinutes} min`
    });
  }

  await booking.save();
  return booking;
}

// ─── QR VALIDATION ─────────────────────────────────────────────

/**
 * Validate QR code at parking entry.
 */
async function validateQR(qrData) {
  const payload = verifyPayload(qrData);
  if (!payload) {
    return { valid: false, message: 'Invalid or tampered QR code.' };
  }

  // Check QR expiry
  if (new Date(payload.expiresAt) < new Date()) {
    return { valid: false, message: 'QR code has expired.' };
  }

  // Find booking
  const booking = await Booking.findById(payload.bookingId).populate('parkingId', 'name address');
  if (!booking) {
    return { valid: false, message: 'Booking not found.' };
  }

  if (booking.qrUsed) {
    return { valid: false, message: 'QR code already used.' };
  }

  if (booking.status !== 'active') {
    return { valid: false, message: `Booking is ${booking.status}. Entry not allowed.` };
  }

  // Mark QR as used
  booking.qrUsed = true;
  await booking.save();

  return {
    valid: true,
    message: 'Entry allowed.',
    booking: {
      id: booking._id,
      vehicleNumber: booking.vehicleNumber,
      vehicleType: booking.vehicleType,
      slotNumber: payload.slotNumber,
      parkingName: booking.parkingId?.name,
      startTime: booking.startTime,
      endTime: booking.endTime
    }
  };
}

// ─── ADMIN ────────────────────────────────────────────────────

/**
 * Get admin dashboard stats.
 */
async function getAdminDashboard() {
  const [locations, slotStats, revenueData, activeBookings] = await Promise.all([
    ParkingLocation.countDocuments({ isActive: true }),
    ParkingSlot.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Payment.aggregate([
      { $match: { status: 'success', amount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]),
    Booking.countDocuments({ status: 'active' })
  ]);

  // Today's revenue
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayRevenue = await Payment.aggregate([
    { $match: { status: 'success', amount: { $gt: 0 }, createdAt: { $gte: startOfDay } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const slots = { available: 0, reserved: 0, occupied: 0, total: 0 };
  for (const s of slotStats) {
    slots[s._id] = s.count;
    slots.total += s.count;
  }

  return {
    locations,
    slots,
    activeBookings,
    totalRevenue: revenueData[0]?.totalRevenue || 0,
    totalTransactions: revenueData[0]?.totalTransactions || 0,
    dailyRevenue: todayRevenue[0]?.total || 0
  };
}

/**
 * Force-change a slot's status (admin action).
 */
async function forceSlotStatus(slotId, newStatus, adminUser) {
  const slot = await ParkingSlot.findById(slotId);
  if (!slot) throw new Error('Slot not found.');

  // If forcing to available, cancel any active booking
  if (newStatus === 'available' && slot.currentBookingId) {
    await Booking.findByIdAndUpdate(slot.currentBookingId, { status: 'cancelled' });
  }

  slot.status = newStatus;
  if (newStatus === 'available') {
    slot.lockedBy = null;
    slot.lockedUntil = null;
    slot.currentBookingId = null;
  }
  await slot.save();

  await ActivityLog.create({
    userId: adminUser.id,
    userName: adminUser.name,
    action: 'Force Changed Slot Status',
    module: 'parking',
    details: `Changed slot ${slot.slotNumber} to ${newStatus}`
  });

  emitParkingUpdate(slot.parkingId.toString(), {
    slotId: slot._id,
    slotNumber: slot.slotNumber,
    vehicleType: slot.vehicleType,
    status: newStatus
  });

  return slot;
}

// ─── CRON HANDLERS ─────────────────────────────────────────────

/**
 * Release expired slot locks (called by cron every minute).
 */
async function releaseExpiredLocks() {
  const now = new Date();
  // Find reserved slots with expired locks that have no active booking
  const expiredSlots = await ParkingSlot.find({
    status: 'reserved',
    lockedUntil: { $lt: now },
    currentBookingId: null
  });

  for (const slot of expiredSlots) {
    // Verify no pending booking exists for this slot
    const pendingBooking = await Booking.findOne({ slotId: slot._id, status: 'pending' });
    if (!pendingBooking) {
      await releaseSlot(slot._id);
    }
  }

  return expiredSlots.length;
}

/**
 * Auto-expire bookings past endTime (called by cron every minute).
 */
async function expireEndedBookings() {
  const now = new Date();
  const expired = await Booking.find({
    status: 'active',
    endTime: { $lt: now }
  });

  for (const booking of expired) {
    booking.status = 'completed';
    await booking.save();
    await releaseSlot(booking.slotId);
  }

  return expired.length;
}

/**
 * Auto-cancel bookings with expired QR that were never activated.
 */
async function cancelExpiredQRBookings() {
  const now = new Date();
  const expired = await Booking.find({
    status: 'pending',
    qrExpiresAt: { $lt: now }
  });

  for (const booking of expired) {
    booking.status = 'expired';
    await booking.save();
    await releaseSlot(booking.slotId);
  }

  return expired.length;
}

module.exports = {
  autoCreateSlots,
  lockSlot,
  releaseSlot,
  getAvailability,
  createBooking,
  confirmBooking,
  cancelBooking,
  extendBooking,
  validateQR,
  getAdminDashboard,
  forceSlotStatus,
  releaseExpiredLocks,
  expireEndedBookings,
  cancelExpiredQRBookings
};
