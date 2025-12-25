import React, { useState } from 'react';

const CoachDashboardRedesign = () => {
  const [activeNav, setActiveNav] = useState('dashboard');
  
  // Sample data - in real app would come from API
  const stats = {
    activeClients: 8,
    workoutsToday: 3,
    completedToday: 2,
    thisWeek: 18,
    scheduledWeek: 24,
    prsThisWeek: 5,
    unreadNotes: 3,
  };

  const clientsNeedingAttention = [
    { id: 1, name: 'Jordan Escoto', avatar: 'J', issue: 'No workout in 6 days', severity: 'high', program: 'General Fitness' },
    { id: 2, name: 'Heather Swear', avatar: 'H', issue: 'Missed 3 sessions this week', severity: 'medium', program: 'Powerlifting Prep' },
  ];

  const recentActivity = [
    { id: 1, type: 'completion', client: 'Alex Ramirez', avatar: 'A', action: 'completed', detail: 'Upper Body Push', time: '2 hours ago', extra: '45 min • 6 exercises' },
    { id: 2, type: 'pr', client: 'Marcus Chen', avatar: 'M', action: 'hit a PR', detail: 'Bench Press', time: '3 hours ago', extra: '185 lbs × 5' },
    { id: 3, type: 'note', client: 'Anna Nazarian', avatar: 'A', action: 'left feedback', detail: 'Squat Day', time: '5 hours ago', extra: '"Felt strong today, hip is feeling better!"' },
    { id: 4, type: 'completion', client: 'Danielle Buford', avatar: 'D', action: 'completed', detail: 'Lower Body', time: 'Yesterday', extra: '52 min • 7 exercises' },
    { id: 5, type: 'pr', client: 'Alex Ramirez', avatar: 'A', action: 'hit a PR', detail: 'Deadlift', time: 'Yesterday', extra: '315 lbs × 3' },
  ];

  const weekSchedule = [
    { day: 'Mon', date: 16, scheduled: 4, completed: 4 },
    { day: 'Tue', date: 17, scheduled: 3, completed: 2, isToday: true },
    { day: 'Wed', date: 18, scheduled: 5, completed: 0 },
    { day: 'Thu', date: 19, scheduled: 4, completed: 0 },
    { day: 'Fri', date: 20, scheduled: 3, completed: 0 },
    { day: 'Sat', date: 21, scheduled: 3, completed: 0 },
    { day: 'Sun', date: 22, scheduled: 2, completed: 0 },
  ];

  // Icons
  const Icons = {
    plus: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    grid: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    dumbbell: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6.5 6.5h11M6.5 17.5h11M6 12h12M3 9v6M6 7v10M18 7v10M21 9v6"/>
      </svg>
    ),
    calendar: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    trophy: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/><path d="M10 22V8a4 4 0 0 1 8 0v14"/>
        <path d="M9 8h6"/><path d="M12 8v14"/>
      </svg>
    ),
    messageCircle: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
    alertTriangle: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    check: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    chevronRight: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    ),
    flame: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z"/>
      </svg>
    ),
    trendUp: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'completion':
        return (
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icons.check}
          </div>
        );
      case 'pr':
        return (
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '16px' }}>⭐</span>
          </div>
        );
      case 'note':
        return (
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            {Icons.messageCircle}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.03);
          transition: all 0.2s ease;
        }
        
        .card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
        }
        
        .stat-card {
          transition: all 0.2s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-2px);
        }
        
        .activity-item {
          transition: all 0.15s ease;
        }
        
        .activity-item:hover {
          background: #f8fafc;
        }
        
        .attention-card {
          transition: all 0.2s ease;
        }
        
        .attention-card:hover {
          transform: translateX(4px);
        }
        
        .nav-item {
          transition: all 0.15s ease;
        }
        
        .nav-item:hover {
          background: rgba(99, 102, 241, 0.08);
        }
      `}</style>

      {/* Top Navigation */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <h1 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '-0.5px',
            }}>
              SWEAR STRENGTH
            </h1>
            
            {/* Nav Items */}
            <nav style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Icons.grid },
                { id: 'clients', label: 'Clients', icon: Icons.users },
                { id: 'programs', label: 'Programs', icon: Icons.dumbbell },
                { id: 'exercises', label: 'Exercises', icon: Icons.calendar },
              ].map(item => (
                <button
                  key={item.id}
                  className="nav-item"
                  onClick={() => setActiveNav(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeNav === item.id ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)' : 'transparent',
                    color: activeNav === item.id ? '#6366f1' : '#64748b',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ opacity: activeNav === item.id ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Swear Strength</span>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              SS
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 700,
              color: '#1e293b',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '-0.5px',
            }}>
              Good evening, Heather
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '15px', color: '#64748b' }}>
              Here's what's happening with your clients today
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              {Icons.grid}
              Exercise Library
            </button>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.4)',
            }}>
              {Icons.plus}
              New Program
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {/* Active Clients */}
          <div className="card stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
              }}>
                {Icons.users}
              </div>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {Icons.trendUp} +2
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {stats.activeClients}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Active Clients</div>
          </div>

          {/* Workouts Today */}
          <div className="card stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}>
                {Icons.dumbbell}
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {stats.workoutsToday}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
              Workouts Today
              <span style={{ color: '#10b981', fontWeight: 600, marginLeft: '6px' }}>
                {stats.completedToday} done
              </span>
            </div>
          </div>

          {/* This Week */}
          <div className="card stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0ea5e9',
              }}>
                {Icons.calendar}
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {stats.thisWeek}<span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 500 }}>/{stats.scheduledWeek}</span>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>This Week</div>
          </div>

          {/* PRs This Week */}
          <div className="card stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}>
                {Icons.trophy}
              </div>
              <span style={{ color: '#f59e0b', fontSize: '16px' }}>
                {Icons.flame}
              </span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {stats.prsThisWeek}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>PRs This Week</div>
          </div>

          {/* Unread Notes */}
          <div className="card stat-card" style={{ padding: '24px', background: stats.unreadNotes > 0 ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'white' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: stats.unreadNotes > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' : 'rgba(148, 163, 184, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stats.unreadNotes > 0 ? 'white' : '#94a3b8',
              }}>
                {Icons.messageCircle}
              </div>
              {stats.unreadNotes > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}>
                  NEW
                </span>
              )}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1e293b', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {stats.unreadNotes}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Unread Notes</div>
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Weekly Schedule */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>This Week</h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Dec 16 - 22</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
                {weekSchedule.map((day, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: 'center',
                      padding: '16px 8px',
                      borderRadius: '16px',
                      background: day.isToday 
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : day.completed === day.scheduled && day.scheduled > 0
                          ? '#f0fdf4'
                          : '#f8fafc',
                      border: day.isToday ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: day.isToday ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                      marginBottom: '4px',
                    }}>
                      {day.day}
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: day.isToday ? 'white' : '#1e293b',
                      marginBottom: '8px',
                    }}>
                      {day.date}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: day.isToday 
                        ? 'white' 
                        : day.completed === day.scheduled && day.scheduled > 0
                          ? '#10b981'
                          : '#64748b',
                    }}>
                      {day.completed}/{day.scheduled}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: day.isToday ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                    }}>
                      workouts
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Recent Activity</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['All', 'PRs', 'Notes'].map(filter => (
                    <button
                      key={filter}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: filter === 'All' ? '#1e293b' : '#f1f5f9',
                        color: filter === 'All' ? 'white' : '#64748b',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentActivity.map((activity, i) => (
                  <div
                    key={activity.id}
                    className="activity-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '14px 0',
                      borderBottom: i < recentActivity.length - 1 ? '1px solid #f1f5f9' : 'none',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      margin: '0 -12px',
                      padding: '14px 12px',
                    }}
                  >
                    {getActivityIcon(activity.type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                          {activity.client}
                        </span>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {activity.action}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                          {activity.detail}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: activity.type === 'note' ? '#6366f1' : '#94a3b8' }}>
                        {activity.extra}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
              <button style={{
                width: '100%',
                padding: '12px',
                marginTop: '12px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                View All Activity
              </button>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Clients Needing Attention */}
            <div className="card" style={{
              padding: '24px',
              background: clientsNeedingAttention.length > 0 
                ? 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)'
                : 'white',
              borderColor: clientsNeedingAttention.length > 0 ? '#fecaca' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: clientsNeedingAttention.length > 0 
                    ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                    : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: clientsNeedingAttention.length > 0 ? 'white' : '#94a3b8',
                }}>
                  {Icons.alertTriangle}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    Clients Needing Attention
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                    {clientsNeedingAttention.length > 0 
                      ? `${clientsNeedingAttention.length} clients need follow-up`
                      : 'All clients on track!'
                    }
                  </p>
                </div>
              </div>

              {clientsNeedingAttention.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {clientsNeedingAttention.map(client => (
                    <div
                      key={client.id}
                      className="attention-card"
                      style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '16px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: client.severity === 'high' 
                            ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                            : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: 600,
                        }}>
                          {client.avatar}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                            {client.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {client.program}
                          </div>
                        </div>
                        <span style={{ color: '#94a3b8' }}>{Icons.chevronRight}</span>
                      </div>
                      <div style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: client.severity === 'high' ? '#fef2f2' : '#fffbeb',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: client.severity === 'high' ? '#dc2626' : '#d97706',
                      }}>
                        {client.issue}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}>
                    <span style={{ color: '#10b981' }}>{Icons.check}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                    All clients are on track!
                  </p>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                Top Performers
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { name: 'Marcus Chen', metric: '100%', label: 'compliance', streak: 21 },
                  { name: 'Alex Ramirez', metric: '95%', label: 'compliance', streak: 14 },
                  { name: 'Anna Nazarian', metric: '92%', label: 'compliance', streak: 8 },
                ].map((client, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: i === 0 
                        ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}>
                      {client.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                        {client.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {client.metric} {client.label}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#f59e0b',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}>
                      {Icons.flame}
                      {client.streak}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoachDashboardRedesign;
