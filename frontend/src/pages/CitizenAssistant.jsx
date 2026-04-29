import { useState } from 'react'
import { chatAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Bot, Send, User, Sparkles, RotateCcw } from 'lucide-react'
import './ModulePage.css'
import './CitizenAssistant.css'

const QUICK_PROMPTS = [
  'Meri taraf se complaint create karo: 3 din se Sector 21 market me pani leak ho raha hai, category water, priority high.',
  'Pani leakage complaint kaise file karun?',
  'Street light kharab ho to kya details deni chahiye?',
  'Emergency complaint ko high priority kaise mark karun?',
  'Meri complaint status kaise check karun?',
]

const buildHistoryForApi = (messages = []) => {
  const history = messages
    .filter(
      (item) => item && typeof item.content === 'string' && item.content.trim()
    )
    .slice(-8)

  while (history.length && history[0].role !== 'user') {
    history.shift()
  }

  return history
}

const CitizenAssistant = () => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Namaste! Main SmartCity Chat Support Assistant hoon. Aap complaint filing, category selection, priority aur tracking mein help le sakte hain.',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const sendMessage = async (messageText) => {
    const text = messageText.trim()
    if (!text || sending) return

    const userMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setSending(true)

    try {
      const history = buildHistoryForApi(messages)
      const response = await chatAPI.askAssistant({ message: text, history })
      const reply =
        response.data?.data?.reply || 'Sorry, assistant se response nahi aaya.'
      const created = response.data?.data?.complaintCreated

      setMessages((prev) => {
        const next = [...prev, { role: 'assistant', content: reply }]

        if (created?.id) {
          next.push({
            role: 'assistant',
            content: `Ticket: ${created.id}\nCategory: ${created.category}\nPriority: ${created.priority}\nStatus: ${created.status}`,
          })
        }

        return next
      })
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        'Assistant service abhi unavailable hai. Thodi der baad try karein.'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorMessage },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await sendMessage(input)
  }

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Fresh chat start ho gaya ${user?.name ? `${user.name.split(' ')[0]}, ` : ''}aap apna query bhej sakte hain.`,
      },
    ])
    setInput('')
  }

  return (
    <div className="module-page assistant-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>🤖 Smart City Chat Support</h1>
          <p>Citizen help desk for complaint filing and tracking</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handleReset}>
            <RotateCcw size={14} /> New Chat
          </button>
        </div>
      </div>

      <div className="assistant-layout">
        <section className="assistant-chat-card card">
          <div className="assistant-chat-header">
            <div className="assistant-badge">
              <Bot size={16} /> Gemini AI Assistant
            </div>
            <span className="assistant-status">Online</span>
          </div>

          <div className="assistant-messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`assistant-message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="assistant-avatar">
                  {message.role === 'user' ? (
                    <User size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                </div>
                <div className="assistant-bubble">{message.content}</div>
              </div>
            ))}
            {sending && (
              <div className="assistant-message-row assistant">
                <div className="assistant-avatar">
                  <Sparkles size={14} />
                </div>
                <div className="assistant-bubble typing">Typing...</div>
              </div>
            )}
          </div>

          <form className="assistant-input" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Apna sawal likhiye..."
              rows={2}
              maxLength={1500}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !input.trim()}
            >
              <Send size={14} /> Send
            </button>
          </form>
        </section>

        <aside className="assistant-side card">
          <h3>Quick Prompts</h3>
          <div className="prompt-list">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                className="prompt-chip"
                onClick={() => sendMessage(prompt)}
                disabled={sending}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="assistant-tip">
            <strong>Tip:</strong> Location, category aur issue details dene se
            better answer milta hai.
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CitizenAssistant
