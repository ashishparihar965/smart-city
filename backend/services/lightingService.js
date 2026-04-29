const LightingData = require('../models/LightingData');
const notificationService = require('./notificationService');

const lightingService = {
  /**
   * Auto ON/OFF based on time simulation
   * Lights ON between 18:00-06:00, OFF otherwise
   */
  async autoToggleLights() {
    try {
      const currentHour = new Date().getHours();
      const shouldBeOn = currentHour >= 18 || currentHour < 6;

      const autoModeLights = await LightingData.find({ autoMode: true });
      let toggled = 0;

      for (const light of autoModeLights) {
        const newStatus = shouldBeOn ? 'on' : 'off';
        if (light.status !== newStatus) {
          light.status = newStatus;
          await light.save();
          toggled++;
        }
      }

      return { toggled, shouldBeOn, totalAutoLights: autoModeLights.length };
    } catch (error) {
      console.error('Auto toggle error:', error.message);
      throw error;
    }
  },

  /**
   * Detect faulty lights and generate alerts
   */
  async detectFaults() {
    try {
      const faultyLights = await LightingData.find({ faultDetected: true });
      
      for (const light of faultyLights) {
        await notificationService.createWarning(
          'lighting',
          `Light Fault Detected - ${light.lightId}`,
          `Street light at ${light.location} (${light.zone} zone) has fault: ${light.faultType}. Maintenance required.`
        );
      }

      return faultyLights;
    } catch (error) {
      console.error('Fault detection error:', error.message);
      throw error;
    }
  },

  /**
   * Get energy usage statistics by zone
   */
  async getEnergyStats() {
    try {
      const stats = await LightingData.aggregate([
        {
          $group: {
            _id: '$zone',
            totalEnergy: { $sum: '$energyUsage' },
            avgEnergy: { $avg: '$energyUsage' },
            totalLights: { $sum: 1 },
            onLights: { $sum: { $cond: [{ $eq: ['$status', 'on'] }, 1, 0] } },
            faultyLights: { $sum: { $cond: ['$faultDetected', 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return stats;
    } catch (error) {
      console.error('Energy stats error:', error.message);
      throw error;
    }
  }
};

module.exports = lightingService;
