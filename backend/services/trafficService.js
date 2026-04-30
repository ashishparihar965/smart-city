const TrafficSignal = require('../models/TrafficSignal');
const TrafficSimulation = require('../models/TrafficSimulation');
const notificationService = require('./notificationService');

const trafficService = {
  /**
   * Get traffic summary for dashboard
   */
  async getTrafficSummary() {
    try {
      const totalSignals = await TrafficSignal.countDocuments();
      const signals = await TrafficSignal.find();

      // Get latest simulation for each signal
      let highDensity = 0;
      let mediumDensity = 0;
      let lowDensity = 0;

      for (const signal of signals) {
        const latest = await TrafficSimulation.findOne({ signalId: signal._id })
          .sort({ createdAt: -1 });
        if (latest) {
          if (latest.density === 'high') highDensity++;
          else if (latest.density === 'medium') mediumDensity++;
          else lowDensity++;
        }
      }

      return {
        totalSignals,
        highDensity,
        mediumDensity,
        lowDensity,
        activeSignals: totalSignals
      };
    } catch (error) {
      console.error('Traffic summary error:', error.message);
      return {
        totalSignals: 0,
        highDensity: 0,
        mediumDensity: 0,
        lowDensity: 0,
        activeSignals: 0
      };
    }
  },

  /**
   * Get congestion ratio for city health score
   */
  async getCongestionRatio() {
    try {
      const totalSignals = await TrafficSignal.countDocuments();
      if (totalSignals === 0) return 0;

      let highCount = 0;
      const signals = await TrafficSignal.find().select('_id');
      for (const signal of signals) {
        const latest = await TrafficSimulation.findOne({ signalId: signal._id })
          .sort({ createdAt: -1 });
        if (latest && latest.density === 'high') highCount++;
      }

      return highCount / totalSignals;
    } catch (error) {
      console.error('Congestion ratio error:', error.message);
      return 0;
    }
  }
};

module.exports = trafficService;
