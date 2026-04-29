const TrafficData = require('../models/TrafficData');
const notificationService = require('./notificationService');

const trafficService = {
  /**
   * Predict congestion based on historical data patterns
   */
  async predictCongestion(zone) {
    try {
      // Get last 20 readings for the zone
      const recentData = await TrafficData.find({ zone })
        .sort({ createdAt: -1 })
        .limit(20);

      if (recentData.length < 3) return 'unknown';

      // Count congestion levels in recent history
      const counts = { low: 0, medium: 0, high: 0 };
      recentData.forEach(d => { counts[d.congestionLevel]++; });

      // Simple trend analysis: if high congestion is increasing, predict high
      const recentThree = recentData.slice(0, 3);
      const highRecent = recentThree.filter(d => d.congestionLevel === 'high').length;
      
      if (highRecent >= 2) {
        await notificationService.createPredictionAlert(
          'traffic',
          `High Traffic Predicted - ${zone.toUpperCase()} Zone`,
          `Based on recent trends, high congestion is predicted in ${zone} zone. Consider deploying traffic management measures.`
        );
        return 'high';
      }

      if (counts.medium > counts.low && counts.medium > counts.high) return 'medium';
      if (counts.high > counts.low) return 'high';
      return 'low';
    } catch (error) {
      console.error('Traffic prediction error:', error.message);
      return 'unknown';
    }
  },

  /**
   * Handle emergency vehicle override
   */
  async activateEmergencyOverride(locationId) {
    try {
      const updated = await TrafficData.findByIdAndUpdate(
        locationId,
        { emergencyOverride: true, signalStatus: 'green' },
        { new: true }
      );
      
      if (updated) {
        await notificationService.createAlert({
          type: 'warning',
          module: 'traffic',
          title: 'Emergency Vehicle Override Activated',
          message: `Traffic signals overridden at ${updated.location} for emergency vehicle passage.`,
          priority: 'high',
          relatedId: updated._id
        });
      }
      return updated;
    } catch (error) {
      console.error('Emergency override error:', error.message);
      throw error;
    }
  },

  /**
   * Deactivate emergency override
   */
  async deactivateEmergencyOverride(locationId) {
    try {
      const updated = await TrafficData.findByIdAndUpdate(
        locationId,
        { emergencyOverride: false },
        { new: true }
      );
      return updated;
    } catch (error) {
      console.error('Deactivate override error:', error.message);
      throw error;
    }
  }
};

module.exports = trafficService;
