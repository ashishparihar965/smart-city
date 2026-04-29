const Joi = require('joi')

const registerDeviceSchema = Joi.object({
  deviceId: Joi.string().trim().max(50),
  name: Joi.string().trim().min(2).max(100).required(),
  type: Joi.string().valid('traffic-sensor', 'waste-sensor', 'water-meter', 'lighting-controller', 'air-quality-sensor', 'custom').default('custom'),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').required(),
  location: Joi.string().trim().max(200).allow(''),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }),
  connectionType: Joi.string().valid('socket', 'http', 'mqtt', 'simulation').default('socket'),
  connectionKey: Joi.string().trim(),
  firmwareVersion: Joi.string().trim().default('1.0.0'),
  batteryLevel: Joi.number().min(0).max(100),
  signalStrength: Joi.number().min(0).max(100),
  metadata: Joi.object().default({}),
  telemetry: Joi.object().default({}),
})

const createIncidentSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  type: Joi.string().valid('fire', 'accident', 'crime', 'flood', 'gas-leak', 'power-outage', 'other').required(),
  location: Joi.string().trim().required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  description: Joi.string().trim().required(),
})

const createEmergencySchema = Joi.object({
  type: Joi.string().valid('sos', 'fire', 'medical', 'crime', 'natural-disaster', 'gas-leak', 'other').required(),
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().required(),
  location: Joi.string().trim().required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').required(),
  priority: Joi.string().valid('high', 'critical').default('critical'),
})

module.exports = { registerDeviceSchema, createIncidentSchema, createEmergencySchema }
