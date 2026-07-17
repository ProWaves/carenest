// client/src/components/AIChatbot.jsx
import React, { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from './Toast';

function AIChatbot({ isEmbedded = false, onClose, initialMessage }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState({});
  const [isOpen, setIsOpen] = useState(isEmbedded);
  const [suggestions, setSuggestions] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ============================================
  // ROLE CHECK: Only Parents can use AI Chatbot
  // ============================================
  // If user is logged in and NOT a parent, don't render anything
  if (user && user.role !== 'parent') {
    return null;
  }

  const quickSuggestions = [
    { icon: '📅', label: 'Book a babysitter', text: 'I want to book a babysitter for this weekend' },
    { icon: '📝', label: 'Report an issue', text: 'I need to report an issue with my booking' },
    { icon: '💰', label: 'Request refund', text: 'I want to request a refund' },
    { icon: '📊', label: 'Check status', text: 'What is my booking status?' },
    { icon: '❌', label: 'Cancel booking', text: 'I want to cancel my booking' },
    { icon: '📍', label: 'Find nearby sitters', text: 'Find babysitters near me' },
  ];

  // Load chat history when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    try {
      const res = await API.get('/ai/conversations');
      const history = res.data.map(msg => ({
        id: msg.id,
        text: msg.content.replace('🤖 AI Assistant: ', ''),
        sender: msg.sender_id === user?.id ? 'user' : 'ai',
        timestamp: msg.created_at,
      }));
      
      if (history.length === 0 || history.every(m => m.sender === 'user')) {
        // Welcome message
        setMessages([
          {
            id: 'welcome',
            text: `👋 Hi ${user?.first_name || 'there'}! I'm your AI assistant. I can help you with:
• 📅 Booking appointments
• 📝 Reporting issues
• 💰 Refund requests
• 📊 Checking your booking status
• ❌ Cancelling bookings
• 📍 Finding babysitters near you

How can I help you today?`,
            sender: 'ai',
            timestamp: new Date(),
          }
        ]);
      } else {
        setMessages(history.reverse());
      }
      
      // Show suggestions after welcome
      setTimeout(() => setSuggestions(quickSuggestions), 500);
    } catch (error) {
      console.error('Load chat history error:', error);
      setMessages([
        {
          id: 'welcome',
          text: `👋 Hi ${user?.first_name || 'there'}! I'm your AI assistant. How can I help you today?`,
          sender: 'ai',
          timestamp: new Date(),
        }
      ]);
      setTimeout(() => setSuggestions(quickSuggestions), 500);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: text,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setSuggestions([]);
    setIsTyping(true);

    try {
      const res = await API.post('/ai/chat', {
        message: text,
        sessionData,
      });

      // Simulate typing delay for natural feel
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

      const aiMessage = {
        id: Date.now() + 1,
        text: res.data.response,
        sender: 'ai',
        timestamp: new Date(),
        actionRequired: res.data.actionRequired,
        intents: res.data.intents,
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
      
      if (res.data.sessionData) {
        setSessionData(res.data.sessionData);
      }

      if (res.data.actionRequired) {
        setSuggestions([
          { icon: '✅', label: `Proceed`, text: 'Yes, proceed' },
          { icon: '❌', label: 'Cancel', text: 'No, cancel' },
        ]);
      } else {
        setTimeout(() => {
          setSuggestions(quickSuggestions);
        }, 1000);
      }
    } catch (error) {
      console.error('Send message error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: '❌ Sorry, I encountered an error. Please try again or contact support.',
        sender: 'ai',
        timestamp: new Date(),
      }]);
      setTimeout(() => setSuggestions(quickSuggestions), 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action, data) => {
    setLoading(true);
    try {
      const res = await API.post('/ai/action', { action, data });
      if (res.data.success) {
        const successMsg = {
          id: Date.now(),
          text: `✅ Action completed successfully! Reference ID: ${res.data.result.id || 'N/A'}`,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMsg]);
        setSuggestions(quickSuggestions);
        setSessionData({});
        addToast('Action completed successfully!', 'success');
      }
    } catch (error) {
      console.error('Quick action error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: '❌ Failed to complete the action. Please try again or contact support.',
        sender: 'ai',
        timestamp: new Date(),
      }]);
      addToast('Failed to complete action', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      loadHistory();
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Floating chat button
  if (!isEmbedded && !isOpen) {
    return (
      <button
        className="ai-chat-button"
        onClick={toggleChat}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 24px rgba(99, 102, 241, 0.4), 0 8px 48px rgba(99, 102, 241, 0.2)',
          cursor: 'pointer',
          fontSize: '28px',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.5), 0 12px 56px rgba(99, 102, 241, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(99, 102, 241, 0.4), 0 8px 48px rgba(99, 102, 241, 0.2)';
        }}
      >
        <span style={{ position: 'relative' }}>
          🤖
          <span style={{
            position: 'absolute',
            top: '-6px',
            right: '-10px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid white',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }} />
        </span>
      </button>
    );
  }

  // Embedded or open chat window
  return (
    <div
      className="ai-chat-window"
      style={{
        width: isEmbedded ? '100%' : '420px',
        maxWidth: '100%',
        height: isEmbedded ? '520px' : '620px',
        maxHeight: '80vh',
        background: 'var(--bg-card, #ffffff)',
        borderRadius: isEmbedded ? '12px' : '16px',
        boxShadow: isEmbedded ? 'none' : '0 8px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden',
        margin: isEmbedded ? '0' : '0',
        animation: isEmbedded ? 'none' : 'slideUpChat 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: isEmbedded ? 'relative' : 'fixed',
        bottom: isEmbedded ? 'auto' : '100px',
        right: isEmbedded ? 'auto' : '24px',
        zIndex: isEmbedded ? 'auto' : 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🤖
          </div>
          <div>
            <strong style={{ fontSize: '16px', display: 'block' }}>AI Assistant</strong>
            <div style={{ 
              fontSize: '11px', 
              opacity: 0.8, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px' 
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              Online • Ready to help
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {!isEmbedded && (
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              ✕
            </button>
          )}
          {isEmbedded && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px 20px',
          overflowY: 'auto',
          background: 'var(--bg-secondary, #f8fafc)',
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px',
              animation: 'messageSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' 
                  ? '16px 16px 4px 16px' 
                  : '16px 16px 16px 4px',
                background: msg.sender === 'user' 
                  ? 'linear-gradient(135deg, #6366f1, #7c3aed)' 
                  : 'var(--bg-card, #ffffff)',
                color: msg.sender === 'user' 
                  ? 'white' 
                  : 'var(--text-primary, #1e293b)',
                border: msg.sender === 'ai' 
                  ? '1px solid var(--border-color, #e2e8f0)' 
                  : 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxShadow: msg.sender === 'ai' 
                  ? '0 1px 3px rgba(0,0,0,0.06)' 
                  : '0 4px 12px rgba(99,102,241,0.25)',
                position: 'relative',
              }}
            >
              {msg.text}
              {msg.actionRequired && (
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={() => handleQuickAction(msg.actionRequired, {})}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--primary, #6366f1)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ✅ Proceed
                  </button>
                </div>
              )}
              <div style={{
                fontSize: '10px',
                opacity: 0.6,
                marginTop: '6px',
                textAlign: msg.sender === 'user' ? 'right' : 'left',
              }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{ 
              padding: '12px 16px', 
              background: 'var(--bg-card, #ffffff)', 
              borderRadius: '16px 16px 16px 4px',
              border: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              <span className="typing-dot" style={{ animationDelay: '0s' }}>•</span>
              <span className="typing-dot" style={{ animationDelay: '0.2s' }}>•</span>
              <span className="typing-dot" style={{ animationDelay: '0.4s' }}>•</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-secondary, #f8fafc)',
            flexShrink: 0,
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.text)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-card, #ffffff)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                color: 'var(--text-secondary, #64748b)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary, #6366f1)';
                e.currentTarget.style.color = 'var(--primary, #6366f1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
                e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {s.icon && <span>{s.icon}</span>}
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          gap: '10px',
          background: 'var(--bg-card, #ffffff)',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-secondary, #f8fafc)',
              color: 'var(--text-primary, #1e293b)',
              resize: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              minHeight: '44px',
              maxHeight: '120px',
              outline: 'none',
              transition: 'all 0.2s',
              lineHeight: '1.5',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary, #6366f1)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '0 18px',
            borderRadius: '12px',
            border: 'none',
            background: loading || !input.trim() 
              ? 'var(--border-color, #e2e8f0)' 
              : 'linear-gradient(135deg, #6366f1, #7c3aed)',
            color: loading || !input.trim() 
              ? 'var(--text-muted, #94a3b8)' 
              : 'white',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.6 : 1,
            fontSize: '18px',
            fontWeight: '600',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            if (!loading && input.trim()) {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {loading ? '⏳' : '➤'}
        </button>
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 16px',
        borderTop: '1px solid var(--border-color, #e2e8f0)',
        background: 'var(--bg-secondary, #f8fafc)',
        textAlign: 'center',
        fontSize: '10px',
        color: 'var(--text-muted, #94a3b8)',
        flexShrink: 0,
      }}>
        AI may make mistakes. Verify important information.
      </div>

      <style>{`
        .typing-dot {
          display: inline-block;
          animation: typing-bounce 1.4s infinite;
          font-size: 20px;
          line-height: 1;
          color: var(--text-secondary, #64748b);
        }
        
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        @keyframes slideUpChat {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }

        @keyframes messageSlide {
          from { 
            opacity: 0; 
            transform: translateY(10px) scale(0.98);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }

        /* Scrollbar styling for chat */
        .ai-chat-window ::-webkit-scrollbar {
          width: 4px;
        }
        
        .ai-chat-window ::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .ai-chat-window ::-webkit-scrollbar-thumb {
          background: var(--border-color, #e2e8f0);
          border-radius: 2px;
        }
        
        .ai-chat-window ::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted, #94a3b8);
        }

        /* Dark mode adjustments */
        [data-theme="dark"] .ai-chat-window {
          background: var(--bg-card, #1a1a2e);
          border-color: var(--border-color, #2a2a4a);
        }

        [data-theme="dark"] .ai-chat-window .message-ai {
          background: var(--bg-card, #1a1a2e);
          border-color: var(--border-color, #2a2a4a);
          color: var(--text-primary, #e2e8f0);
        }

        [data-theme="dark"] .ai-chat-window .message-user {
          background: linear-gradient(135deg, #6366f1, #7c3aed);
          color: white;
        }
      `}</style>
    </div>
  );
}

export default AIChatbot;