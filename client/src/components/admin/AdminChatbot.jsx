// client/src/components/admin/AdminChatbot.jsx
import React, { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function AdminChatbot() {
  const { addToast } = useToast();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: `👋 Welcome Admin! I'm your AI assistant. I can help you manage the platform.

Type "help" to see all available commands, or ask me anything!
💡 Try: "total", "users", or "user [name]"`,
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 300);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      text: text,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await API.post('/admin/chat', { message: text });
      
      // Format the response with proper line breaks
      const botMessage = {
        id: Date.now() + 1,
        text: res.data.response,
        sender: 'bot',
        timestamp: new Date(),
        type: res.data.type || 'info'
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: '❌ Error: ' + (error.response?.data?.message || 'Failed to process command. Please try again.'),
        sender: 'bot',
        timestamp: new Date(),
        type: 'error'
      }]);
      addToast('Failed to send message', 'error');
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

  const renderMessage = (msg) => {
    const isBot = msg.sender === 'bot';
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isBot ? 'flex-start' : 'flex-end',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            maxWidth: '85%',
            padding: '12px 16px',
            borderRadius: isBot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
            background: isBot ? 'var(--bg-card, #ffffff)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
            color: isBot ? 'var(--text-primary, #1e293b)' : '#ffffff',
            border: isBot ? '1px solid var(--border-color, #e2e8f0)' : 'none',
            boxShadow: isBot ? '0 1px 3px rgba(0,0,0,0.06)' : '0 4px 12px rgba(99,102,241,0.25)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          {msg.text.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < msg.text.split('\n').length - 1 && <br />}
            </span>
          ))}
          <div style={{
            fontSize: '10px',
            opacity: 0.6,
            marginTop: '6px',
            textAlign: isBot ? 'left' : 'right',
          }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
          cursor: 'pointer',
          fontSize: '28px',
          zIndex: 1000,
          transition: 'all 0.3s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.4)';
        }}
      >
        <span style={{ position: 'relative' }}>
          🛡️
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-8px',
            fontSize: '12px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontWeight: 'bold',
          }}>
            !
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px',
        right: '24px',
        width: '500px',
        maxWidth: '95vw',
        maxHeight: '80vh',
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1000,
        animation: 'slideUpChat 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
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
            🛡️
          </div>
          <div>
            <strong style={{ fontSize: '16px', display: 'block' }}>Admin Assistant</strong>
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
              Online • Admin Mode
            </div>
          </div>
        </div>
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
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px 20px',
          overflowY: 'auto',
          background: 'var(--bg-secondary, #f8fafc)',
          maxHeight: '400px',
        }}
      >
        {messages.map(renderMessage)}
        {loading && (
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
              <span style={{ animation: 'typing-bounce 1.4s infinite' }}>•</span>
              <span style={{ animation: 'typing-bounce 1.4s infinite 0.2s' }}>•</span>
              <span style={{ animation: 'typing-bounce 1.4s infinite 0.4s' }}>•</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

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
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a command... (e.g., 'total', 'user john')"
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-secondary, #f8fafc)',
            color: 'var(--text-primary, #1e293b)',
            resize: 'none',
            fontSize: '14px',
            fontFamily: 'monospace',
            minHeight: '44px',
            maxHeight: '120px',
            outline: 'none',
            transition: 'all 0.2s',
            lineHeight: '1.5',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '0 20px',
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
            transition: 'all 0.2s',
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
        Type "help" for available commands
      </div>

      <style>{`
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
      `}</style>
    </div>
  );
}

export default AdminChatbot;