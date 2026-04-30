const Joi = require('joi')

const registerDeviceSchema = Joi.object({
  deviceId: Joi.string().trim().max(50).allow(''),
  name: Joi.string().trim().min(2).max(100).required(),
  type: Joi.string().valid('traffic-sensor', 'waste-sensor', 'water-meter', 'lighting-controller', 'air-quality-sensor', 'esp32-weather', 'custom').default('custom'),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').default('central'),
  location: Joi.string().trim().max(200).allow('', null),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }).allow(null),
  connectionType: Joi.string().valid('socket', 'http', 'mqtt', 'simulation').default('http'),
  connectionKey: Joi.string().trim().allow(''),
  firmwareVersion: Joi.string().trim().default('1.0.0').allow(''),
  batteryLevel: Joi.number().min(0).max(100).default(100),
  signalStrength: Joi.number().min(0).max(100).default(100),
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
