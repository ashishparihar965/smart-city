const trafficService = require('./trafficService');
const Bin = require('../models/Bin');
const WaterData = require('../models/WaterData');
const LightingData = require('../models/LightingData');
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const notificationService = require('./notificationService');

const predictionService = {
  /**
   * Calculate overall City Health Score (0–100)
   * Based on all module metrics
   */
  async calculateCityHealthScore() {
    try {
      let score = 100;
      const factors = {};

      // Traffic factor (max -25 points) — uses new Smart Traffic system
      const trafficRatio = await trafficService.getCongestionRatio();
      const trafficPenalty = Math.round(trafficRatio * 25);
      score -= trafficPenalty;
      factors.traffic = { score: 100 - Math.round(trafficRatio * 100), penalty: trafficPenalty };

      // Waste factor (max -25 points)
      const totalBins = await Bin.countDocuments();
      const fullBins = await Bin.countDocuments({ status: 'full' });
      const needsCollection = await Bin.countDocuments({ needs_collection: true });
      const wasteRatio = totalBins > 0 ? (fullBins + needsCollection) / (totalBins * 2) : 0;
      const wastePenalty = Math.round(wasteRatio * 25);
      score -= wastePenalty;
      factors.waste = { score: 100 - Math.round(wasteRatio * 100), penalty: wastePenalty };

      // Water factor (max -25 points)
      const totalAreas = await WaterData.countDocuments();
      const leakAreas = await WaterData.countDocuments({ leakDetected: true });
      const waterRatio = totalAreas > 0 ? leakAreas / totalAreas : 0;
      const waterPenalty = Math.round(waterRatio * 25);
      score -= waterPenalty;
      factors.water = { score: 100 - Math.round(waterRatio * 100), penalty: waterPenalty };

      // Emergency factor (max -25 points)
      const openIncidents = await Incident.countDocuments({ status: { $in: ['open', 'in-progress'] } });
      const criticalIncidents = await Incident.countDocuments({ priority: 'critical', status: { $ne: 'resolved' } });
      const emergencyPenalty = Math.min(25, openIncidents * 2 + criticalIncidents * 5);
      score -= emergencyPenalty;
      factors.emergency = { score: Math.max(0, 100 - openIncidents * 10), penalty: emergencyPenalty };

      score = Math.max(0, Math.min(100, score));

      // Generate alert if city health is low
      if (score < 50) {
        await notificationService.createCriticalAlert(
          'system',
          'City Health Score Critical',
          `City health score has dropped to ${score}/100. Immediate attention needed across multiple systems.`
        );
      }

      return { score, factors };
    } catch (error) {
      console.error('City health calculation error:', error.message);
      return {
        score: null,
        factors: {},
        unavailable: true,
        reason: error.message
      };
    }
  },

  /**
   * Generate predictive alerts based on trends across all modules
   */
  async generatePredictiveAlerts() {
    try {
      const alerts = [];

      // Check for rising waste levels trend
      const risingWaste = await Bin.countDocuments({ fill_level: { $gt: 60 } });
      const totalBins = await Bin.countDocuments();
      if (totalBins > 0 && risingWaste / totalBins > 0.5) {
        const alert = await notificationService.createPredictionAlert(
          'waste',
          'Waste Overflow Predicted',
          `${Math.round((risingWaste / totalBins) * 100)}% of bins are above 60% capacity. Schedule additional collections.`
        );
        if (alert) alerts.push(alert);
      }

      // Check water usage trend
      const highUsageAreas = await WaterData.countDocuments({ leakDetected: true });
      if (highUsageAreas > 2) {
        const alert = await notificationService.createPredictionAlert(
          'water',
          'Multiple Water Leaks Detected',
          `${highUsageAreas} areas showing potential water leaks. Infrastructure inspection recommended.`
        );
        if (alert) alerts.push(alert);
      }

      // Check lighting faults
      const faultyLights = await LightingData.countDocuments({ faultDetected: true });
      if (faultyLights > 5) {
        const alert = await notificationService.createPredictionAlert(
          'lighting',
          'Lighting Infrastructure Degradation',
          `${faultyLights} street lights reporting faults. Systematic maintenance needed.`
        );
        if (alert) alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      console.error('Predictive alerts error:', error.message);
      return [];
    }
  }
};

module.exports = predictionService;
