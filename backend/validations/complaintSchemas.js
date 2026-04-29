const Joi = require('joi')

const createComplaintSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().min(10).required(),
  category: Joi.string().valid('traffic', 'water', 'waste', 'lighting', 'emergency').required(),
  location: Joi.string().trim().required(),
  zone: Joi.string().valid('north', 'south', 'east', 'west', 'central').default('central'),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }).default({}),
})

const assignComplaintSchema = Joi.object({
  assignedTo: Joi.string().hex().length(24).required(),
  priority: Joi.string().valid('low', 'medium', 'high'),
  deadline: Joi.date().iso().min('now'),
})

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in-progress', 'resolved'),
  remark: Joi.string().trim().max(500),
}).min(1)

module.exports = { createComplaintSchema, assignComplaintSchema, updateStatusSchema }
