const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const TrafficSignal = require('../models/TrafficSignal');
const TrafficSimulation = require('../models/TrafficSimulation');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const router = express.Router();

// Multer config for simulation image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'traffic');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `traffic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ─── HELPER FUNCTIONS ────────────────────────────────────────

/**
 * Calculate signal timing based on vehicle count
 */
function calculateSignalTime(vehicleCount) {
  if (vehicleCount > 15) return 40;
  if (vehicleCount >= 5) return 25;
  return 10;
}

/**
 * Calculate density label
 */
function calculateDensity(vehicleCount) {
  if (vehicleCount > 15) return 'high';
  if (vehicleCount >= 5) return 'medium';
  return 'low';
}

/**
 * Calculate overall density from total vehicle count
 */
function calculateOverallDensity(totalCount, numDirections) {
  const avg = numDirections > 0 ? totalCount / numDirections : 0;
  return calculateDensity(avg);
}

// ─── ROUTES ──────────────────────────────────────────────────

/**
 * POST /api/traffic/register
 * Register a new traffic signal (Admin only)
 */
router.post('/register', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { name, latitude, longitude, directions, groups } = req.body;

    if (!name || latitude == null || longitude == null || !directions || directions.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name, latitude, longitude, and at least 2 directions are required.'
      });
    }

    const signalData = {
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      directions
    };

    // Use custom groups if provided, otherwise auto-generate
    if (groups && groups.length > 0) {
      signalData.groups = groups;
    }

    const signal = await TrafficSignal.create(signalData);

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Registered Traffic Signal',
      module: 'traffic',
      details: `Registered signal "${signal.name}" at (${signal.latitude}, ${signal.longitude}) with directions: ${signal.directions.join(', ')}`
    });

    res.status(201).json({ success: true, data: signal });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/traffic/all
 * Get all traffic signals with their latest simulation data
 */
router.get('/all', auth, async (req, res, next) => {
  try {
    const signals = await TrafficSignal.find().sort({ createdAt: -1 });

    // Fetch latest simulation for each signal
    const signalsWithData = await Promise.all(
      signals.map(async (signal) => {
        const latestSim = await TrafficSimulation.findOne({ signalId: signal._id })
          .sort({ createdAt: -1 });

        return {
          ...signal.toObject(),
          simulation: latestSim ? latestSim.toObject() : null
        };
      })
    );

    res.json({ success: true, data: signalsWithData });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/traffic/congestion
 * Get signals with high congestion (for citizens)
 */
router.get('/congestion', auth, async (req, res, next) => {
  try {
    const highDensity = await TrafficSimulation.find({ density: 'high' })
      .sort({ createdAt: -1 })
      .populate('signalId');

    // Deduplicate by signalId (keep latest)
    const seen = new Set();
    const congested = [];
    for (const sim of highDensity) {
      if (!sim.signalId) continue;
      const key = sim.signalId._id.toString();
      if (!seen.has(key)) {
        seen.add(key);
        congested.push({
          signal: sim.signalId.toObject(),
          simulation: sim.toObject()
        });
      }
    }

    res.json({ success: true, data: congested });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/traffic/manual-control
 * Manual control: activate a specific group (Admin only)
 */
router.post('/manual-control', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const { signalId, activeGroup } = req.body;

    if (!signalId || activeGroup == null) {
      return res.status(400).json({
        success: false,
        message: 'signalId and activeGroup index are required.'
      });
    }

    const signal = await TrafficSignal.findById(signalId);
    if (!signal) {
      return res.status(404).json({ success: false, message: 'Signal not found.' });
    }

    if (activeGroup < 0 || activeGroup >= signal.groups.length) {
      return res.status(400).json({
        success: false,
        message: `activeGroup must be between 0 and ${signal.groups.length - 1}`
      });
    }

    signal.activeGroup = activeGroup;
    signal.manualOverride = true;
    await signal.save();

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Manual Traffic Control',
      module: 'traffic',
      details: `Manually set signal "${signal.name}" to group ${activeGroup} (${signal.groups[activeGroup].join(', ')})`
    });

    res.json({ success: true, data: signal, message: `Group ${activeGroup} activated manually.` });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/traffic/simulate
 * Real traffic detection: upload images per direction, detect vehicles via YOLO
 * NO fake data — only real ML detection results
 */
router.post('/simulate', auth, roleCheck('admin'), upload.any(), async (req, res, next) => {
  try {
    const { signalId } = req.body;

    if (!signalId) {
      return res.status(400).json({ success: false, message: 'signalId is required.' });
    }

    const signal = await TrafficSignal.findById(signalId);
    if (!signal) {
      return res.status(404).json({ success: false, message: 'Signal not found.' });
    }

    // Map uploaded files to their directions
    const directionFiles = {};
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        directionFiles[file.fieldname] = file.path;
      }
    }

    // Check all signal directions have images
    const missingDirections = signal.directions.filter(d => !directionFiles[d]);
    if (missingDirections.length > 0) {
      // Clean up uploaded files
      for (const file of req.files || []) {
        fs.unlink(file.path, () => {});
      }
      return res.status(400).json({
        success: false,
        message: `Missing images for directions: ${missingDirections.join(', ')}`
      });
    }

    // Call YOLO detection service for each direction — REAL detection only
    const ML_SERVER_URL = process.env.ML_TRAFFIC_URL || 'http://localhost:5001';
    const directionCounts = {};
    const annotatedImages = {};
    let totalCount = 0;

    for (const dir of signal.directions) {
      try {
        const formData = new (require('form-data'))();
        formData.append('image', fs.createReadStream(directionFiles[dir]));

        const response = await axios.post(`${ML_SERVER_URL}/detect`, formData, {
          headers: formData.getHeaders(),
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024,
          maxBodyLength: 50 * 1024 * 1024
        });

        const data = response.data;
        directionCounts[dir] = {
          car: data.car || 0,
          threewheel: data.threewheel || 0,
          bus: data.bus || 0,
          truck: data.truck || 0,
          motorbike: data.motorbike || 0,
          van: data.van || 0,
          total: data.total || 0
        };
        totalCount += directionCounts[dir].total;

        // Store annotated image (base64 with bounding boxes)
        if (data.annotated_image) {
          annotatedImages[dir] = data.annotated_image;
        }

      } catch (mlErr) {
        console.error(`❌ YOLO detection failed for direction ${dir}:`, mlErr.message);
        // NO fake data — return error if ML server is unreachable
        for (const file of req.files || []) {
          fs.unlink(file.path, () => {});
        }
        return res.status(503).json({
          success: false,
          message: `ML Detection Server is not running or unreachable. Failed on direction "${dir}". Please start the ML server (python traffic_detection.py) and try again.`,
          error: mlErr.message
        });
      }
    }

    // Calculate group totals
    const groupTotals = signal.groups.map(group =>
      group.reduce((sum, dir) => sum + (directionCounts[dir]?.total || 0), 0)
    );

    // Find the group with most vehicles → GREEN
    const maxGroupIdx = groupTotals.indexOf(Math.max(...groupTotals));
    const maxGroupTotal = groupTotals[maxGroupIdx];

    // Calculate timing and density
    const signalTime = calculateSignalTime(maxGroupTotal / Math.max(1, signal.groups[maxGroupIdx].length));
    const density = calculateOverallDensity(totalCount, signal.directions.length);

    // Save simulation result (with annotated images)
    const simulation = await TrafficSimulation.create({
      signalId: signal._id,
      directionCounts,
      annotatedImages,
      totalCount,
      density,
      activeGroup: maxGroupIdx,
      signalTime,
      groupTotals
    });

    // Update signal
    signal.activeGroup = maxGroupIdx;
    signal.signalTime = signalTime;
    signal.manualOverride = false;
    await signal.save();

    // Clean up uploaded images
    for (const file of req.files || []) {
      fs.unlink(file.path, () => {});
    }

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Traffic Detection (YOLO)',
      module: 'traffic',
      details: `Real YOLO detection on "${signal.name}": ${totalCount} vehicles detected, Group ${maxGroupIdx} (${signal.groups[maxGroupIdx].join(', ')}) = GREEN, Density: ${density}`
    });

    res.json({
      success: true,
      data: {
        signal: signal.toObject(),
        simulation: simulation.toObject(),
        result: {
          directionCounts,
          annotatedImages,
          groupTotals,
          selectedGroup: maxGroupIdx,
          selectedDirections: signal.groups[maxGroupIdx],
          signalTime,
          density,
          totalCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/traffic/:id
 * Remove a traffic signal (Admin only)
 */
router.delete('/:id', auth, roleCheck('admin'), async (req, res, next) => {
  try {
    const signal = await TrafficSignal.findByIdAndDelete(req.params.id);
    if (!signal) {
      return res.status(404).json({ success: false, message: 'Signal not found.' });
    }

    // Also remove related simulations
    await TrafficSimulation.deleteMany({ signalId: signal._id });

    await ActivityLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Deleted Traffic Signal',
      module: 'traffic',
      details: `Deleted signal "${signal.name}"`
    });

    res.json({ success: true, message: 'Signal deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
