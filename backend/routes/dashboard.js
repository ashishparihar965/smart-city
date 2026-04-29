const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const predictionService = require('../services/predictionService');
const { getCityHealthData } = require('../services/cityHealthService');
const TrafficData = require('../models/TrafficData');
const Bin = require('../models/Bin');
const WaterData = require('../models/WaterData');
const LightingData = require('../models/LightingData');
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const Complaint = require('../models/Complaint');
const router = express.Router();

// GET /api/dashboard - Get full dashboard data
router.get('/', auth, async (req, res, next) => {
  try {
    if (req.user.role === 'user') {
      const userObjectId = new mongoose.Types.ObjectId(req.user.id);
      const baseFilter = { createdBy: req.user.id };
      const totalComplaints = await Complaint.countDocuments(baseFilter);
      const openComplaints = await Complaint.countDocuments({ ...baseFilter, status: 'open' });
      const inProgressComplaints = await Complaint.countDocuments({ ...baseFilter, status: 'in-progress' });
      const resolvedComplaints = await Complaint.countDocuments({ ...baseFilter, status: 'resolved' });
      const overdueComplaints = await Complaint.countDocuments({
        ...baseFilter,
        status: { $ne: 'resolved' },
        isOverdue: true
      });

      const resolvedForMetrics = await Complaint.find({
        ...baseFilter,
        status: 'resolved'
      }).select('deadline resolvedAt resolutionTimeMinutes');

      const categoryCountsRaw = await Complaint.aggregate([
        { $match: { createdBy: userObjectId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      const categoryCounts = {
        traffic: 0,
        water: 0,
        waste: 0,
        lighting: 0,
        emergency: 0
      };
      categoryCountsRaw.forEach((item) => {
        categoryCounts[item._id] = item.count;
      });

      const typesReported = Object.values(categoryCounts).filter((count) => count > 0).length;

      const complaintsLast30Days = await Complaint.countDocuments({
        ...baseFilter,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const activeDaysRaw = await Complaint.aggregate([
        {
          $match: {
            createdBy: userObjectId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            }
          }
        }
      ]);
      const activeDaysLast30 = activeDaysRaw.length;

      const resolvedWithValidTime = resolvedForMetrics.filter((item) => typeof item.resolutionTimeMinutes === 'number');
      const averageResolutionMinutes = resolvedWithValidTime.length > 0
        ? Math.round(
          resolvedWithValidTime.reduce((sum, item) => sum + item.resolutionTimeMinutes, 0) /
          resolvedWithValidTime.length
        )
        : null;

      const onTimeResolved = resolvedForMetrics.filter((item) => {
        if (!item.deadline || !item.resolvedAt) return false;
        return new Date(item.resolvedAt).getTime() <= new Date(item.deadline).getTime();
      }).length;

      const resolutionRate = totalComplaints > 0 ? resolvedComplaints / totalComplaints : 0;
      const onTimeResolutionRate = resolvedComplaints > 0 ? onTimeResolved / resolvedComplaints : 0;
      const diversityRate = typesReported / 5;
      const consistencyRate = Math.min(1, activeDaysLast30 / 10);

      const volumeComponent = Math.min(30, totalComplaints * 3);
      const resolutionComponent = Math.round(resolutionRate * 30);
      const timelinessComponent = Math.round(onTimeResolutionRate * 20);
      const diversityComponent = Math.round(diversityRate * 10);
      const consistencyComponent = Math.round(consistencyRate * 10);

      const contributionScore = Math.max(
        0,
        Math.min(
          100,
          volumeComponent + resolutionComponent + timelinessComponent + diversityComponent + consistencyComponent
        )
      );

      const scoreLabel = contributionScore >= 80
        ? 'City Champion'
        : contributionScore >= 55
          ? 'Active Citizen'
          : 'Rising Contributor';

      const motivationTips = [];
      if (complaintsLast30Days === 0) {
        motivationTips.push('No reports in the last 30 days. Keep helping by reporting visible civic issues.');
      }
      if ((categoryCounts.waste || 0) === 0) {
        motivationTips.push('If you see full bins, file a Waste complaint to help sanitation teams respond faster.');
      }
      if ((categoryCounts.lighting || 0) === 0) {
        motivationTips.push('Report broken street lights under Lighting to improve night-time safety.');
      }
      if (openComplaints + inProgressComplaints > 0) {
        motivationTips.push('Track your open complaints regularly and add clear updates when needed.');
      }
      if (overdueComplaints > 0) {
        motivationTips.push('Some of your complaints are overdue—follow up with precise location details for faster closure.');
      }
      if (typesReported < 3) {
        motivationTips.push('Reporting across more issue types increases your contribution impact score.');
      }
      if (motivationTips.length < 3) {
        motivationTips.push('Add photos and landmarks while filing complaints to improve assignment accuracy.');
      }

      const recentComplaints = await Complaint.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title category priority status location createdAt');

      // Fetch city health data (weather + AQI)
      let cityHealthData = null;
      try {
        cityHealthData = await getCityHealthData();
      } catch (err) {
        console.error('City health fetch error for citizen dashboard:', err.message);
      }

      return res.json({
        success: true,
        data: {
          citizen: {
            totalComplaints,
            openComplaints,
            inProgressComplaints,
            resolvedComplaints,
            typesReported,
            complaintsLast30Days,
            categoryCounts,
            overdueComplaints,
            activeDaysLast30,
            averageResolutionMinutes,
            onTimeResolved,
            scoreBreakdown: {
              volume: volumeComponent,
              resolution: resolutionComponent,
              timeliness: timelinessComponent,
              diversity: diversityComponent,
              consistency: consistencyComponent
            },
            contributionScore,
            scoreLabel,
            motivationTips,
            recentComplaints
          },
          cityHealth: cityHealthData
        }
      });
    }

    // City Health Score
    const healthData = await predictionService.calculateCityHealthScore();

    // Traffic Summary
    const trafficSummary = {
      totalLocations: await TrafficData.countDocuments(),
      highCongestion: await TrafficData.countDocuments({ congestionLevel: 'high' }),
      mediumCongestion: await TrafficData.countDocuments({ congestionLevel: 'medium' }),
      lowCongestion: await TrafficData.countDocuments({ congestionLevel: 'low' }),
      activeIncidents: await TrafficData.countDocuments({ incidentReported: true })
    };

    // Waste Summary (new Bin model)
    const wasteSummary = {
      totalBins: await Bin.countDocuments(),
      fullBins: await Bin.countDocuments({ status: 'full' }),
      mediumBins: await Bin.countDocuments({ status: 'medium' }),
      lowBins: await Bin.countDocuments({ status: 'low' }),
      needsCollection: await Bin.countDocuments({ needs_collection: true })
    };

    // Water Summary
    const waterSummary = {
      totalAreas: await WaterData.countDocuments(),
      activeLeaks: await WaterData.countDocuments({ leakDetected: true }),
      criticalLeaks: await WaterData.countDocuments({ leakSeverity: 'critical' })
    };
    const allWater = await WaterData.find();
    waterSummary.avgQuality = allWater.length > 0
      ? Math.round(allWater.reduce((s, a) => s + a.qualityIndex, 0) / allWater.length) : 0;
    waterSummary.totalUsage = allWater.reduce((s, a) => s + a.usage, 0);

    // Lighting Summary
    const lightingSummary = {
      totalLights: await LightingData.countDocuments(),
      onLights: await LightingData.countDocuments({ status: 'on' }),
      faultyLights: await LightingData.countDocuments({ faultDetected: true })
    };
    const allLights = await LightingData.find();
    lightingSummary.totalEnergy = Math.round(allLights.reduce((s, l) => s + l.energyUsage, 0) * 100) / 100;

    // Emergency Summary
    const emergencySummary = {
      totalIncidents: await Incident.countDocuments(),
      openIncidents: await Incident.countDocuments({ status: 'open' }),
      inProgressIncidents: await Incident.countDocuments({ status: 'in-progress' }),
      resolvedIncidents: await Incident.countDocuments({ status: 'resolved' }),
      criticalIncidents: await Incident.countDocuments({ priority: 'critical', status: { $ne: 'resolved' } })
    };

    // Recent Alerts
    const recentAlerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(10);
    const unreadAlerts = await Alert.countDocuments({ read: false });

    res.json({
      success: true,
      data: {
        cityHealth: healthData,
        traffic: trafficSummary,
        waste: wasteSummary,
        water: waterSummary,
        lighting: lightingSummary,
        emergency: emergencySummary,
        recentAlerts,
        unreadAlerts
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dashboard/predict - Generate predictions
router.post('/predict', auth, async (req, res, next) => {
  try {
    const alerts = await predictionService.generatePredictiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
