import React, { useState } from 'react';

const ClientDashboardDark = () => {
  const [activeTab, setActiveTab] = useState('home');
  
  // Sample data
  const user = { name: 'Heather', avatar: 'H' };
  
  const todayWorkout = {
    name: 'Full Body A',
    subtitle: 'Push Focus',
    duration: '45 min',
    exercises: 12,
    week: 2,
    day: 3,
  };
  
  const [habits, setHabits] = useState([
    { id: 'water', name: 'Water', target: '8 glasses', completed: true, streak: 12, icon: 'water' },
    { id: 'protein', name: 'Protein', target: '150g', completed: true, streak: 8, icon: 'protein' },
    { id: 'sleep', name: 'Sleep', target: '8 hours', completed: false, streak: 5, icon: 'sleep' },
    { id: 'creatine', name: 'Creatine', target: '5g', completed: false, streak: 21, icon: 'creatine' },
  ]);
  
  const weekDays = [
    { day: 'M', date: 22, completed: true, hasWorkout: true },
    { day: 'T', date: 23, completed: true, hasWorkout: false },
    { day: 'W', date: 24, completed: false, hasWorkout: false },
    { day: 'T', date: 25, completed: false, hasWorkout: true },
    { day: 'F', date: 26, completed: false, hasWorkout: false, isToday: true },
    { day: 'S', date: 27, completed: false, hasWorkout: false },
    { day: 'S', date: 28, completed: false, hasWorkout: true },
  ];
  
  const completedHabits = habits.filter(h => h.completed).length;
  const totalStreak = 12;

  const toggleHabit = (id) => {
    setHabits(habits.map(h => 
      h.id === id ? { ...h, completed: !h.completed } : h
    ));
  };

  // Colors
  const colors = {
    bg: '#0f0f1a',
    card: '#1a1a2e',
    cardHover: '#222238',
    purple: '#8b5cf6',
    purpleLight: '#a78bfa',
    purpleDark: '#7c3aed',
    green: '#10b981',
    greenLight: '#34d399',
    amber: '#f59e0b',
    red: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    border: '#2a2a40',
  };

  // Icons
  const Icons = {
    water: ({ color = '#0ea5e9', size = 22 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
      </svg>
    ),
    protein: ({ color = '#ef4444', size = 22 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M15.5 2.5L18 5l-2.5 2.5M9 12l-4.5 4.5c-.78.78-.78 2.05 0 2.83l.17.17c.78.78 2.05.78 2.83 0L12 15M15.5 2.5L22 9l-6.5 6.5L9 9z"/>
      </svg>
    ),
    sleep: ({ color = '#8b5cf6', size = 22 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
    creatine: ({ color = '#10b981', size = 22 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h6"/>
      </svg>
    ),
    dumbbell: ({ color = 'currentColor', size = 24 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M6 12h12M3 9v6M6 7v10M18 7v10M21 9v6"/>
      </svg>
    ),
    flame: ({ color = '#f59e0b', size = 18 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z"/>
      </svg>
    ),
    check: ({ color = 'white', size = 16 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    play: ({ color = 'white', size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
    home: ({ color = 'currentColor', size = 24 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    user: ({ color = 'currentColor', size = 24 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    chevronRight: ({ color = 'currentColor', size = 20 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    ),
    clock: ({ color = 'currentColor', size = 16 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    zap: ({ color = 'currentColor', size = 16 }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  };

  const getHabitIcon = (iconName, completed) => {
    const iconColor = completed ? '#10b981' : {
      water: '#0ea5e9',
      protein: '#ef4444', 
      sleep: '#8b5cf6',
      creatine: '#10b981',
    }[iconName];
    
    const IconComponent = Icons[iconName];
    return IconComponent ? <IconComponent color={iconColor} size={20} /> : null;
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: colors.bg,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      position: 'relative',
      paddingBottom: '100px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        @keyframes checkmark {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
        .card {
          background: ${colors.card};
          border-radius: 20px;
          border: 1px solid ${colors.border};
        }
        
        .habit-row {
          transition: all 0.2s ease;
        }
        
        .habit-row:active {
          transform: scale(0.98);
          background: ${colors.cardHover};
        }
        
        .workout-btn {
          transition: all 0.2s ease;
        }
        
        .workout-btn:active {
          transform: scale(0.97);
        }
        
        .nav-item {
          transition: all 0.15s ease;
        }
        
        .streak-badge {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      {/* Status Bar Spacer */}
      <div style={{ height: '50px' }} />

      {/* Header */}
      <div style={{
        padding: '0 20px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ 
            margin: 0, 
            fontSize: '13px', 
            color: colors.textMuted,
            fontWeight: 500,
            marginBottom: '4px',
          }}>
            Good morning
          </p>
          <h1 style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 700,
            color: colors.textPrimary,
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '-0.5px',
          }}>
            {user.name}
          </h1>
        </div>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
          fontWeight: 600,
        }}>
          {user.avatar}
        </div>
      </div>

      {/* Today's Workout Card */}
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <div style={{
          background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
          borderRadius: '24px',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUp 0.4s ease both',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '140px',
            height: '140px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
          }}/>
          <div style={{
            position: 'absolute',
            bottom: '-20px',
            left: '30%',
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%',
          }}/>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '6px',
                }}>
                  Today's Workout
                </p>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'white',
                  letterSpacing: '-0.3px',
                }}>
                  {todayWorkout.name}
                </h2>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.7)',
                }}>
                  {todayWorkout.subtitle}
                </p>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'white',
              }}>
                Week {todayWorkout.week}
              </div>
            </div>
            
            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.clock color="rgba(255,255,255,0.7)" size={16} />
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {todayWorkout.duration}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.zap color="rgba(255,255,255,0.7)" size={16} />
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  {todayWorkout.exercises} exercises
                </span>
              </div>
            </div>
            
            {/* Start Button */}
            <button 
              className="workout-btn"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                background: 'white',
                color: colors.purpleDark,
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              Start Workout
              <Icons.play color={colors.purpleDark} size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Week Progress */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
              This Week
            </span>
            <span style={{ fontSize: '13px', color: colors.textMuted }}>
              1 of 4 workouts
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {weekDays.map((day, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: day.isToday ? colors.purple : colors.textMuted,
                  marginBottom: '8px',
                }}>
                  {day.day}
                </div>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: day.isToday 
                    ? `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`
                    : day.completed 
                      ? colors.green
                      : colors.cardHover,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: day.isToday || day.completed ? 'white' : colors.textMuted,
                  fontSize: '14px',
                  fontWeight: 600,
                  border: day.hasWorkout && !day.completed && !day.isToday 
                    ? `2px solid ${colors.purple}40` 
                    : 'none',
                }}>
                  {day.completed ? (
                    <Icons.check color="white" size={18} />
                  ) : (
                    day.date
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Habits */}
      <div style={{ padding: '0 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: colors.textPrimary,
            }}>
              Daily Habits
            </h3>
            <span style={{
              background: completedHabits === habits.length 
                ? `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)`
                : colors.cardHover,
              color: completedHabits === habits.length ? 'white' : colors.textSecondary,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {completedHabits}/{habits.length}
            </span>
          </div>
          <div className="streak-badge" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: `${colors.amber}20`,
            padding: '6px 10px',
            borderRadius: '10px',
          }}>
            <Icons.flame color={colors.amber} size={16} />
            <span style={{ color: colors.amber, fontWeight: 700, fontSize: '13px' }}>{totalStreak}</span>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {habits.map((habit, index) => (
            <div
              key={habit.id}
              className="habit-row"
              onClick={() => toggleHabit(habit.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 18px',
                borderBottom: index < habits.length - 1 ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                background: habit.completed ? `${colors.green}08` : 'transparent',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: habit.completed 
                  ? `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)`
                  : colors.cardHover,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {habit.completed ? (
                  <Icons.check color="white" size={20} />
                ) : (
                  getHabitIcon(habit.icon, false)
                )}
              </div>
              
              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontSize: '15px', 
                    fontWeight: 600, 
                    color: colors.textPrimary,
                  }}>
                    {habit.name}
                  </span>
                  {habit.streak > 0 && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.amber,
                    }}>
                      <Icons.flame color={colors.amber} size={12} />
                      {habit.streak}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: colors.textMuted }}>
                  {habit.target}
                </span>
              </div>
              
              {/* Checkbox */}
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                border: habit.completed ? 'none' : `2px solid ${colors.border}`,
                background: habit.completed 
                  ? `linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%)`
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {habit.completed && <Icons.check color="white" size={14} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ padding: '0 20px' }}>
        <h3 style={{
          margin: '0 0 14px',
          fontSize: '16px',
          fontWeight: 700,
          color: colors.textPrimary,
        }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'Weekly Check-in', icon: '📋', color: colors.green, badge: 'Due' },
            { label: 'Message Coach', icon: '💬', color: colors.purple },
          ].map((action, i) => (
            <div
              key={i}
              className="card"
              style={{
                flex: 1,
                padding: '18px',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {action.badge && (
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: action.color,
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}>
                  {action.badge}
                </span>
              )}
              <span style={{ fontSize: '24px', display: 'block', marginBottom: '10px' }}>
                {action.icon}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: colors.textPrimary,
              }}>
                {action.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        padding: '12px 24px 28px',
        background: `linear-gradient(180deg, transparent 0%, ${colors.bg} 20%)`,
      }}>
        <div style={{
          background: colors.card,
          borderRadius: '20px',
          padding: '8px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          border: `1px solid ${colors.border}`,
        }}>
          {[
            { id: 'home', icon: Icons.home, label: 'Home' },
            { id: 'workouts', icon: Icons.dumbbell, label: 'Workouts' },
            { id: 'profile', icon: Icons.user, label: 'Profile' },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                className="nav-item"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 24px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  background: isActive 
                    ? `linear-gradient(135deg, ${colors.purple}20 0%, ${colors.purpleDark}20 100%)`
                    : 'transparent',
                }}
              >
                <Icon color={isActive ? colors.purple : colors.textMuted} size={22} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isActive ? colors.purple : colors.textMuted,
                }}>
                  {tab.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboardDark;
