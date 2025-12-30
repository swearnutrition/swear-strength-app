import React, { useState } from 'react';

const MessagingPages = () => {
  const [view, setView] = useState('dm'); // 'dm', 'announcements', 'compose'
  const [theme, setTheme] = useState('dark');
  const [messageText, setMessageText] = useState('');

  const darkColors = {
    bg: '#0c0a1d',
    bgCard: '#1a1630',
    bgCardLight: '#242042',
    bgHover: '#2a2650',
    purple: '#8b5cf6',
    purpleLight: '#a78bfa',
    purpleMuted: '#6d5a9e',
    green: '#34d399',
    amber: '#fbbf24',
    red: '#ef4444',
    blue: '#60a5fa',
    text: '#ffffff',
    textSecondary: '#a5a3b8',
    textMuted: '#6b6880',
    border: '#2d2854',
    messageSent: '#8b5cf6',
    messageReceived: '#242042',
  };

  const lightColors = {
    bg: '#f8f9fc',
    bgCard: '#ffffff',
    bgCardLight: '#f3f4f8',
    bgHover: '#e8e9f0',
    purple: '#7c5ce0',
    purpleLight: '#ede9fb',
    purpleMuted: '#a89ed4',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    text: '#1a1a2e',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    border: '#e5e7eb',
    messageSent: '#7c5ce0',
    messageReceived: '#f3f4f8',
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  // Mock conversation data
  const conversation = {
    client: {
      name: 'Heather',
      avatar: 'H',
      color: '#f472b6',
      lastSeen: 'Active now',
      streak: 12,
    },
    messages: [
      { id: 1, sender: 'coach', text: 'Hey Heather! Great job hitting your streak this week 🔥', time: '9:30 AM', date: 'Today' },
      { id: 2, sender: 'client', text: 'Thanks! I almost skipped yesterday but pushed through', time: '9:32 AM', date: 'Today' },
      { id: 3, sender: 'coach', text: 'That\'s exactly the mindset we need! How are you feeling about next week\'s goals?', time: '9:33 AM', date: 'Today' },
      { id: 4, sender: 'client', text: 'Pretty good! I want to add the morning stretches back in. Do you think 10 min is enough to start?', time: '9:35 AM', date: 'Today' },
      { id: 5, sender: 'coach', text: '10 minutes is perfect to start. Consistency > duration. Let\'s add it as a new habit and track it together.', time: '9:36 AM', date: 'Today' },
      { id: 6, sender: 'client', text: 'Sounds good! 💪', time: '9:37 AM', date: 'Today' },
    ],
  };

  // Mock client list for sidebar
  const clients = [
    { id: 1, name: 'Heather', avatar: 'H', color: '#f472b6', lastMessage: 'Sounds good! 💪', time: '9:37 AM', unread: 0, online: true },
    { id: 2, name: 'Test Client', avatar: 'T', color: '#fbbf24', lastMessage: 'I\'ll try to do better this week', time: 'Yesterday', unread: 2, online: false },
    { id: 3, name: 'Sarah Mitchell', avatar: 'S', color: '#8b5cf6', lastMessage: 'Thanks coach!', time: 'Mon', unread: 0, online: true },
    { id: 4, name: 'Alex Thompson', avatar: 'A', color: '#22d3ee', lastMessage: 'Can we reschedule?', time: 'Sun', unread: 0, online: false },
  ];

  // Mock announcements
  const announcements = [
    {
      id: 1,
      title: '🎉 New Year Challenge Starting Jan 1!',
      preview: 'Get ready for our 30-day habit challenge. Complete all daily habits for a chance to win...',
      fullText: 'Get ready for our 30-day habit challenge! Complete all daily habits for a chance to win a free month of coaching. Rules: Complete 100% of your assigned habits every day for 30 days. Top 3 performers get prizes!',
      date: 'Dec 28, 2024',
      time: '10:00 AM',
      readBy: 12,
      totalClients: 14,
      pinned: true,
    },
    {
      id: 2,
      title: '📅 Holiday Schedule Update',
      preview: 'I\'ll be taking Dec 31 - Jan 2 off. Response times may be slower but I\'ll check in...',
      fullText: 'I\'ll be taking Dec 31 - Jan 2 off for the holidays. Response times may be slower during this period, but I\'ll still check in once daily. Keep crushing your habits!',
      date: 'Dec 26, 2024',
      time: '2:30 PM',
      readBy: 14,
      totalClients: 14,
      pinned: false,
    },
    {
      id: 3,
      title: '💪 Weekly Motivation',
      preview: 'Remember: Small daily improvements lead to stunning results. You\'re all doing amazing...',
      fullText: 'Remember: Small daily improvements lead to stunning results. You\'re all doing amazing work. Keep showing up for yourselves!',
      date: 'Dec 23, 2024',
      time: '8:00 AM',
      readBy: 10,
      totalClients: 14,
      pinned: false,
    },
  ];

  const Icons = {
    back: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    ),
    send: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    megaphone: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M3 11l18-5v12L3 13v-2z"/>
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
      </svg>
    ),
    pin: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="17" x2="12" y2="22"/>
        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
      </svg>
    ),
    plus: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    search: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    check: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    checkDouble: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="18 6 9 17 4 12"/>
        <polyline points="22 10 13 21 11 19"/>
      </svg>
    ),
    image: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    emoji: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
    moreVertical: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="1"/>
        <circle cx="12" cy="5" r="1"/>
        <circle cx="12" cy="19" r="1"/>
      </svg>
    ),
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: theme === 'dark' ? '#0a0a12' : '#e8e7f0',
      minHeight: '100vh',
      padding: '24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: ${colors.textMuted}; }
      `}</style>

      <h1 style={{ textAlign: 'center', color: colors.text, marginBottom: '8px', fontSize: '24px' }}>
        Messaging Pages
      </h1>

      {/* View & Theme Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <button onClick={() => setView('dm')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: view === 'dm' ? colors.purple : colors.bgCard, color: view === 'dm' ? 'white' : colors.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Client Chat</button>
        <button onClick={() => setView('announcements')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: view === 'announcements' ? colors.purple : colors.bgCard, color: view === 'announcements' ? 'white' : colors.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Announcements</button>
        <button onClick={() => setView('compose')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: view === 'compose' ? colors.purple : colors.bgCard, color: view === 'compose' ? 'white' : colors.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Compose</button>
        <div style={{ width: '1px', background: colors.border, margin: '0 8px' }} />
        <button onClick={() => setTheme('dark')} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: theme === 'dark' ? colors.purple : colors.bgCard, color: theme === 'dark' ? 'white' : colors.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Dark</button>
        <button onClick={() => setTheme('light')} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: theme === 'light' ? colors.purple : colors.bgCard, color: theme === 'light' ? 'white' : colors.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Light</button>
      </div>

      {/* CLIENT CHAT VIEW */}
      {view === 'dm' && (
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          background: colors.bg,
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          height: '700px',
          border: theme === 'light' ? `1px solid ${colors.border}` : 'none',
        }}>
          {/* Sidebar - Client List */}
          <div style={{
            background: colors.bgCard,
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Sidebar Header */}
            <div style={{ padding: '20px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.text, margin: 0 }}>Messages</h2>
                <button style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: colors.purple,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icons.plus size={18} color="white" />
                </button>
              </div>
              {/* Search */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: colors.bgCardLight,
                borderRadius: '10px',
                padding: '10px 14px',
              }}>
                <Icons.search size={18} color={colors.textMuted} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Client List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {clients.map((client, i) => (
                <div
                  key={client.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: i === 0 ? colors.bgCardLight : 'transparent',
                    borderLeft: i === 0 ? `3px solid ${colors.purple}` : '3px solid transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  {/* Avatar with online indicator */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: client.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: 'white',
                    }}>
                      {client.avatar}
                    </div>
                    {client.online && (
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: colors.green,
                        border: `2px solid ${colors.bgCard}`,
                      }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: colors.text }}>{client.name}</span>
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>{client.time}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '13px',
                        color: colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '180px',
                      }}>
                        {client.lastMessage}
                      </span>
                      {client.unread > 0 && (
                        <span style={{
                          background: colors.purple,
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          minWidth: '20px',
                          textAlign: 'center',
                        }}>
                          {client.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Chat Area */}
          <div style={{ display: 'flex', flexDirection: 'column', background: colors.bg }}>
            {/* Chat Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: `1px solid ${colors.border}`,
              background: colors.bgCard,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: conversation.client.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'white',
                  }}>
                    {conversation.client.avatar}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: colors.green,
                    border: `2px solid ${colors.bgCard}`,
                  }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: colors.text }}>{conversation.client.name}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: colors.amber,
                      background: `${colors.amber}20`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}>
                      🔥 {conversation.client.streak} day streak
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: colors.green }}>{conversation.client.lastSeen}</span>
                </div>
              </div>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icons.moreVertical size={20} color={colors.textSecondary} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Date separator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
                <div style={{ flex: 1, height: '1px', background: colors.border }} />
                <span style={{ fontSize: '12px', color: colors.textMuted, fontWeight: 500 }}>Today</span>
                <div style={{ flex: 1, height: '1px', background: colors.border }} />
              </div>

              {conversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'coach' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    background: msg.sender === 'coach' ? colors.messageSent : colors.messageReceived,
                    color: msg.sender === 'coach' ? 'white' : colors.text,
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'coach' 
                      ? '16px 16px 4px 16px' 
                      : '16px 16px 16px 4px',
                    position: 'relative',
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{msg.text}</p>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      marginTop: '6px',
                    }}>
                      <span style={{
                        fontSize: '11px',
                        color: msg.sender === 'coach' ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                      }}>
                        {msg.time}
                      </span>
                      {msg.sender === 'coach' && (
                        <Icons.checkDouble size={14} color="rgba(255,255,255,0.7)" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div style={{
              padding: '16px 24px',
              borderTop: `1px solid ${colors.border}`,
              background: colors.bgCard,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                background: colors.bgCardLight,
                borderRadius: '16px',
                padding: '12px 16px',
              }}>
                <button style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icons.image size={20} color={colors.textMuted} />
                </button>
                <textarea
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                    minHeight: '24px',
                    maxHeight: '120px',
                    lineHeight: 1.5,
                  }}
                  rows={1}
                />
                <button style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icons.emoji size={20} color={colors.textMuted} />
                </button>
                <button style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: colors.purple,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icons.send size={20} color="white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENTS VIEW */}
      {view === 'announcements' && (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: colors.bg,
          borderRadius: '24px',
          padding: '24px',
          border: theme === 'light' ? `1px solid ${colors.border}` : 'none',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: `${colors.purple}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icons.megaphone size={24} color={colors.purple} />
              </div>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: colors.text, margin: 0 }}>Announcements</h2>
                <p style={{ fontSize: '13px', color: colors.textSecondary, margin: 0 }}>Broadcast messages to all clients</p>
              </div>
            </div>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              background: colors.purple,
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              <Icons.plus size={18} color="white" />
              New Announcement
            </button>
          </div>

          {/* Announcements List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                style={{
                  background: colors.bgCard,
                  borderRadius: '16px',
                  padding: '20px',
                  border: announcement.pinned 
                    ? `2px solid ${colors.purple}40` 
                    : theme === 'light' ? `1px solid ${colors.border}` : 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
              >
                {/* Pinned badge */}
                {announcement.pinned && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: colors.purple,
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '8px',
                  }}>
                    <Icons.pin size={12} color="white" />
                    Pinned
                  </div>
                )}

                {/* Title */}
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: colors.text,
                  margin: '0 0 8px 0',
                }}>
                  {announcement.title}
                </h3>

                {/* Preview text */}
                <p style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  margin: '0 0 16px 0',
                  lineHeight: 1.5,
                }}>
                  {announcement.preview}
                </p>

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '12px', color: colors.textMuted }}>
                      {announcement.date} at {announcement.time}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: colors.bgCardLight,
                      padding: '4px 10px',
                      borderRadius: '8px',
                    }}>
                      <Icons.check size={14} color={colors.green} />
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        {announcement.readBy}/{announcement.totalClients} read
                      </span>
                    </div>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    background: 'transparent',
                    color: colors.textSecondary,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPOSE ANNOUNCEMENT VIEW */}
      {view === 'compose' && (
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          background: colors.bg,
          borderRadius: '24px',
          padding: '24px',
          border: theme === 'light' ? `1px solid ${colors.border}` : 'none',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <button style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              background: colors.bgCard,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icons.back size={20} color={colors.textSecondary} />
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.text, margin: 0 }}>New Announcement</h2>
          </div>

          {/* Form */}
          <div style={{
            background: colors.bgCard,
            borderRadius: '16px',
            padding: '24px',
            border: theme === 'light' ? `1px solid ${colors.border}` : 'none',
          }}>
            {/* Recipients */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                Send to
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: colors.purple,
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  👥 All Clients (14)
                </div>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>or</span>
                <button style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: `1px dashed ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Select specific clients...
                </button>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                Title
              </label>
              <input
                type="text"
                placeholder="e.g., 🎉 New Challenge Starting Soon!"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  background: colors.bgCardLight,
                  color: colors.text,
                  fontSize: '15px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                Message
              </label>
              <textarea
                placeholder="Write your announcement here..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  background: colors.bgCardLight,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Options */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '16px 0',
              borderTop: `1px solid ${colors.border}`,
              borderBottom: `1px solid ${colors.border}`,
              marginBottom: '20px',
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
              }}>
                <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: colors.purple }} />
                <span style={{ fontSize: '14px', color: colors.text }}>Pin to top</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
              }}>
                <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', accentColor: colors.purple }} />
                <span style={{ fontSize: '14px', color: colors.text }}>Send push notification</span>
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                background: 'transparent',
                color: colors.textSecondary,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Save Draft
              </button>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: colors.purple,
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                <Icons.send size={16} color="white" />
                Send Announcement
              </button>
            </div>
          </div>

          {/* Preview hint */}
          <p style={{
            fontSize: '13px',
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: '16px',
          }}>
            💡 This will be sent to all 14 clients and appear in their app notifications
          </p>
        </div>
      )}
    </div>
  );
};

export default MessagingPages;
