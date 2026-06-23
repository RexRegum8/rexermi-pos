'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { UserSession } from '@/lib/auth';

interface Message {
  id: number;
  user_id: number;
  sender_role: 'user' | 'admin';
  message: string;
  is_read: number;
  created_at: string;
}

export default function SupportChatWidget({ user, contactPhone }: { user: UserSession | null; contactPhone?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'chat' | 'help'>('chat');
  const [helpActiveTab, setHelpActiveTab] = useState<'buy' | 'payment' | 'fidelidad' | 'support'>('buy');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for unread count when chat is closed
  useEffect(() => {
    if (!user) return;
    
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/chat/unread');
        const data = (await res.json()) as any;
        if (data.success) {
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchUnreadCount(); // Initial check
    
    const interval = setInterval(() => {
      if (!isOpen) {
        fetchUnreadCount();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, isOpen]);

  // Poll for message history when chat is open
  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/chat');
        const data = (await res.json()) as any;
        if (data.success) {
          setMessages(data.messages);
          setUnreadCount(0); // Mark read locally since API marks them read on backend
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages(); // Initial fetch on open

    const interval = setInterval(fetchMessages, 5000);

    return () => clearInterval(interval);
  }, [user, isOpen]);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const msgText = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    // Optimistic local update
    const tempMessage: Message = {
      id: Date.now(),
      user_id: user?.id || 0,
      sender_role: 'user',
      message: msgText,
      is_read: 0,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgText })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        // Replace temp message with server message if necessary
        setMessages(prev => prev.map(m => m.id === tempMessage.id ? data.message : m));
      } else {
        console.error('Failed to send message:', data.error);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, fontFamily: 'inherit' }}>
      {/* FLOATING BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: isOpen ? '#E74C3C' : 'var(--gold)',
          color: isOpen ? '#fff' : '#000',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          position: 'relative'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1.0)'; }}
        title="Chat de Soporte"
      >
        {isOpen ? '✕' : '💬'}
        
        {/* UNREAD BADGE */}
        {!isOpen && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            backgroundColor: '#E74C3C',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '2px solid var(--bg)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            animation: 'pulse 1.5s infinite'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* CHAT WINDOW */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          right: '0',
          width: '350px',
          height: '450px',
          backgroundColor: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInUp 0.25s ease both',
          maxWidth: 'calc(100vw - 40px)'
        }}>
        {/* HEADER */}
          <div style={{
            background: 'linear-gradient(135deg, var(--gold), var(--gold-light))',
            padding: '0.85rem 1rem',
            color: '#000',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>Soporte Técnico</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Rexermi Marketplace</div>
            </div>
            {user && contactPhone && (
              <a
                href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  backgroundColor: '#25D366',
                  color: '#fff',
                  padding: '5px 10px',
                  borderRadius: '15px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
              >
                💬 WhatsApp
              </a>
            )}
          </div>

          {/* TAB BAR: Chat | Ayuda */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
            {([{ id: 'chat', label: '💬 Chat' }, { id: 'help', label: '🏪 Ayuda' }] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id)}
                style={{
                  flex: 1,
                  padding: '0.55rem 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: mainTab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
                  color: mainTab === t.id ? 'var(--gold)' : 'var(--text-muted)',
                  fontWeight: mainTab === t.id ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CHAT VIEW */}
          {mainTab === 'chat' && (
            <>
              {/* MESSAGES AREA */}
              <div style={{
                flex: 1,
                padding: '1rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
                background: 'var(--bg)'
              }}>
                {!user ? (
                  <div style={{
                    margin: 'auto',
                    textAlign: 'center',
                    padding: '1.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem'
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🔒</div>
                    <p style={{ marginBottom: '1.2rem', lineHeight: 1.4 }}>
                      Inicia sesión en tu cuenta para poder chatear con nuestro equipo de soporte en línea.
                    </p>
                    <Link 
                      href="/login" 
                      onClick={() => setIsOpen(false)}
                      className="btn-primary" 
                      style={{ display: 'inline-flex', padding: '0.6rem 1.2rem', textDecoration: 'none', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
                    >
                      🔑 Iniciar Sesión
                    </Link>
                    {contactPhone && (
                      <>
                        <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                          <span>ó</span>
                          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                        </div>
                        <a
                          href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-outline"
                          style={{
                            display: 'inline-flex',
                            padding: '0.65rem 1.2rem',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            width: '100%',
                            justifyContent: 'center',
                            backgroundColor: '#25D366',
                            borderColor: '#25D366',
                            color: '#fff',
                            fontWeight: 700,
                            borderRadius: '10px',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1ebd56'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366'; }}
                        >
                          🟢 Soporte por WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    margin: 'auto',
                    textAlign: 'center',
                    padding: '1.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    lineHeight: 1.4
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
                    <strong>¡Hola, {user.fullName}!</strong>
                    <p style={{ marginTop: '0.4rem' }}>
                      ¿Tienes algún inconveniente con un pedido, producto o pago? Escríbenos aquí abajo y te atenderemos a la brevedad.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.sender_role === 'admin';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isAdmin ? 'flex-start' : 'flex-end',
                          maxWidth: '80%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAdmin ? 'flex-start' : 'flex-end'
                        }}
                      >
                        <div style={{
                          backgroundColor: isAdmin ? 'var(--bg3)' : 'var(--gold)',
                          color: isAdmin ? 'var(--text)' : '#000',
                          padding: '0.6rem 0.9rem',
                          borderRadius: isAdmin ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          border: isAdmin ? '1px solid var(--border)' : 'none'
                        }}>
                          {msg.message}
                        </div>
                        <span style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          marginTop: '3px',
                          padding: '0 4px'
                        }}>
                          {new Date(msg.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT FORM */}
              {user && (
                <form onSubmit={handleSendMessage} style={{
                  padding: '0.8rem',
                  background: 'var(--bg2)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  gap: '0.5rem'
                }}>
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    style={{
                      flex: 1,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: '20px',
                      padding: '0.5rem 1rem',
                      color: 'var(--text)',
                      outline: 'none',
                      fontSize: '0.85rem'
                    }}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputMessage.trim()}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--gold)',
                      color: '#000',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      opacity: (!inputMessage.trim() || loading) ? 0.5 : 1,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    ➤
                  </button>
                </form>
              )}
            </>
          )}

          {/* HELP CENTER VIEW */}
          {mainTab === 'help' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Help sub-tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', overflowX: 'auto', gap: '0.1rem', padding: '0 0.5rem' }}>
                {([
                  { id: 'buy', label: '🛍️ Comprar' },
                  { id: 'payment', label: '💳 Pagos' },
                  { id: 'fidelidad', label: '💎 Puntos' },
                  { id: 'support', label: '📞 Contacto' }
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHelpActiveTab(tab.id)}
                    style={{
                      padding: '0.5rem 0.55rem',
                      background: 'none',
                      border: 'none',
                      color: helpActiveTab === tab.id ? 'var(--gold)' : 'var(--text-muted)',
                      borderBottom: helpActiveTab === tab.id ? '2px solid var(--gold)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: helpActiveTab === tab.id ? 700 : 500,
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Help content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-muted)', background: 'var(--bg)' }}>
                {helpActiveTab === 'buy' && (
                  <div>
                    <h3 style={{ color: 'var(--gold)', marginTop: 0, fontSize: '0.9rem' }}>🛍️ ¿Cómo realizar un pedido?</h3>
                    <ol style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                      <li>Explora los productos o usa la <strong style={{ color: 'var(--text)' }}>Barra de Búsqueda</strong> para encontrar artículos por nombre.</li>
                      <li>Filtra por categorías haciendo clic en las pestañas (Todos, Charcutería, Víveres, etc.).</li>
                      <li>Presiona <strong style={{ color: 'var(--text)' }}>"+ Agregar"</strong> en el producto deseado y ajusta las cantidades.</li>
                      <li>Haz clic en el ícono del 🛒 carrito y presiona <strong style={{ color: 'var(--text)' }}>"Proceder al Pago"</strong>.</li>
                    </ol>
                  </div>
                )}
                {helpActiveTab === 'payment' && (
                  <div>
                    <h3 style={{ color: 'var(--gold)', marginTop: 0, fontSize: '0.9rem' }}>💳 Formas de Pago</h3>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                      <li><strong style={{ color: 'var(--text)' }}>Pago Móvil:</strong> Transfiere al banco/datos del checkout y copia la referencia.</li>
                      <li><strong style={{ color: 'var(--text)' }}>Efectivo (USD/VES):</strong> Válido para retiros en tienda.</li>
                      <li><strong style={{ color: 'var(--text)' }}>Transferencia Bancaria:</strong> Directa a nuestras cuentas.</li>
                    </ul>
                    <p style={{ marginTop: '0.6rem' }}>
                      Es <strong style={{ color: 'var(--text)' }}>obligatorio</strong> subir el capture o la referencia de pago para procesar el despacho.
                    </p>
                  </div>
                )}
                {helpActiveTab === 'fidelidad' && (
                  <div>
                    <h3 style={{ color: 'var(--gold)', marginTop: 0, fontSize: '0.9rem' }}>💎 Puntos de Fidelidad</h3>
                    <p>¡Premiamos tu preferencia! Acumulas puntos automáticamente en cada compra.</p>
                    <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                      <li><strong style={{ color: 'var(--text)' }}>Acumulación:</strong> Puntos basados en el monto de tus compras.</li>
                      <li><strong style={{ color: 'var(--text)' }}>Canjeo:</strong> Redimibles en tus próximas compras como descuentos directos.</li>
                    </ul>
                  </div>
                )}
                {helpActiveTab === 'support' && (
                  <div>
                    <h3 style={{ color: 'var(--gold)', marginTop: 0, fontSize: '0.9rem' }}>📞 Atención al Cliente</h3>
                    <p>¿Dudas con tu pedido o necesitas reportar un inconveniente? Contáctanos:</p>
                    <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <button
                        onClick={() => setMainTab('chat')}
                        style={{ padding: '0.6rem', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        💬 Abrir Chat en Línea
                      </button>
                      {contactPhone && (
                        <a
                          href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.6rem', background: '#25D366', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '0.82rem' }}
                        >
                          🟢 Soporte por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* CSS KEYFRAMES */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
