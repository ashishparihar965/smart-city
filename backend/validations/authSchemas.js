const Joi = require('joi')

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).max(128).required(),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').default('central'),
  phone: Joi.string().allow('').max(20),
})

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
})

const createUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('admin', 'operator', 'user').required(),
  department: Joi.string().valid('traffic', 'waste', 'water', 'lighting', 'emergency', 'general').default('general'),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').default('central'),
  phone: Joi.string().allow('').max(20),
})

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  role: Joi.string().valid('admin', 'operator', 'user'),
  department: Joi.string().valid('traffic', 'waste', 'water', 'lighting', 'emergency', 'general'),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central'),
  isActive: Joi.boolean(),
  phone: Joi.string().allow('').max(20),
}).min(1)

module.exports = { registerSchema, loginSchema, createUserSchema, updateUserSchema }
