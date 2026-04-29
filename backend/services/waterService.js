const WaterData = require('../models/WaterData');
const notificationService = require('./notificationService');

const waterService = {
  /**
   * Analyze water usage and detect anomalies
   */
  async analyzeUsage(zone) {
    try {
      const areas = await WaterData.find({ zone });
      
      const analysis = {
        totalUsage: 0,
        averageUsage: 0,
        leaks: [],
        alerts: [],
        areaCount: areas.length
      };

      for (const area of areas) {
        analysis.totalUsage += area.usage;
        
        if (area.leakDetected) {
          analysis.leaks.push({
            area: area.area,
            severity: area.leakSeverity,
            usage: area.usage,
            threshold: area.threshold
          });
        }
      }

      analysis.averageUsage = areas.length > 0 ? Math.round(analysis.totalUsage / areas.length) : 0;

      // Generate alerts for critical leaks
      for (const leak of analysis.leaks.filter(l => l.severity === 'critical')) {
        await notificationService.createCriticalAlert(
          'water',
          `Critical Water Leak - ${leak.area}`,
          `Usage at ${leak.usage}L exceeds threshold of ${leak.threshold}L. Immediate attention required.`
        );
      }

      return analysis;
    } catch (error) {
      console.error('Water analysis error:', error.message);
      throw error;
    }
  },

  /**
   * Get daily/weekly analytics for an area
   */
  async getAnalytics(zone) {
    try {
      const areas = await WaterData.find({ zone });
      
      return areas.map(a => ({
        area: a.area,
        currentUsage: a.usage,
        dailyAverage: a.dailyAverage,
        weeklyAverage: a.weeklyAverage,
        qualityIndex: a.qualityIndex,
        pressure: a.pressure,
        leakDetected: a.leakDetected,
        leakSeverity: a.leakSeverity
      }));
    } catch (error) {
      console.error('Water analytics error:', error.message);
      throw error;
    }
  }
};

module.exports = waterService;
