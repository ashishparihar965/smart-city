const Alert = require('../models/Alert');

const notificationService = {
  /**
   * Create a new alert/notification
   */
  async createAlert({ type, module, title, message, priority, relatedId }) {
    try {
      const alert = await Alert.create({
        type: type || 'info',
        module,
        title,
        message,
        priority: priority || 'medium',
        relatedId: relatedId || null
      });
      return alert;
    } catch (error) {
      console.error('Notification Service Error:', error.message);
      return null;
    }
  },

  /**
   * Create a critical alert
   */
  async createCriticalAlert(module, title, message, relatedId) {
    return this.createAlert({
      type: 'critical',
      module,
      title,
      message,
      priority: 'critical',
      relatedId
    });
  },

  /**
   * Create a warning alert
   */
  async createWarning(module, title, message, relatedId) {
    return this.createAlert({
      type: 'warning',
      module,
      title,
      message,
      priority: 'medium',
      relatedId
    });
  },

  /**
   * Create a prediction-based alert
   */
  async createPredictionAlert(module, title, message) {
    return this.createAlert({
      type: 'prediction',
      module,
      title,
      message,
      priority: 'medium'
    });
  }
};

module.exports = notificationService;
