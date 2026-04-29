const { GoogleGenerativeAI } = require('@google/generative-ai')

const SYSTEM_PROMPT = `You are SmartCity Chat Support Assistant for citizens.

Core responsibilities:
- Help citizens file and track civic complaints.
- Explain complaint categories: traffic, water, waste, lighting, emergency.
- Guide with clear, practical, step-by-step actions.
- Keep replies short, empathetic, and easy to understand.

Rules:
- You may request a backend action only when user clearly asks to file/register/create complaint.
- For urgent danger (fire, severe injury, active threat), advise immediate local emergency services first.
- If information is missing, ask one focused follow-up question.
- Avoid legal or medical diagnosis.
- Keep response under 140 words unless user asks for detail.`

const ACTION_INSTRUCTION = `Return STRICT JSON only (no markdown, no code block) in this exact shape:
{
  "reply": "string",
  "action": null | {
    "type": "create_complaint",
    "payload": {
      "title": "string",
      "description": "string",
      "category": "traffic|water|waste|lighting|emergency",
      "location": "string",
      "zone": "north|south|east|west|central",
      "priority": "low|medium|high"
    }
  }
}

Action policy:
- Use action.type=create_complaint ONLY when user explicitly asks to file/create/register complaint now.
- If required details are missing, keep action=null and ask for missing details in reply.
- Never invent exact addresses; if unsure ask user first.
`

const parseAssistantJson = (rawText) => {
  if (!rawText) return null
  const trimmed = rawText.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) return null
  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
  } catch (error) {
    return null
  }
}

const normalizeAssistantResponse = (parsed, fallbackText) => {
  const safeReply =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : fallbackText

  if (!parsed?.action || parsed.action.type !== 'create_complaint') {
    return { reply: safeReply, action: null }
  }

  const payload = parsed.action.payload || {}
  return {
    reply: safeReply,
    action: {
      type: 'create_complaint',
      payload: {
        title: typeof payload.title === 'string' ? payload.title.trim() : '',
        description:
          typeof payload.description === 'string'
            ? payload.description.trim()
            : '',
        category:
          typeof payload.category === 'string'
            ? payload.category.trim().toLowerCase()
            : '',
        location:
          typeof payload.location === 'string' ? payload.location.trim() : '',
        zone:
          typeof payload.zone === 'string'
            ? payload.zone.trim().toLowerCase()
            : '',
        priority:
          typeof payload.priority === 'string'
            ? payload.priority.trim().toLowerCase()
            : '',
      },
    },
  }
}

const buildGeminiHistory = (history = []) => {
  if (!Array.isArray(history)) return []

  const mapped = history
    .filter(
      (item) => item && typeof item.content === 'string' && item.content.trim()
    )
    .slice(-10)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content.trim().slice(0, 1200) }],
    }))

  // Gemini chat history must start with a user role.
  while (mapped.length && mapped[0].role !== 'user') {
    mapped.shift()
  }

  return mapped
}

const isModelNotFoundError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('is not found') || message.includes('not supported')
}

const isQuotaOrRateLimitError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  )
}

const getCandidateModels = () => {
  const configured = String(process.env.GEMINI_MODEL || '').trim()
  return [
    ...new Set(
      [
        configured,
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
      ].filter(Boolean)
    ),
  ]
}

const buildOfflineReply = (message = '') => {
  const text = String(message || '').toLowerCase()

  if (!text.trim() || text === 'hi' || text === 'hello' || text === 'namaste') {
    return 'Namaste! Main SmartCity support mode me hoon. Aap complaint file, status check, category ya priority ke baare me pooch sakte hain.'
  }

  if (
    text.includes('status') ||
    text.includes('track') ||
    text.includes('ticket') ||
    text.includes('meri complaint')
  ) {
    return 'Complaint status dekhne ke liye Complaints page kholiye, apna ticket ID search kariye, aur status timeline check kariye. Ticket ID bhejenge to main status interpret karne me help karunga.'
  }

  if (
    text.includes('emergency') ||
    text.includes('fire') ||
    text.includes('accident') ||
    text.includes('injury')
  ) {
    return 'Agar turant jaan ka risk hai to pehle local emergency services ko call karein. SmartCity complaint me category emergency, exact location, short incident detail aur priority high dalen.'
  }

  if (
    text.includes('street light') ||
    text.includes('streetlight') ||
    text.includes('light') ||
    text.includes('lighting')
  ) {
    return 'Street light complaint ke liye yeh details dein: exact pole/location, kab se issue hai, light off/blinking state, nearby landmark, aur safety risk. Category lighting aur priority medium/high choose karein.'
  }

  if (
    text.includes('water') ||
    text.includes('pani') ||
    text.includes('leak') ||
    text.includes('pipeline')
  ) {
    return 'Water leakage complaint ke liye issue type (leak/burst), exact location, severity (slow/major), kab se problem hai, aur nearby landmark bhejein. Category water rakhein; heavy leak ho to priority high karein.'
  }

  if (
    text.includes('waste') ||
    text.includes('garbage') ||
    text.includes('kooda')
  ) {
    return 'Waste complaint me location, waste type (mixed/biomedical/debris), quantity estimate, smell/health risk, aur pickup pending days share karein. Category waste aur urgency ke hisab se priority set karein.'
  }

  if (
    text.includes('traffic') ||
    text.includes('jam') ||
    text.includes('signal')
  ) {
    return 'Traffic complaint ke liye junction/location, issue type (signal failure/jam/accident), peak time, aur risk details dein. Category traffic rakhein; accident ya blockage ho to priority high karein.'
  }

  return 'Main abhi limited support mode me hoon. Complaint file karne ke liye 4 cheezein bhejein: issue, location, category (traffic/water/waste/lighting/emergency), priority (low/medium/high).'
}

const generateAssistantReply = async ({ message, history = [], user }) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  const userContext = `Citizen context:\n- Name: ${user?.name || 'Citizen'}\n- Role: ${user?.role || 'user'}\n- Department: ${user?.department || 'general'}`

  const chatHistory = buildGeminiHistory(history)

  let rawText = ''
  let lastError = null

  for (const modelName of getCandidateModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `${SYSTEM_PROMPT}\n\n${ACTION_INSTRUCTION}\n${userContext}`,
      })

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: { temperature: 0.4, maxOutputTokens: 350 },
      })

      const result = await chat.sendMessage(message.trim().slice(0, 1500))
      rawText = result.response.text()
      if (rawText) break
    } catch (error) {
      lastError = error
      if (!isModelNotFoundError(error)) {
        break
      }
    }
  }

  if (!rawText) {
    if (lastError && isQuotaOrRateLimitError(lastError)) {
      return {
        reply: buildOfflineReply(message),
        action: null,
      }
    }
    if (lastError && isModelNotFoundError(lastError)) {
      return {
        reply: buildOfflineReply(message),
        action: null,
      }
    }
    if (lastError) throw lastError
    throw new Error('No response from Gemini')
  }

  const parsed = parseAssistantJson(rawText)
  if (!parsed) return { reply: rawText, action: null }

  return normalizeAssistantResponse(parsed, rawText)
}

module.exports = { generateAssistantReply }
