import React, { useState } from 'react';

const HabitDashboardMobileV2 = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [showRivalryRequest, setShowRivalryRequest] = useState(false);
  const [dismissedStruggles, setDismissedStruggles] = useState([]);

  const user = { name: 'Heather', avatar: 'H' };
  
  const stats = {
    todayComplete: 4,
    todayTotal: 5,
    currentStreak: 12,
    weekCompletion: 78,
  };

  const habits = [
    { id: 'walk', name: 'Walk 4.5 Miles', goal: '4.5 miles', completed: true, color: '#8b5cf6', streak: 12, weeklyRate: 85 },
    { id: 'meditation', name: 'Meditation', goal: '10 min', completed: true, color: '#f59e0b', streak: 8, weeklyRate: 71 },
    { id: 'water', name: 'Drink Water', goal: '8 glasses', completed: false, color: '#0ea5e9', streak: 5, weeklyRate: 65 },
    { id: 'protein', name: 'Hit Protein Goal', goal: '150g', completed: true, color: '#10b981', streak: 15, weeklyRate: 92 },
    { id: 'sleep', name: 'Sleep 8 Hours', goal: '8 hours', completed: false, color: '#ec4899', streak: 0, weeklyRate: 28, struggling: true },
  ];

  const rivalry = {
    active: true,
    habit: 'Walk 4.5 Miles',
    opponent: { name: 'Jordan', avatar: 'J' },
    myScore: 78,
    opponentScore: 72,
    daysLeft: 5,
    myWeek: [true, true, false, true, true, null, null],
    opponentWeek: [true, false, true, true, false, null, null],
  };

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const colors = {
    bg: '#08080c',
    bgCard: '#0f0f14',
    bgCardLight: '#16161d',
    bgHover: '#1c1c26',
    purple: '#8b5cf6',
    purpleLight: '#a78bfa',
    purpleDark: '#7c3aed',
    green: '#10b981',
    greenLight: '#34d399',
    amber: '#f59e0b',
    amberLight: '#fbbf24',
    red: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#1f1f28',
  };

  const Icons = {
    flame: ({ size = 20, color = colors.amber }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z"/>
      </svg>
    ),
    chart: ({ size = 20, color = colors.purple }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
    ),
    swords: ({ size = 20, color = colors.red }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4"/>
        <path d="M9.5 6.5L21 18v3h-3L6.5 9.5M11 5L5 11M8 8L4 4"/>
      </svg>
    ),
    check: ({ size = 20, color = 'white' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    chevron: ({ size = 16, color = colors.textMuted }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    ),
    crown: ({ size = 16, color = colors.amber }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M2.5 18.5l2-10 5 4 2.5-7 2.5 7 5-4 2 10h-19z"/>
      </svg>
    ),
    calendar: ({ size = 16, color = colors.textMuted }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    alertCircle: ({ size = 16, color = colors.amber }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    message: ({ size = 16, color = colors.purple }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    refresh: ({ size = 16, color = colors.textMuted }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
    home: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    checkSquare: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    user: ({ size = 24, color = 'currentColor' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    send: ({ size = 16, color = 'white' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    ),
    back: ({ size = 20, color = colors.textSecondary }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    ),
    x: ({ size = 16, color = colors.textMuted }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  };

  const CircularProgress = ({ progress, size = 80, strokeWidth = 6, color, children }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;
    const gradientId = `m-gradient-${color.replace('#', '')}`;
    
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={`${color}80`} />
            </linearGradient>
          </defs>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={colors.bgCardLight} strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    );
  };

  const dismissStruggle = (habitId) => {
    setDismissedStruggles([...dismissedStruggles, habitId]);
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: colors.bg,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      paddingBottom: '100px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .card {
          background: linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.bgCardLight} 100%);
          border: 1px solid ${colors.border};
          border-radius: 20px;
        }
        .gradient-text {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .btn-primary {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%);
          border: none; color: white; font-weight: 600;
        }
        .btn-ghost {
          background: transparent; border: 1px solid ${colors.border}; color: ${colors.textSecondary}; font-weight: 500;
        }
        .habit-row { transition: all 0.15s ease; }
        .habit-row:active { transform: scale(0.98); }
        .link { color: ${colors.purple}; text-decoration: none; font-weight: 500; }
      `}</style>

      {/* Status Bar */}
      <div style={{ height: '50px' }} />

      {/* Header */}
      <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: colors.bgCard, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Icons.back />
          </button>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: colors.textPrimary }}>My Habits</h1>
        </div>
        <div style={{
          width: '44px', height: '44px', borderRadius: '14px',
          background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px', fontWeight: 600, color: 'white',
        }}>
          {user.avatar}
        </div>
      </div>

      {/* Today's Progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div className="card" style={{ 
          padding: '24px',
          background: `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.purple}10 100%)`,
          borderColor: `${colors.purple}25`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, fontWeight: 500, marginBottom: '6px' }}>Today's Progress</p>
              <div style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1 }}>
                <span className="gradient-text">{stats.todayComplete}</span>
                <span style={{ color: colors.textMuted, fontSize: '28px' }}>/{stats.todayTotal}</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: colors.textMuted }}>habits completed</p>
            </div>
            <CircularProgress progress={(stats.todayComplete / stats.todayTotal) * 100} size={80} strokeWidth={7} color={colors.purple}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: colors.purple }}>
                {Math.round((stats.todayComplete / stats.todayTotal) * 100)}%
              </span>
            </CircularProgress>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '10px', padding: '0 20px 16px' }}>
        <div className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
          <Icons.flame size={22} color={colors.amber} />
          <div style={{ fontSize: '24px', fontWeight: 800, color: colors.amber, marginTop: '6px' }}>{stats.currentStreak}</div>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textMuted }}>Day Streak</p>
        </div>
        <div className="card" style={{ flex: 1, padding: '16px', textAlign: 'center' }}>
          <Icons.chart size={22} color={colors.purple} />
          <div style={{ fontSize: '24px', fontWeight: 800, color: colors.purple, marginTop: '6px' }}>{stats.weekCompletion}%</div>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textMuted }}>This Week</p>
        </div>
        <a href="/habits/history" className="card link" style={{ flex: 1, padding: '16px', textAlign: 'center', textDecoration: 'none' }}>
          <Icons.calendar size={22} color={colors.purple} />
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.purple, marginTop: '8px' }}>View</div>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: colors.textMuted }}>History</p>
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px' }}>
        {['Today', 'Week'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            style={{
              flex: 1, padding: '12px', borderRadius: '14px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              background: activeTab === tab.toLowerCase() 
                ? `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)` 
                : colors.bgCard,
              border: activeTab === tab.toLowerCase() ? 'none' : `1px solid ${colors.border}`,
              color: activeTab === tab.toLowerCase() ? 'white' : colors.textMuted,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {activeTab === 'today' && (
          <>
            {/* Rivalry Card */}
            {rivalry.active && (
              <div className="card" style={{ 
                padding: '20px', marginBottom: '16px',
                background: `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.red}08 100%)`,
                borderColor: `${colors.red}25`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: `linear-gradient(135deg, ${colors.red}20 0%, ${colors.purple}20 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icons.swords size={20} color={colors.red} />
                    </div>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: colors.textPrimary }}>Rivalry</span>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textMuted }}>{rivalry.habit}</p>
                    </div>
                  </div>
                  <div style={{
                    background: `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)`,
                    padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: 'white',
                  }}>
                    WINNING
                  </div>
                </div>

                {/* VS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: 600, color: 'white', position: 'relative',
                    }}>
                      {user.avatar}
                      <div style={{ position: 'absolute', top: '-5px', right: '-5px' }}><Icons.crown size={12} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: colors.textMuted }}>You</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: colors.purple }}>{rivalry.myScore}%</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ padding: '5px 12px', borderRadius: '8px', background: colors.bgCardLight, fontSize: '12px', fontWeight: 700, color: colors.green }}>
                      +{rivalry.myScore - rivalry.opponentScore}%
                    </div>
                    <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>{rivalry.daysLeft} days left</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: colors.textMuted }}>{rivalry.opponent.name}</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: colors.amber }}>{rivalry.opponentScore}%</div>
                    </div>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: `linear-gradient(135deg, ${colors.amber} 0%, ${colors.amberLight} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: 600, color: 'white',
                    }}>
                      {rivalry.opponent.avatar}
                    </div>
                  </div>
                </div>

                {/* Week Bars */}
                <div style={{ background: colors.bgCard, borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', marginBottom: '8px' }}>
                    <span style={{ width: '36px', fontSize: '10px', color: colors.textMuted }}>Week</span>
                    <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between' }}>
                      {weekDays.map((d, i) => (
                        <span key={i} style={{ fontSize: '10px', color: colors.textMuted, width: '20px', textAlign: 'center' }}>{d}</span>
                      ))}
                    </div>
                  </div>
                  {[{ name: 'You', data: rivalry.myWeek, color: colors.purple }, { name: rivalry.opponent.name.slice(0,3), data: rivalry.opponentWeek, color: colors.amber }].map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: idx === 0 ? '6px' : 0 }}>
                      <span style={{ width: '36px', fontSize: '10px', color: p.color, fontWeight: 600 }}>{p.name}</span>
                      <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between' }}>
                        {p.data.map((done, i) => (
                          <div key={i} style={{
                            width: '20px', height: '20px', borderRadius: '5px',
                            background: done === null ? colors.bgCardLight : done ? `linear-gradient(135deg, ${p.color} 0%, ${p.color}80 100%)` : colors.bgCardLight,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {done && <Icons.check size={10} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Habits */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: colors.textPrimary }}>Habits</h3>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>{stats.todayComplete}/{stats.todayTotal}</span>
              </div>

              {habits.map(habit => {
                const isStrugglingVisible = habit.struggling && !dismissedStruggles.includes(habit.id);
                
                return (
                  <div key={habit.id} style={{ marginBottom: '10px' }}>
                    <div 
                      className="card habit-row"
                      style={{ 
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderColor: isStrugglingVisible ? `${colors.amber}40` : colors.border,
                        background: isStrugglingVisible 
                          ? `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.amber}08 100%)`
                          : undefined,
                      }}
                    >
                      {/* Check Circle */}
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px', flexShrink: 0,
                        background: habit.completed ? `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)` : colors.bgCardLight,
                        border: habit.completed ? 'none' : `2px solid ${colors.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {habit.completed && <Icons.check size={18} />}
                      </div>

                      {/* Color bar */}
                      <div style={{
                        width: '4px', height: '32px', borderRadius: '2px', marginRight: '12px', flexShrink: 0,
                        background: `linear-gradient(180deg, ${habit.color} 0%, ${habit.color}60 100%)`,
                      }} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>{habit.name}</span>
                          {isStrugglingVisible && <Icons.alertCircle size={14} color={colors.amber} />}
                        </div>
                        <span style={{ fontSize: '13px', color: colors.textMuted }}>{habit.goal}</span>
                      </div>

                      {/* Rate */}
                      <div style={{ textAlign: 'right', marginRight: '8px' }}>
                        <div style={{ 
                          fontSize: '14px', fontWeight: 700,
                          color: habit.weeklyRate >= 70 ? colors.green : habit.weeklyRate >= 50 ? colors.amber : colors.red,
                        }}>
                          {habit.weeklyRate}%
                        </div>
                        <div style={{ fontSize: '10px', color: colors.textMuted }}>week</div>
                      </div>

                      <Icons.chevron />
                    </div>

                    {/* Struggling prompt */}
                    {isStrugglingVisible && (
                      <div style={{
                        margin: '8px 0 0 52px',
                        padding: '14px',
                        background: colors.bgCard,
                        borderRadius: '14px',
                        border: `1px solid ${colors.amber}25`,
                      }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <Icons.alertCircle size={18} color={colors.amber} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 12px', fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>
                              Struggling with this one? Talk to your coach or try something different.
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn-primary" style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <Icons.message size={14} color="white" />
                                Talk to Coach
                              </button>
                              <button className="btn-ghost" style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                <Icons.refresh size={14} color={colors.textSecondary} />
                                Change
                              </button>
                            </div>
                          </div>
                          <button onClick={() => dismissStruggle(habit.id)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            <Icons.x size={14} color={colors.textMuted} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Request Rivalry */}
            {!rivalry.active && (
              <button
                onClick={() => setShowRivalryRequest(true)}
                className="btn-ghost"
                style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' }}
              >
                <Icons.swords size={18} color={colors.textSecondary} />
                Request a Rivalry
              </button>
            )}
          </>
        )}

        {activeTab === 'week' && (
          <div className="card" style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: colors.textMuted, fontWeight: 600 }}>THIS WEEK</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {weekDays.map((d, i) => (
                  <div key={i} style={{ width: '36px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: i === 4 ? colors.purple : colors.textMuted, fontWeight: 600 }}>{d}</div>
                    <div style={{ fontSize: '13px', fontWeight: i === 4 ? 700 : 500, color: i === 4 ? colors.purple : colors.textSecondary, marginTop: '2px' }}>
                      {22 + i}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Habits */}
            {habits.map((habit, idx) => (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0 }}>
                  <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: `linear-gradient(180deg, ${habit.color} 0%, ${habit.color}60 100%)` }} />
                  <span style={{ fontSize: '12px', fontWeight: 500, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {habit.name.length > 10 ? habit.name.slice(0, 10) + '...' : habit.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'flex-end' }}>
                  {weekDays.map((_, i) => {
                    const done = i < 5 ? Math.random() > 0.35 : false;
                    const isFuture = i > 4;
                    return (
                      <div key={i} style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: isFuture ? colors.bgCardLight : done ? `linear-gradient(135deg, ${habit.color} 0%, ${habit.color}80 100%)` : colors.bgCardLight,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {!isFuture && done && <Icons.check size={14} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <a href="/habits/history" className="link" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px', fontSize: '14px', padding: '12px' }}>
              <Icons.calendar size={16} color={colors.purple} />
              View Full History
            </a>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '12px 20px 28px',
        background: `linear-gradient(180deg, transparent 0%, ${colors.bg} 30%)`,
      }}>
        <div className="card" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-around' }}>
          {[
            { id: 'home', icon: Icons.home, label: 'Home' },
            { id: 'habits', icon: Icons.checkSquare, label: 'Habits', active: true },
            { id: 'profile', icon: Icons.user, label: 'Profile' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                padding: '10px 24px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                background: item.active ? `linear-gradient(135deg, ${colors.purple}20 0%, ${colors.purpleDark}20 100%)` : 'transparent',
              }}>
                <Icon size={22} color={item.active ? colors.purple : colors.textMuted} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: item.active ? colors.purple : colors.textMuted }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Request Rivalry Modal */}
      {showRivalryRequest && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowRivalryRequest(false)}>
          <div 
            className="card"
            style={{ width: '100%', maxWidth: '430px', borderRadius: '24px 24px 0 0', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: colors.border, margin: '0 auto 20px' }} />
            
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: `linear-gradient(135deg, ${colors.red}20 0%, ${colors.purple}20 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Icons.swords size={28} color={colors.red} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: colors.textPrimary }}>Request a Rivalry</h2>
              <p style={{ margin: 0, color: colors.textMuted, fontSize: '14px' }}>Your coach will match you</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>Select Habit</label>
              <select style={{
                width: '100%', padding: '14px 16px', borderRadius: '12px',
                background: colors.bgCardLight, border: `1px solid ${colors.border}`,
                color: colors.textPrimary, fontSize: '14px',
              }}>
                {habits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>Message (optional)</label>
              <textarea 
                placeholder="Any notes for your coach..."
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '12px',
                  background: colors.bgCardLight, border: `1px solid ${colors.border}`,
                  color: colors.textPrimary, fontSize: '14px', resize: 'none', height: '80px',
                }}
              />
            </div>

            <button className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <Icons.send size={14} />
              Send Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitDashboardMobileV2;
