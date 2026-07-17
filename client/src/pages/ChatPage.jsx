import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSocket } from '../context/SocketContext';
import { playMessageSound } from '../utils/sounds';
import BackButton from '../components/BackButton';
import AIChatbot from '../components/AIChatbot';

function ChatPage() {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket, connected } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showAIChat, setShowAIChat] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const activeUserRef = useRef(activeUser);

  useEffect(() => {
    activeUserRef.current = activeUser;
  }, [activeUser]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      if (msg.sender_id !== user.id) {
        playMessageSound();
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTyping = (data) => {
      if (data.sender_id === activeUserRef.current?.user_id) {
        setTyping(data.is_typing);
      }
    };

    const handleOnline = (users) => {
      setOnlineUsers(users);
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('users:online', handleOnline);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('users:online', handleOnline);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    API.get('/chat/conversations').then((r) => setConversations(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (paramUserId) {
      const conv = conversations.find((c) => c.user_id == paramUserId);
      if (conv) {
        setActiveUser(conv);
      } else {
        API.get(`/users/profile/${paramUserId}`).then((r) => {
          setActiveUser({ user_id: r.data.id, first_name: r.data.first_name, last_name: r.data.last_name, avatar_url: r.data.avatar_url });
        }).catch(() => {});
      }
      loadMessages(paramUserId);
    }
  }, [paramUserId, conversations]);

  const loadMessages = async (userId) => {
    try {
      const res = await API.get(`/chat/${userId}`);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !socket || !activeUser) return;

    socket.emit('chat:message', {
      receiver_id: activeUser.user_id,
      content: text,
    });

    setMessages((prev) => [...prev, {
      id: Date.now(),
      sender_id: user.id,
      receiver_id: activeUser.user_id,
      content: text,
      created_at: new Date().toISOString(),
    }]);
    setText('');

    setConversations((prev) => {
      const existing = prev.find((c) => c.user_id === activeUser.user_id);
      if (existing) {
        return prev.map((c) => c.user_id === activeUser.user_id ? { ...c, last_message: text, last_message_time: new Date().toISOString() } : c);
      }
      return [{ user_id: activeUser.user_id, first_name: activeUser.first_name, last_name: activeUser.last_name, last_message: text, last_message_time: new Date().toISOString(), unread_count: 0 }, ...prev];
    });
  };

  const handleTyping = (isTyping) => {
    if (socket && activeUser) {
      socket.emit('chat:typing', { receiver_id: activeUser.user_id, is_typing: isTyping });
    }
  };

  useEffect(() => {
    const el = chatMessagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const selectConversation = (conv) => {
    setActiveUser(conv);
    loadMessages(conv.user_id);
  };

  const isOnline = (userId) => onlineUsers.includes(userId);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="chat-layout">
      <div className="chat-topbar">
        <BackButton label="← Back" fallback="/dashboard" />
        <button
          onClick={() => setShowAIChat(!showAIChat)}
          className="chat-ai-btn"
        >
          <span className="chat-ai-btn-icon">✦</span>
          AI Assistant
        </button>
      </div>

      {showAIChat && (
        <div className="chat-ai-panel">
          <div className="chat-ai-panel-header">
            <span>✦ AI Assistant</span>
            <button onClick={() => setShowAIChat(false)} className="chat-ai-close">✕</button>
          </div>
          <AIChatbot
            isEmbedded={true}
            onClose={() => setShowAIChat(false)}
            initialMessage="I need help with my messages. Can you help me?"
          />
        </div>
      )}

      <div className="chat-page">
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>Messages</h3>
            <div className={`chat-connection-dot ${connected ? 'online' : 'offline'}`} />
          </div>
          <div className="conversations">
            {conversations.map((conv) => (
              <div
                key={conv.user_id}
                className={`conversation ${activeUser?.user_id === conv.user_id ? 'active' : ''}`}
                onClick={() => selectConversation(conv)}
              >
                <div className="conv-avatar-wrap">
                  <div className="conv-avatar">
                    {conv.first_name?.[0]}{conv.last_name?.[0]}
                  </div>
                  {isOnline(conv.user_id) && <span className="conv-online-dot" />}
                </div>
                <div className="conv-info">
                  <div className="conv-top-row">
                    <span className="conv-name">{conv.first_name} {conv.last_name}</span>
                    {conv.last_message_time && <span className="conv-time">{formatTime(conv.last_message_time)}</span>}
                  </div>
                  <div className="conv-bottom-row">
                    <span className="conv-preview">{conv.last_message?.slice(0, 48) || 'No messages yet'}</span>
                    {conv.unread_count > 0 && <span className="conv-unread">{conv.unread_count}</span>}
                  </div>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="chat-sidebar-empty">
                <div className="chat-sidebar-empty-icon">💬</div>
                <p>No conversations yet</p>
                <span>Start chatting with a babysitter</span>
              </div>
            )}
          </div>
        </div>

        <div className="chat-main">
          {activeUser ? (
            <>
              <div className="chat-header">
                <div className="chat-header-avatar-wrap">
                  <div className="chat-header-avatar">
                    {activeUser.first_name?.[0]}{activeUser.last_name?.[0]}
                  </div>
                  {isOnline(activeUser.user_id) && <span className="chat-header-online-dot" />}
                </div>
                <div className="chat-header-info">
                  <strong>{activeUser.first_name} {activeUser.last_name}</strong>
                  <span className={`chat-header-status ${isOnline(activeUser.user_id) ? 'online' : ''}`}>
                    {typing ? 'Typing...' : isOnline(activeUser.user_id) ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="chat-messages" ref={chatMessagesRef}>
                {messages.length === 0 && (
                  <div className="chat-messages-empty">
                    <div>👋</div>
                    <p>Say hello to {activeUser.first_name}!</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isSent = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`message ${isSent ? 'sent' : 'received'}`}>
                      {!isSent && (
                        <div className="message-avatar">
                          {activeUser.first_name?.[0]}{activeUser.last_name?.[0]}
                        </div>
                      )}
                      <div className="message-body">
                        <div className="message-bubble">{msg.content}</div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(msg.created_at)}</span>
                          {isSent && msg.is_read && <span className="message-read">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input" onSubmit={sendMessage}>
                <div className="chat-input-wrap">
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={() => handleTyping(true)}
                    onBlur={() => handleTyping(false)}
                    placeholder="Type a message..."
                    className="chat-input-field"
                  />
                  <button
                    type="submit"
                    className={`chat-send-btn ${text.trim() ? 'active' : ''}`}
                    disabled={!text.trim()}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-icon-wrap">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3>Welcome to Messages</h3>
              <p>Select a conversation to start chatting, or find a babysitter to begin.</p>
              <Link to="/babysitters" className="chat-empty-btn">
                Find Babysitters
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatPage;