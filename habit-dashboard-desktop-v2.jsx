import React, { useState } from 'react';

const HabitDashboardDesktopV2 = () => {
  const [showRivalryRequest, setShowRivalryRequest] = useState(false);
  const [showHabitOptions, setShowHabitOptions] = useState(null);

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
    habitColor: '#8b5cf6',
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
    plus: ({ size = 16, color = colors.textPrimary }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    send: ({ size = 16, color = 'white' }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
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
    const gradientId = `gradient-${color.replace('#', '')}`;
    
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

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: colors.bg,
      minHeight: '100vh',
      color: colors.textPrimary,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .card {
          background: linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.bgCardLight} 100%);
          border: 1px solid ${colors.border};
          border-radius: 20px;
        }
        .card-hover { transition: all 0.2s ease; cursor: pointer; }
        .card-hover:hover { border-color: ${colors.purple}40; box-shadow: 0 8px 32px rgba(139, 92, 246, 0.08); }
        .gradient-text {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .btn-primary {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%);
          border: none; color: white; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4); }
        .btn-ghost {
          background: transparent; border: 1px solid ${colors.border}; color: ${colors.textSecondary};
          font-weight: 500; cursor: pointer; transition: all 0.2s ease;
        }
        .btn-ghost:hover { border-color: ${colors.purple}60; color: ${colors.textPrimary}; }
        .link { color: ${colors.purple}; text-decoration: none; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
        .link:hover { opacity: 0.8; }
      `}</style>

      {/* Header */}
      <header style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer' }}>‹</button>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>My Habits</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/habits/history" className="link" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <Icons.calendar size={16} color={colors.purple} />
            View History
          </a>
          <button className="btn-ghost" style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <Icons.plus size={16} color={colors.textSecondary} />
            Add Habit
          </button>
          <div style={{
            width: '44px', height: '44px', borderRadius: '14px',
            background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600,
          }}>
            {user.avatar}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Top Row: Progress + Stats + Rivalry */}
        <div style={{ display: 'grid', gridTemplateColumns: rivalry.active ? '1fr 1fr 1.5fr' : '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
          
          {/* Today's Progress */}
          <div className="card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: colors.textMuted, fontWeight: 500, marginBottom: '8px' }}>Today's Progress</p>
                <div style={{ fontSize: '52px', fontWeight: 800, lineHeight: 1 }}>
                  <span className="gradient-text">{stats.todayComplete}</span>
                  <span style={{ color: colors.textMuted, fontSize: '32px' }}>/{stats.todayTotal}</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '14px', color: colors.textMuted }}>habits completed</p>
              </div>
              <CircularProgress progress={(stats.todayComplete / stats.todayTotal) * 100} size={100} strokeWidth={8} color={colors.purple}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: colors.purple }}>
                  {Math.round((stats.todayComplete / stats.todayTotal) * 100)}%
                </span>
              </CircularProgress>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card" style={{ padding: '28px', display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1, textAlign: 'center', borderRight: `1px solid ${colors.border}`, paddingRight: '24px' }}>
              <Icons.flame size={28} color={colors.amber} />
              <div style={{ fontSize: '36px', fontWeight: 800, color: colors.amber, marginTop: '8px' }}>{stats.currentStreak}</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textMuted }}>Day Streak</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <Icons.chart size={28} color={colors.purple} />
              <div style={{ fontSize: '36px', fontWeight: 800, color: colors.purple, marginTop: '8px' }}>{stats.weekCompletion}%</div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.textMuted }}>This Week</p>
            </div>
          </div>

          {/* Rivalry Card */}
          {rivalry.active && (
            <div className="card" style={{ 
              padding: '24px',
              background: `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.red}08 100%)`,
              borderColor: `${colors.red}25`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '14px',
                    background: `linear-gradient(135deg, ${colors.red}20 0%, ${colors.purple}20 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icons.swords size={22} color={colors.red} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>Active Rivalry</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted }}>{rivalry.habit} · {rivalry.daysLeft} days left</div>
                  </div>
                </div>
                <div style={{
                  background: `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)`,
                  padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: 'white',
                }}>
                  WINNING
                </div>
              </div>

              {/* VS Display */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600, position: 'relative',
                  }}>
                    {user.avatar}
                    <div style={{ position: 'absolute', top: '-6px', right: '-6px' }}><Icons.crown size={14} /></div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: colors.textMuted }}>You</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: colors.purple }}>{rivalry.myScore}%</div>
                  </div>
                </div>
                <div style={{ padding: '8px 16px', borderRadius: '10px', background: colors.bgCardLight, fontSize: '13px', fontWeight: 700, color: colors.green }}>
                  +{rivalry.myScore - rivalry.opponentScore}%
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: colors.textMuted }}>{rivalry.opponent.name}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: colors.amber }}>{rivalry.opponentScore}%</div>
                  </div>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: `linear-gradient(135deg, ${colors.amber} 0%, ${colors.amberLight} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600,
                  }}>
                    {rivalry.opponent.avatar}
                  </div>
                </div>
              </div>

              {/* Week Comparison */}
              <div style={{ background: colors.bgCard, borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ width: '50px', fontSize: '11px', color: colors.textMuted, fontWeight: 600 }}>THIS WEEK</span>
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    {weekDays.map((d, i) => (
                      <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: colors.textMuted }}>{d}</span>
                    ))}
                  </div>
                </div>
                {[{ name: 'You', data: rivalry.myWeek, color: colors.purple }, { name: rivalry.opponent.name, data: rivalry.opponentWeek, color: colors.amber }].map((player, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: idx === 0 ? '8px' : 0 }}>
                    <span style={{ width: '50px', fontSize: '11px', color: player.color, fontWeight: 600 }}>{player.name}</span>
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      {player.data.map((done, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                          <div style={{
                            width: '24px', height: '24px', borderRadius: '6px',
                            background: done === null ? colors.bgCardLight : done ? `linear-gradient(135deg, ${player.color} 0%, ${player.color}99 100%)` : colors.bgCardLight,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {done && <Icons.check size={12} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Habits Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
          
          {/* Habits List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Today's Habits</h2>
              <span style={{ fontSize: '13px', color: colors.textMuted }}>{stats.todayComplete} of {stats.todayTotal}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {habits.map(habit => (
                <div key={habit.id}>
                  <div 
                    className="card card-hover"
                    style={{ 
                      padding: '18px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      borderColor: habit.struggling ? `${colors.amber}40` : colors.border,
                      background: habit.struggling 
                        ? `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.amber}08 100%)`
                        : `linear-gradient(145deg, ${colors.bgCard} 0%, ${colors.bgCardLight} 100%)`,
                    }}
                  >
                    {/* Completion Circle */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', marginRight: '14px', flexShrink: 0,
                      background: habit.completed ? `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)` : colors.bgCardLight,
                      border: habit.completed ? 'none' : `2px solid ${colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {habit.completed && <Icons.check size={20} />}
                    </div>

                    {/* Color Indicator */}
                    <div style={{
                      width: '4px', height: '36px', borderRadius: '2px', marginRight: '14px', flexShrink: 0,
                      background: `linear-gradient(180deg, ${habit.color} 0%, ${habit.color}60 100%)`,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>{habit.name}</span>
                        {habit.struggling && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Icons.alertCircle size={14} color={colors.amber} />
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: colors.textMuted }}>{habit.goal}</div>
                    </div>

                    {/* Weekly Rate */}
                    <div style={{ textAlign: 'right', marginRight: '12px' }}>
                      <div style={{ 
                        fontSize: '14px', fontWeight: 700,
                        color: habit.weeklyRate >= 70 ? colors.green : habit.weeklyRate >= 50 ? colors.amber : colors.red,
                      }}>
                        {habit.weeklyRate}%
                      </div>
                      <div style={{ fontSize: '11px', color: colors.textMuted }}>this week</div>
                    </div>

                    <Icons.chevron />
                  </div>

                  {/* Struggling Prompt */}
                  {habit.struggling && (
                    <div style={{
                      margin: '8px 0 0 58px',
                      padding: '14px 16px',
                      background: colors.bgCard,
                      borderRadius: '12px',
                      border: `1px solid ${colors.amber}30`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <Icons.alertCircle size={18} color={colors.amber} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, lineHeight: 1.5 }}>
                            You've been struggling with this habit lately. Want to discuss with your coach or try something different?
                          </p>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            <button className="btn-primary" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Icons.message size={14} color="white" />
                              Talk to Coach
                            </button>
                            <button className="btn-ghost" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Icons.refresh size={14} color={colors.textSecondary} />
                              Change Habit
                            </button>
                          </div>
                        </div>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                          <Icons.x size={14} color={colors.textMuted} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Request Rivalry */}
            {!rivalry.active && (
              <button
                onClick={() => setShowRivalryRequest(true)}
                className="btn-ghost"
                style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '14px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <Icons.swords size={18} color={colors.textSecondary} />
                Request a Rivalry
              </button>
            )}
          </div>

          {/* This Week Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>This Week</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textMuted }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors.bgCardLight }} />
                  Incomplete
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.textMuted }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors.purple }} />
                  Complete
                </span>
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              {/* Header Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(7, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: 600 }}>HABIT</div>
                {weekDays.map((day, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: i === 4 ? colors.purple : colors.textMuted, fontWeight: 600 }}>{day}</div>
                    <div style={{ fontSize: '14px', fontWeight: i === 4 ? 700 : 500, color: i === 4 ? colors.purple : colors.textSecondary, marginTop: '2px' }}>
                      {22 + i}
                    </div>
                  </div>
                ))}
              </div>

              {/* Habit Rows */}
              {habits.map((habit, habitIdx) => (
                <div 
                  key={habit.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px repeat(7, 1fr)',
                    gap: '8px',
                    padding: '14px 0',
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: `linear-gradient(180deg, ${habit.color} 0%, ${habit.color}60 100%)` }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {habit.name}
                    </span>
                  </div>
                  {weekDays.map((_, dayIdx) => {
                    const done = dayIdx < 5 ? Math.random() > 0.35 : false;
                    const isFuture = dayIdx > 4;
                    return (
                      <div key={dayIdx} style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px',
                          background: isFuture ? colors.bgCardLight : done ? `linear-gradient(135deg, ${habit.color} 0%, ${habit.color}80 100%)` : colors.bgCardLight,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {!isFuture && done && <Icons.check size={16} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Request Rivalry Modal */}
      {showRivalryRequest && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setShowRivalryRequest(false)}>
          <div 
            className="card"
            style={{ width: '100%', maxWidth: '420px', padding: '32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '20px',
                background: `linear-gradient(135deg, ${colors.red}20 0%, ${colors.purple}20 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Icons.swords size={32} color={colors.red} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>Request a Rivalry</h2>
              <p style={{ margin: 0, color: colors.textMuted, fontSize: '14px' }}>Your coach will match you with an opponent</p>
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
                placeholder="Any preferences for opponent or notes for your coach..."
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '12px',
                  background: colors.bgCardLight, border: `1px solid ${colors.border}`,
                  color: colors.textPrimary, fontSize: '14px', resize: 'none', height: '80px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-ghost" onClick={() => setShowRivalryRequest(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px' }}>
                Cancel
              </button>
              <button className="btn-primary" style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Icons.send size={14} />
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitDashboardDesktopV2;
