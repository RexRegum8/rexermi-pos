'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';

interface ChatThread {
  id: number;
  full_name: string;
  email: string;
  unread_count: number;
  last_message: string;
  last_message_time: string;
}

interface Message {
  id: number;
  user_id: number;
  sender_role: 'user' | 'admin';
  message: string;
  is_read: number;
  created_at: string;
}

interface CustomerDetails {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
}

export default function SupportClient() {
  const { showToast } = useToast();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showConversationMobile, setShowConversationMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch active chat threads
  const fetchThreads = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const res = await fetch('/api/admin/chat');
      const data = (await res.json()) as any;
      if (data.success) setThreads(data.threads);
    } catch (err) {
      console.error('Error fetching chat threads:', err);
    }
  };

  useEffect(() => {
    fetchThreads();

    // Connect to SSE for real-time updates — refresh threads when unread count changes
    let lastUnreadCount = -1;
    let sseSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      sseSource = new EventSource('/api/admin/sse');

      sseSource.addEventListener('unread', (e) => {
        try {
          const { count } = JSON.parse(e.data);
          if (count !== lastUnreadCount) {
            lastUnreadCount = count;
            fetchThreads();
          }
        } catch { /* ignore parse errors */ }
      });

      sseSource.onerror = () => {
        // SSE failed — fall back to polling every 30s (less aggressive than original 10s)
        sseSource?.close();
        sseSource = null;
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchThreads, 30000);
        }
      };
    } catch {
      // EventSource not available (SSR), fall back
      fallbackInterval = setInterval(fetchThreads, 30000);
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) fetchThreads();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      sseSource?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);


  // 2. Fetch history for selected user
  const fetchHistory = async (userId: number, isInitial = false) => {
    if (!isInitial && typeof document !== 'undefined' && document.hidden) return;
    if (isInitial) setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/chat/${userId}`);
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        setCustomer(data.customer);
        setMessages(data.messages);
        
        // If initial load or we cleared unread on server, refresh threads to clear badge
        if (isInitial) {
          fetchThreads();
        }
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      if (isInitial) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedUserId === null) {
      setCustomer(null);
      setMessages([]);
      return;
    }

    fetchHistory(selectedUserId, true);
    const interval = setInterval(() => {
      fetchHistory(selectedUserId, false);
    }, 5000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchHistory(selectedUserId, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedUserId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectThread = (userId: number) => {
    setSelectedUserId(userId);
    setShowConversationMobile(true);
  };

  const handleBackToList = () => {
    setShowConversationMobile(false);
    setSelectedUserId(null);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !replyText.trim()) return;

    const text = replyText.trim();
    setReplyText('');
    setLoading(true);

    // Optimistic update
    const tempMessage: Message = {
      id: Date.now(),
      user_id: selectedUserId,
      sender_role: 'admin',
      message: text,
      is_read: 0,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const res = await fetch(`/api/admin/chat/${selectedUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        setMessages(prev => prev.map(m => m.id === tempMessage.id ? data.message : m));
        // Update threads list
        fetchThreads();
      } else {
        showToast(data.error || 'Error al enviar respuesta.', 'error');
      }
    } catch (err) {
      console.error('Error sending reply:', err);
      showToast('Error de red al enviar respuesta.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter threads by search query
  const filteredThreads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return threads;
    return threads.filter(t => 
      t.full_name.toLowerCase().includes(q) || 
      t.email.toLowerCase().includes(q)
    );
  }, [threads, searchQuery]);

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 180px)',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginTop: '1rem'
    }}>
      {/* LEFT COLUMN: LIST OF CHATS */}
      <div style={{
        width: '320px',
        borderRight: '1px solid var(--border)',
        flexDirection: 'column',
        background: 'var(--bg3)',
        flexShrink: 0
      }} className={`support-list-pane ${showConversationMobile ? 'mobile-hidden' : 'mobile-visible'}`}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="🔍 Buscar cliente por nombre/correo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredThreads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Ningún chat de soporte activo.
            </div>
          ) : (
            filteredThreads.map(t => {
              const isSelected = selectedUserId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectThread(t.id)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(212,175,55,0.1)' : 'transparent',
                    borderLeft: isSelected ? '4px solid var(--gold)' : '4px solid transparent',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}
                  className="support-thread-item"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.88rem', color: isSelected ? 'var(--gold)' : 'var(--text)' }}>
                      {t.full_name}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t.last_message_time ? new Date(t.last_message_time).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {t.email}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {t.last_message}
                    </span>
                    {t.unread_count > 0 && (
                      <span style={{
                        backgroundColor: '#E74C3C',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        padding: '2px 7px',
                        borderRadius: '10px'
                      }}>
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CONVERSATION */}
      <div style={{
        flex: 1,
        flexDirection: 'column',
        background: 'var(--bg)'
      }} className={`support-chat-pane ${showConversationMobile ? 'mobile-visible' : 'mobile-hidden'}`}>
        {selectedUserId === null ? (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '4rem' }}>💬</div>
            <h3>Centro de Mensajería de Soporte</h3>
            <p style={{ fontSize: '0.88rem', maxWidth: '300px', lineHeight: 1.5 }}>
              Selecciona a un cliente de la barra lateral izquierda para iniciar a responder sus dudas e inconvenientes.
            </p>
          </div>
        ) : loadingHistory ? (
          <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Cargando conversación...
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button
                  onClick={handleBackToList}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--gold)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    padding: '0 0.5rem',
                    display: 'none'
                  }}
                  className="mobile-back-btn"
                >
                  ←
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{customer?.full_name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {customer?.email} {customer?.phone ? `| 📞 ${customer.phone}` : ''} {customer?.city ? `| 📍 ${customer.city}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* MESSAGES AREA */}
            <div style={{
              flex: 1,
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No hay mensajes en esta conversación.
                </div>
              ) : (
                messages.map(msg => {
                  const isAdmin = msg.sender_role === 'admin';
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAdmin ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        backgroundColor: isAdmin ? 'var(--gold)' : 'var(--bg3)',
                        color: isAdmin ? '#000' : 'var(--text)',
                        padding: '0.7rem 1rem',
                        borderRadius: isAdmin ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        fontSize: '0.88rem',
                        lineHeight: 1.4,
                        border: isAdmin ? 'none' : '1px solid var(--border)',
                        wordBreak: 'break-word'
                      }}>
                        {msg.message}
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                        padding: '0 4px'
                      }}>
                        {new Date(msg.created_at).toLocaleString('es-VE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* SEND FORM */}
            <form onSubmit={handleSendReply} style={{
              padding: '1rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg2)',
              display: 'flex',
              gap: '0.8rem'
            }}>
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Responder a ${customer?.full_name}...`}
                style={{
                  flex: 1,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.8rem 1rem',
                  color: 'var(--text)',
                  outline: 'none',
                  fontSize: '0.88rem'
                }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !replyText.trim()}
                className="btn-primary"
                style={{
                  padding: '0.8rem 1.5rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  opacity: (!replyText.trim() || loading) ? 0.5 : 1
                }}
              >
                {loading ? '...' : 'Enviar'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* RESPONSIVE CSS INJECTOR */}
      <style>{`
        /* Desktop layout overrides (defaults) */
        .support-list-pane {
          display: flex !important;
        }
        .support-chat-pane {
          display: flex !important;
        }
        .mobile-back-btn {
          display: none !important;
        }

        /* Mobile layout (<= 768px) */
        @media (max-width: 768px) {
          .support-list-pane.mobile-hidden {
            display: none !important;
          }
          .support-list-pane.mobile-visible {
            display: flex !important;
            width: 100% !important;
          }
          .support-chat-pane.mobile-hidden {
            display: none !important;
          }
          .support-chat-pane.mobile-visible {
            display: flex !important;
            width: 100% !important;
          }
          .mobile-back-btn {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
