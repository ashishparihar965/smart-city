const express = require('express');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const parkingService = require('../services/parkingService');
const router = express.Router();

// ════════════════════════════════════════════════════════════════
//  IMPORTANT: Static/fixed routes MUST come BEFORE /:id routes
//  Otherwise Express matches "booking", "admin", "qr" as :id
// ════════════════════════════════════════════════════════════════

// ── ADMIN APIs (static prefix /admin/*) ────────────────────────
// These MUST be before /:id to prevent /admin matching as :id

// GET /api/parking/admin/dashboard — Admin dashboard stats
router.get('/admin/dashboard', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const stats = await parkingService.getAdminDashboard();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/parking/admin/locations — All locations for admin (including inactive)
router.get('/admin/locations', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const locations = await ParkingLocation.find().sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      locations.map(async (loc) => {
        const availability = await parkingService.getAvailability(loc._id.toString());
        return { ...loc, availability };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// GET /api/parking/admin/bookings — All bookings (admin view)
router.get('/admin/bookings', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { status, parkingId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (parkingId) filter.parkingId = parkingId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name email')
        .populate('parkingId', 'name')
        .populate('slotId', 'slotNumber')
        .lean(),
      Booking.countDocuments(filter)
    ]);

    res.json({ success: true, data: bookings, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    next(error);
  }
});

// POST /api/parking/admin/add — Add parking location
router.post('/admin/add', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { name, address, latitude, longitude, allowedVehicles, totalSlots, isPaid, pricePerHour, operatingHours, contactPhone } = req.body;

    if (!name || !address || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Name, address, and coordinates are required.' });
    }

    const location = await ParkingLocation.create({
      name, address, latitude, longitude,
      allowedVehicles: allowedVehicles || ['bike', 'car'],
      totalSlots: totalSlots || {},
      isPaid: isPaid || false,
      pricePerHour: pricePerHour || {},
      operatingHours: operatingHours || {},
      contactPhone: contactPhone || ''
    });

    // Auto-create slot documents
    const slotCount = await parkingService.autoCreateSlots(
      location._id,
      location.totalSlots,
      location.allowedVehicles
    );

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Added Parking Location',
      module: 'parking',
      details: `Created "${name}" with ${slotCount} slots`
    });

    res.status(201).json({ success: true, data: location, slotsCreated: slotCount });
  } catch (error) {
    next(error);
  }
});

// PUT /api/parking/admin/slot/:id/status — Force change slot status
router.put('/admin/slot/:id/status', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['available', 'reserved', 'occupied'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const slot = await parkingService.forceSlotStatus(req.params.id, status, req.user);
    res.json({ success: true, data: slot, message: `Slot status changed to ${status}.` });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// GET /api/parking/admin/:id/slots — All slots for a location
router.get('/admin/:id/slots', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const slots = await ParkingSlot.find({ parkingId: req.params.id })
      .sort({ slotNumber: 1 })
      .populate('currentBookingId', 'vehicleNumber vehicleType startTime endTime')
      .lean();

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
});

// PUT /api/parking/admin/:id — Update parking location
router.put('/admin/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const location = await ParkingLocation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!location) return res.status(404).json({ success: false, message: 'Location not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Updated Parking Location',
      module: 'parking',
      details: `Updated "${location.name}"`
    });

    res.json({ success: true, data: location });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/parking/admin/:id — Deactivate parking location
router.delete('/admin/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const location = await ParkingLocation.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!location) return res.status(404).json({ success: false, message: 'Location not found.' });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Deactivated Parking Location',
      module: 'parking',
      details: `Deactivated "${location.name}"`
    });

    res.json({ success: true, message: 'Parking location deactivated.' });
  } catch (error) {
    next(error);
  }
});

// ── BOOKING APIs (static prefix /booking/*) ────────────────────
// These MUST be before /:id to prevent /booking matching as :id

// GET /api/parking/booking/my — My bookings
router.get('/booking/my', auth, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user.id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate('parkingId', 'name address latitude longitude isPaid pricePerHour')
      .populate('slotId', 'slotNumber vehicleType')
      .lean();

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

// POST /api/parking/booking/create — Create a booking
router.post('/booking/create', auth, async (req, res, next) => {
  try {
    const { parkingId, slotId, vehicleNumber, vehicleType, durationMinutes } = req.body;

    if (!parkingId || !slotId || !vehicleNumber || !vehicleType || !durationMinutes) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (durationMinutes < 15 || durationMinutes > 1440) {
      return res.status(400).json({ success: false, message: 'Duration must be between 15 min and 24 hours.' });
    }

    const booking = await parkingService.createBooking(req.user.id, {
      parkingId, slotId, vehicleNumber, vehicleType, durationMinutes
    });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Created Parking Booking',
      module: 'parking',
      details: `Booked slot for ${vehicleNumber} (${vehicleType}) for ${durationMinutes} min`
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('not found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// POST /api/parking/booking/:id/confirm — Confirm paid booking
router.post('/booking/:id/confirm', auth, async (req, res, next) => {
  try {
    const result = await parkingService.confirmBooking(req.params.id, req.user.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('processed')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// POST /api/parking/booking/:id/cancel — Cancel booking
router.post('/booking/:id/cancel', auth, async (req, res, next) => {
  try {
    const booking = await parkingService.cancelBooking(req.params.id, req.user.id);

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Cancelled Parking Booking',
      module: 'parking',
      details: `Cancelled booking for ${booking.vehicleNumber}`
    });

    res.json({ success: true, data: booking, message: 'Booking cancelled.' });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('cannot')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// POST /api/parking/booking/:id/extend — Extend booking
router.post('/booking/:id/extend', auth, async (req, res, next) => {
  try {
    const { additionalMinutes } = req.body;
    if (!additionalMinutes || additionalMinutes < 15) {
      return res.status(400).json({ success: false, message: 'Minimum extension is 15 minutes.' });
    }

    const booking = await parkingService.extendBooking(req.params.id, req.user.id, additionalMinutes);
    res.json({ success: true, data: booking, message: `Booking extended by ${additionalMinutes} minutes.` });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// ── QR APIs (static prefix /qr/*) ────────────────────────────
// Must be before /:id

// POST /api/parking/qr/validate — Validate QR at entry
router.post('/qr/validate', auth, async (req, res, next) => {
  try {
    const { qrData } = req.body;
    if (!qrData) return res.status(400).json({ success: false, message: 'QR data required.' });

    const result = await parkingService.validateQR(qrData);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════
//  CITIZEN APIs — Parametric /:id routes (MUST BE LAST)
// ════════════════════════════════════════════════════════════════

// GET /api/parking — List all active parking locations with availability
router.get('/', auth, async (req, res, next) => {
  try {
    const { vehicleType, search } = req.query;
    const filter = { isActive: true };
    if (vehicleType) filter.allowedVehicles = vehicleType;

    let locations = await ParkingLocation.find(filter).sort({ createdAt: -1 }).lean();

    // Attach availability summary to each location
    const enriched = await Promise.all(
      locations.map(async (loc) => {
        const availability = await parkingService.getAvailability(loc._id.toString());
        let totalAvailable = 0;
        let totalSlots = 0;
        for (const vt of Object.keys(availability)) {
          totalAvailable += availability[vt].available;
          totalSlots += availability[vt].total;
        }
        return {
          ...loc,
          availability,
          totalAvailable,
          totalSlots,
          availabilityStatus:
            totalSlots === 0 ? 'empty' :
            totalAvailable === 0 ? 'full' :
            totalAvailable <= Math.ceil(totalSlots * 0.2) ? 'limited' : 'available'
        };
      })
    );

    if (search) {
      const s = search.toLowerCase();
      const filtered = enriched.filter(
        (l) => l.name.toLowerCase().includes(s) || l.address.toLowerCase().includes(s)
      );
      return res.json({ success: true, data: filtered, total: filtered.length });
    }

    res.json({ success: true, data: enriched, total: enriched.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/parking/:id — Parking details (MUST be after all static routes)
router.get('/:id', auth, async (req, res, next) => {
  try {
    const location = await ParkingLocation.findById(req.params.id).lean();
    if (!location) return res.status(404).json({ success: false, message: 'Parking location not found.' });

    const availability = await parkingService.getAvailability(req.params.id);
    res.json({ success: true, data: { ...location, availability } });
  } catch (error) {
    next(error);
  }
});

// GET /api/parking/:id/slots — Available slots by vehicle type
router.get('/:id/slots', auth, async (req, res, next) => {
  try {
    const { vehicleType } = req.query;
    const filter = { parkingId: req.params.id };
    if (vehicleType) filter.vehicleType = vehicleType;

    const now = new Date();
    const slots = await ParkingSlot.find(filter).sort({ slotNumber: 1 }).lean();

    const mapped = slots.map((s) => ({
      ...s,
      isAvailable: s.status === 'available' || (s.status === 'reserved' && s.lockedUntil && s.lockedUntil < now),
      isLockedByMe: s.lockedBy?.toString() === req.user.id.toString() && s.lockedUntil > now
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
});

// POST /api/parking/:id/lock-slot — Lock a slot for 2 minutes
router.post('/:id/lock-slot', auth, async (req, res, next) => {
  try {
    const { slotId } = req.body;
    if (!slotId) return res.status(400).json({ success: false, message: 'slotId is required.' });

    // Verify slot belongs to this parking
    const slot = await ParkingSlot.findOne({ _id: slotId, parkingId: req.params.id });
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found at this location.' });

    const locked = await parkingService.lockSlot(slotId, req.user.id);
    res.json({ success: true, data: locked, message: 'Slot locked for 2 minutes.' });
  } catch (error) {
    if (error.message.includes('not available')) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
});

module.exports = router;
