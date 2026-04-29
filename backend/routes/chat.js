const express = require('express');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { generateAssistantReply } = require('../services/geminiService');
const Complaint = require('../models/Complaint');
const Alert = require('../models/Alert');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

const ALLOWED_CATEGORIES = new Set(['traffic', 'water', 'waste', 'lighting', 'emergency']);
const ALLOWED_ZONES = new Set(['north', 'south', 'east', 'west', 'central']);
const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high']);

const resolveComplaintPayload = (payload = {}) => {
  const title = (payload.title || '').trim();
  const description = (payload.description || '').trim();
  const location = (payload.location || '').trim();
  const category = (payload.category || '').toLowerCase().trim();
  const zone = (payload.zone || 'central').toLowerCase().trim();
  const priority = (payload.priority || 'medium').toLowerCase().trim();

  if (!title || title.length < 5) return { error: 'Complaint title should be at least 5 characters.' };
  if (!description || description.length < 10) return { error: 'Complaint description should be at least 10 characters.' };
  if (!location) return { error: 'Complaint location is required.' };
  if (!ALLOWED_CATEGORIES.has(category)) return { error: 'Complaint category is invalid.' };

  return {
    data: {
      title,
      description,
      location,
      category,
      zone: ALLOWED_ZONES.has(zone) ? zone : 'central',
      priority: ALLOWED_PRIORITIES.has(priority) ? priority : 'medium'
    }
  };
};

const createComplaintFromAssistant = async (payload, user) => {
  const result = resolveComplaintPayload(payload);
  if (result.error) return { error: result.error };

  const complaint = new Complaint({
    ...result.data,
    createdBy: user.id
  });
  await complaint.save();

  await Alert.create({
    type: complaint.category === 'emergency' ? 'critical' : 'info',
    module: complaint.category,
    title: `New Complaint: ${complaint.title}`,
    message: `Citizen filed a ${complaint.category} complaint at ${complaint.location}. Priority: ${complaint.priority}.`,
    priority: complaint.priority,
    relatedId: complaint._id
  });

  await ActivityLog.create({
    userId: user.id,
    userName: user.name,
    action: 'Filed Complaint via Assistant',
    module: 'complaints',
    details: `"${complaint.title}" — category: ${complaint.category}, priority: ${complaint.priority}`
  });

  return { complaint };
};

router.post('/assistant', auth, roleCheck('user'), async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    if (message.trim().length > 1500) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 1500 chars).' });
    }

    const assistantResult = await generateAssistantReply({
      message,
      history,
      user: req.user
    });

    let reply = assistantResult.reply;
    let complaintCreated = null;

    if (assistantResult.action?.type === 'create_complaint') {
      const createResult = await createComplaintFromAssistant(assistantResult.action.payload, req.user);

      if (createResult.error) {
        reply = `${reply}\n\nComplaint create nahi ho paayi: ${createResult.error}`;
      } else {
        complaintCreated = createResult.complaint;
        reply = `${reply}\n\n✅ Complaint created successfully. Ticket ID: ${createResult.complaint._id}`;
      }
    }

    return res.json({
      success: true,
      data: {
        reply,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        complaintCreated: complaintCreated
          ? {
              id: complaintCreated._id,
              title: complaintCreated.title,
              status: complaintCreated.status,
              category: complaintCreated.category,
              priority: complaintCreated.priority,
              location: complaintCreated.location,
              zone: complaintCreated.zone,
              createdAt: complaintCreated.createdAt
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
