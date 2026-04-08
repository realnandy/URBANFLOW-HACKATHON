/**
 * Dashboard — Glassmorphism overlay UI with stats, controls, and event feed.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../../store/Store';

// =========================================
// Theme Hook
// =========================================
function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('uf-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('uf-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Add transition class for smooth change
    document.documentElement.classList.add('theme-transitioning');
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 500);
  }, []);

  return { theme, toggleTheme };
}

// =========================================
// Header Bar
// =========================================
function HeaderBar() {
  const { state } = useStore();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header-bar" id="header-bar">
      <div className="brand">
        <div className="brand-logo">UF</div>
        <div className="brand-text">
          <h1>UrbanFlow</h1>
          <span>Smart Traffic Digital Twin — Bengaluru</span>
        </div>
      </div>
      <div className="header-status">
        <div className="status-indicator">
          <div className={`status-dot ${state.connected ? 'live' : 'warning'}`} />
          {state.demoMode ? 'Demo Mode' : state.connected ? 'Live Stream' : 'Connecting...'}
        </div>
        <div className="status-indicator" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          T+{state.tick}
        </div>
        <button
          className="theme-toggle"
          id="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          <span className="icon spin-in" key={theme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
        </button>
      </div>
    </header>
  );
}

// =========================================
// Stats Panel (Left Side)
// =========================================
function StatsPanel() {
  const { state } = useStore();
  const { stats, trafficData } = state;
  const total = stats.total_segments || Object.keys(trafficData).length || 0;

  const greenPct = total ? ((stats.green / total) * 100).toFixed(0) : 0;
  const yellowPct = total ? ((stats.yellow / total) * 100).toFixed(0) : 0;
  const redPct = total ? ((stats.red / total) * 100).toFixed(0) : 0;

  return (
    <div className="stats-panel" id="stats-panel">
      <div className="glass-panel stat-card">
        <span className="stat-label">Total Segments</span>
        <span className="stat-value cyan">{total}</span>
        <span className="stat-sub">Active road segments</span>
      </div>

      <div className="glass-panel stat-card">
        <span className="stat-label">Avg. Density</span>
        <span className={`stat-value ${stats.avg_density > 0.6 ? 'red' : stats.avg_density > 0.35 ? 'yellow' : 'green'}`}>
          {(stats.avg_density * 100).toFixed(1)}%
        </span>
        <span className="stat-sub">Network load</span>
      </div>

      <div className="glass-panel stat-card">
        <span className="stat-label">Avg. Speed</span>
        <span className="stat-value purple">{stats.avg_speed_mph || 0}</span>
        <span className="stat-sub">mph across network</span>
      </div>

      <div className="glass-panel traffic-bar-container">
        <span className="stat-label" style={{ display: 'block', marginBottom: '8px' }}>Traffic Distribution</span>
        <div className="traffic-bar">
          <div className="bar-segment green" style={{ width: `${greenPct}%` }} />
          <div className="bar-segment yellow" style={{ width: `${yellowPct}%` }} />
          <div className="bar-segment red" style={{ width: `${redPct}%` }} />
        </div>
        <div className="traffic-bar-labels">
          <span>🟢 {greenPct}%</span>
          <span>🟡 {yellowPct}%</span>
          <span>🔴 {redPct}%</span>
        </div>
      </div>
    </div>
  );
}

// =========================================
// Control Panel (Right Side)
// =========================================
// =========================================
// Bangalore Area Name Mapping
// =========================================
const BANGALORE_NAMES = {
  // Row 0 — North Bangalore
  'n_0_0': 'Yelahanka', 'n_0_1': 'Jakkur', 'n_0_2': 'Sahakara Nagar',
  'n_0_3': 'Vidyaranyapura', 'n_0_4': 'Thanisandra', 'n_0_5': 'Hennur',
  'n_0_6': 'Kalyan Nagar', 'n_0_7': 'Horamavu', 'n_0_8': 'Ramamurthy Nagar',
  'n_0_9': 'Banaswadi', 'n_0_10': 'KR Puram', 'n_0_11': 'Mahadevapura', 'n_0_12': 'Whitefield',
  // Row 1
  'n_1_0': 'Yeshwanthpur', 'n_1_1': 'Mathikere', 'n_1_2': 'Malleshwaram',
  'n_1_3': 'Sadashivanagar', 'n_1_4': 'Hebbal', 'n_1_5': 'RT Nagar',
  'n_1_6': 'HBR Layout', 'n_1_7': 'Kammanahalli', 'n_1_8': 'Lingarajapuram',
  'n_1_9': 'Cox Town', 'n_1_10': 'Fraser Town', 'n_1_11': 'CV Raman Nagar', 'n_1_12': 'Brookefield',
  // Row 2
  'n_2_0': 'Rajajinagar', 'n_2_1': 'Vijayanagar', 'n_2_2': 'Basaveshwaranagar',
  'n_2_3': 'Mahalakshmi Layout', 'n_2_4': 'Seshadripuram', 'n_2_5': 'Shivaji Nagar',
  'n_2_6': 'Commercial Street', 'n_2_7': 'Ulsoor', 'n_2_8': 'Indiranagar',
  'n_2_9': 'Domlur', 'n_2_10': 'Old Airport Road', 'n_2_11': 'HAL', 'n_2_12': 'Marathahalli',
  // Row 3
  'n_3_0': 'Nagarbhavi', 'n_3_1': 'Nandini Layout', 'n_3_2': 'Magadi Road',
  'n_3_3': 'Chamarajpet', 'n_3_4': 'KR Market', 'n_3_5': 'City Market',
  'n_3_6': 'MG Road', 'n_3_7': 'Richmond Town', 'n_3_8': 'Ejipura',
  'n_3_9': 'Koramangala', 'n_3_10': 'Madiwala', 'n_3_11': 'Bellandur', 'n_3_12': 'Sarjapur Road',
  // Row 4 — Central South
  'n_4_0': 'Kengeri', 'n_4_1': 'RR Nagar', 'n_4_2': 'Mysore Road',
  'n_4_3': 'Basavanagudi', 'n_4_4': 'Lalbagh', 'n_4_5': 'Wilson Garden',
  'n_4_6': 'Jayanagar', 'n_4_7': 'BTM Layout', 'n_4_8': 'HSR Layout',
  'n_4_9': 'Agara', 'n_4_10': 'Silk Board', 'n_4_11': 'Iblur', 'n_4_12': 'Varthur',
  // Row 5
  'n_5_0': 'Kanakapura Road', 'n_5_1': 'Uttarahalli', 'n_5_2': 'Padmanabhanagar',
  'n_5_3': 'JP Nagar', 'n_5_4': 'Sarakki', 'n_5_5': 'Bannerghatta Road',
  'n_5_6': 'Arekere', 'n_5_7': 'Begur', 'n_5_8': 'Bommanahalli',
  'n_5_9': 'Hongasandra', 'n_5_10': 'Kudlu', 'n_5_11': 'Hosa Road', 'n_5_12': 'Electronic City North',
  // Row 6
  'n_6_0': 'Talaghattapura', 'n_6_1': 'Anjanapura', 'n_6_2': 'Vajrahalli',
  'n_6_3': 'JP Nagar 7th Phase', 'n_6_4': 'Puttenahalli', 'n_6_5': 'Hulimavu',
  'n_6_6': 'Konanakunte', 'n_6_7': 'Gottigere', 'n_6_8': 'Singasandra',
  'n_6_9': 'Akshayanagar', 'n_6_10': 'Huskur Gate', 'n_6_11': 'Electronic City', 'n_6_12': 'Electronic City South',
  // Row 7
  'n_7_0': 'Jigani', 'n_7_1': 'Harohalli', 'n_7_2': 'Bannerghatta',
  'n_7_3': 'Doddakallasandra', 'n_7_4': 'Thalaghattapura', 'n_7_5': 'Koppa Gate',
  'n_7_6': 'Hebbagodi', 'n_7_7': 'Bommasandra', 'n_7_8': 'Chandapura',
  'n_7_9': 'Suryanagar', 'n_7_10': 'Attibele', 'n_7_11': 'Anekal', 'n_7_12': 'Sarjapura',
  // Row 8 — Southernmost
  'n_8_0': 'Bidadi', 'n_8_1': 'Kanakapura', 'n_8_2': 'Bannerghatta NP',
  'n_8_3': 'Ragihalli', 'n_8_4': 'Jigani Industrial', 'n_8_5': 'Bommasandra Ind.',
  'n_8_6': 'Naganathapura', 'n_8_7': 'Jigani Hobli', 'n_8_8': 'Chandapura Circle',
  'n_8_9': 'Hosur Road', 'n_8_10': 'Attibele Gate', 'n_8_11': 'Anekal Town', 'n_8_12': 'Sarjapura Town',
};

function getNodeLabel(nodeId) {
  return BANGALORE_NAMES[nodeId] || nodeId.replace(/_/g, ' ').toUpperCase();
}

function ControlPanel() {
  const { state, requestRouteREST, addObstacle, clearObstacles, toggleObstacleMode } = useStore();
  const [origin, setOrigin] = useState('n_2_8');
  const [destination, setDestination] = useState('n_5_11');

  // Generate node list for dropdowns
  const nodeOptions = useMemo(() => {
    const nodes = [];
    for (let r = 0; r <= 8; r++) {
      for (let c = 0; c <= 12; c++) {
        nodes.push(`n_${r}_${c}`);
      }
    }
    return nodes;
  }, []);

  const handleRoute = () => {
    if (origin && destination && origin !== destination) {
      requestRouteREST(origin, destination);
    }
  };

  return (
    <div className="control-panel" id="control-panel">
      <div className="glass-panel">
        <div className="panel-title">🚨 Emergency Router</div>
        <div className="route-controls">
          <div className="route-select">
            <label htmlFor="origin-select">Origin</label>
            <select
              id="origin-select"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              {nodeOptions.map(n => (
                <option key={n} value={n}>{getNodeLabel(n)}</option>
              ))}
            </select>
          </div>
          <div className="route-select">
            <label htmlFor="dest-select">Destination</label>
            <select
              id="dest-select"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              {nodeOptions.map(n => (
                <option key={n} value={n}>{getNodeLabel(n)}</option>
              ))}
            </select>
          </div>
          <button
            className="btn-emergency"
            id="btn-dispatch"
            onClick={handleRoute}
            disabled={state.routeLoading || origin === destination}
          >
            {state.routeLoading ? '⏳ Computing...' : '🚑 Dispatch Emergency Route'}
          </button>
        </div>
      </div>

      {state.routeResult && (
        <div className="glass-panel route-result">
          <h4>📍 Route Calculated</h4>
          <div className="route-stat">
            <span>Path Length</span>
            <span>{state.routeResult.path?.length || 0} nodes</span>
          </div>
          <div className="route-stat">
            <span>Total Cost</span>
            <span>{state.routeResult.total_cost?.toFixed(0) || 'N/A'} ft</span>
          </div>
          <div className="route-stat">
            <span>Est. Time</span>
            <span>{state.routeResult.estimated_time_minutes || 'N/A'} min</span>
          </div>
          <div className="route-stat">
            <span>Nodes Explored</span>
            <span>{state.routeResult.nodes_visited || 'N/A'}</span>
          </div>
          {/* Vehicle Progress */}
          {state.vehicleMoving && (
            <div className="vehicle-status">
              <div className="vehicle-status-header">
                <span>🚑 Vehicle Progress</span>
                <span className="vehicle-pct">{Math.round(state.vehicleProgress * 100)}%</span>
              </div>
              <div className="vehicle-progress-bar">
                <div className="vehicle-progress-fill" style={{ width: `${state.vehicleProgress * 100}%` }} />
              </div>
            </div>
          )}
          {state.rerouting && (
            <div className="rerouting-indicator">
              <span className="rerouting-spinner" />
              <span>Rerouting...</span>
            </div>
          )}
        </div>
      )}

      {/* Obstacle Controls */}
      <div className="glass-panel obstacle-panel">
        <div className="panel-title">🚧 Obstacle Manager</div>
        <div className="obstacle-controls">
          <button
            className={`btn-obstacle ${state.obstacleMode ? 'active' : ''}`}
            id="btn-obstacle-toggle"
            onClick={toggleObstacleMode}
          >
            {state.obstacleMode ? '✋ Click Map to Place' : '🚧 Place Obstacle'}
          </button>
          {state.obstacleMode && (
            <div className="obstacle-hint">
              Click on a road intersection to place an obstacle. The vehicle will automatically reroute.
            </div>
          )}
          <div className="obstacle-count">
            <span>Active Obstacles</span>
            <span className="obstacle-count-value">{state.obstacles.length}</span>
          </div>
          {state.obstacles.length > 0 && (
            <button
              className="btn-clear-obstacles"
              id="btn-clear-obstacles"
              onClick={clearObstacles}
            >
              🗑️ Clear All Obstacles
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel">
        <div className="panel-title">📡 Live Events</div>
        <EventFeed />
      </div>
    </div>
  );
}

// =========================================
// Event Feed
// =========================================
function EventFeed() {
  const { state } = useStore();

  const displayEvents = state.events.slice(0, 15);

  return (
    <div className="event-feed" id="event-feed">
      {displayEvents.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px 0' }}>
          Waiting for events...
        </div>
      )}
      {displayEvents.map((event, idx) => {
        const isAccident = event.type === 'accident' || event.event_type === 'accident';
        const isReroute = event.type === 'reroute';
        const isBlocked = event.type === 'route_blocked';
        const severity = event.severity || event.payload?.severity || 'unknown';
        const segId = event.segment_id || event.payload?.segment_id || 'N/A';

        let icon = '🛣️', label = 'Route Event', iconClass = 'route';
        if (isAccident) { icon = '⚠️'; label = 'Accident Detected'; iconClass = 'accident'; }
        else if (isReroute) { icon = '🔄'; label = 'Route Rerouted'; iconClass = 'reroute'; }
        else if (isBlocked) { icon = '🚫'; label = 'Route Blocked'; iconClass = 'accident'; }

        return (
          <div key={idx} className="event-item">
            <div className={`event-icon ${iconClass}`}>
              {icon}
            </div>
            <div className="event-details">
              <div className="event-title">
                {label}
                {' '}
                <span className={`severity-badge ${severity}`}>{severity}</span>
              </div>
              <div className="event-meta">{segId}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================================
// Bottom Bar
// =========================================
function BottomBar() {
  const { state } = useStore();
  const { predictions } = state;
  const predictionEntries = Object.entries(predictions).slice(0, 3);

  return (
    <div className="bottom-bar" id="bottom-bar">
      <div className="glass-panel mini-stat">
        <div className="mini-icon cyan">🧠</div>
        <div className="mini-info">
          <span className="mini-value" style={{ color: 'var(--accent-cyan)' }}>LSTM</span>
          <span className="mini-label">Traffic AI</span>
        </div>
      </div>

      <div className="glass-panel mini-stat">
        <div className="mini-icon purple">🌐</div>
        <div className="mini-info">
          <span className="mini-value" style={{ color: 'var(--accent-purple)' }}>Dijkstra</span>
          <span className="mini-label">Route Engine</span>
        </div>
      </div>

      {predictionEntries.map(([segId, pred]) => (
        <div key={segId} className="glass-panel mini-stat">
          <div className="mini-icon green">📊</div>
          <div className="mini-info">
            <span className="mini-value" style={{ color: pred > 0.6 ? 'var(--accent-red)' : pred > 0.35 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
              {(pred * 100).toFixed(0)}%
            </span>
            <span className="mini-label">{segId} (predicted)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// =========================================
// Loading Screen
// =========================================
export function LoadingScreen() {
  return (
    <div className="loading-screen" id="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">
        <h2>UrbanFlow</h2>
        <p>Initializing Smart Traffic Digital Twin...</p>
      </div>
    </div>
  );
}

// =========================================
// Export Dashboard
// =========================================
export default function Dashboard() {
  return (
    <>
      <HeaderBar />
      <StatsPanel />
      <ControlPanel />
      <BottomBar />
    </>
  );
}
