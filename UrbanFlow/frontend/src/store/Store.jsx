/**
 * UrbanFlow State Store — lightweight reactive state management.
 * Includes offline demo mode that auto-activates if backend is unreachable.
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';

const StoreContext = createContext(null);

// ============================================
// Demo Data Generator (works without backend)
// ============================================
function generateDemoRoads() {
  const CENTER_LAT = 12.9716, CENTER_LNG = 77.5946;
  const BLOCKS_X = 12, BLOCKS_Y = 8;
  const BLK_LAT = 0.0009, BLK_LNG = 0.0012;
  const features = [];
  let seg = 0;

  // Horizontal
  for (let r = 0; r <= BLOCKS_Y; r++) {
    const lat = CENTER_LAT + (r - BLOCKS_Y / 2) * BLK_LAT;
    for (let c = 0; c < BLOCKS_X; c++) {
      const lng0 = CENTER_LNG + (c - BLOCKS_X / 2) * BLK_LNG;
      const lng1 = CENTER_LNG + (c + 1 - BLOCKS_X / 2) * BLK_LNG;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[lng0, lat], [lng1, lat]] },
        properties: { id: `seg_${seg++}`, name: `Street ${r+1}`, road_type: r % 3 === 0 ? 'avenue' : 'street', lanes: r % 3 === 0 ? 4 : 2, direction: 'EW' },
      });
    }
  }

  // Vertical
  for (let c = 0; c <= BLOCKS_X; c++) {
    const lng = CENTER_LNG + (c - BLOCKS_X / 2) * BLK_LNG;
    for (let r = 0; r < BLOCKS_Y; r++) {
      const lat0 = CENTER_LAT + (r - BLOCKS_Y / 2) * BLK_LAT;
      const lat1 = CENTER_LAT + (r + 1 - BLOCKS_Y / 2) * BLK_LAT;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[lng, lat0], [lng, lat1]] },
        properties: { id: `seg_${seg++}`, name: `Avenue ${c+1}`, road_type: c % 4 === 0 ? 'avenue' : 'street', lanes: c % 4 === 0 ? 4 : 2, direction: 'NS' },
      });
    }
  }

  // Diagonal
  for (let d = 0; d < 3; d++) {
    const startLat = CENTER_LAT - BLOCKS_Y / 2 * BLK_LAT;
    const startLng = CENTER_LNG + (d * 3 - 3 - BLOCKS_X / 2) * BLK_LNG;
    for (let s = 0; s < BLOCKS_Y; s++) {
      const lat0 = startLat + s * BLK_LAT, lng0 = startLng + s * BLK_LNG * 0.4;
      const lat1 = startLat + (s+1) * BLK_LAT, lng1 = startLng + (s+1) * BLK_LNG * 0.4;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[lng0, lat0], [lng1, lat1]] },
        properties: { id: `seg_${seg++}`, name: `Broadway ${d+1}`, road_type: 'boulevard', lanes: 6, direction: 'DIAG' },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

function generateDemoBuildings() {
  const CENTER_LAT = 12.9716, CENTER_LNG = 77.5946;
  const BLOCKS_X = 12, BLOCKS_Y = 8;
  const BLK_LAT = 0.0009, BLK_LNG = 0.0012;
  const features = [];
  const rand = (min, max) => min + Math.random() * (max - min);

  for (let r = 0; r < BLOCKS_Y; r++) {
    for (let c = 0; c < BLOCKS_X; c++) {
      if (Math.random() < 0.1) continue;
      const baseLat = CENTER_LAT + (r - BLOCKS_Y / 2) * BLK_LAT;
      const baseLng = CENTER_LNG + (c - BLOCKS_X / 2) * BLK_LNG;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let b = 0; b < n; b++) {
        const bLat = baseLat + rand(0.15, 0.8) * BLK_LAT;
        const bLng = baseLng + rand(0.15, 0.8) * BLK_LNG;
        const w = rand(0.08, 0.35) * BLK_LNG;
        const h = rand(0.08, 0.35) * BLK_LAT;
        const dist = Math.sqrt((r - BLOCKS_Y/2)**2 + (c - BLOCKS_X/2)**2);
        const floors = 3 + Math.floor(Math.random() * Math.max(5, 40 - dist * 5));
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [[[bLng,bLat],[bLng+w,bLat],[bLng+w,bLat+h],[bLng,bLat+h],[bLng,bLat]]] },
          properties: { id: `bldg_${r}_${c}_${b}`, floors, height: floors * 3.5, type: ['commercial','residential','office','retail'][Math.floor(Math.random()*4)] },
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

// ============================================
// State
// ============================================
const initialState = {
  connected: false,
  demoMode: false,
  tick: 0,
  roads: null,
  buildings: null,
  trafficData: {},
  predictions: {},
  stats: { total_segments: 0, red: 0, yellow: 0, green: 0, avg_density: 0, avg_speed_mph: 0 },
  events: [],
  routeResult: null,
  routeLoading: false,
  selectedSegment: null,
  loading: true,
  error: null,
  graphNodes: [],
  // Vehicle & Obstacle state
  obstacles: [],
  obstacleMode: false,
  vehicleProgress: 0,
  vehicleMoving: false,
  rerouting: false,
  lastRouteOrigin: null,
  lastRouteDestination: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    case 'SET_DEMO_MODE':
      return { ...state, demoMode: action.payload };
    case 'SET_GEODATA':
      return { ...state, roads: action.payload.roads, buildings: action.payload.buildings };
    case 'TRAFFIC_UPDATE':
      return { ...state, trafficData: action.payload.data, predictions: action.payload.predictions || state.predictions, tick: action.payload.tick };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'ADD_EVENT':
      return { ...state, events: [action.payload, ...state.events].slice(0, 100) };
    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    case 'SET_ROUTE_LOADING':
      return { ...state, routeLoading: action.payload };
    case 'SET_ROUTE_RESULT':
      return { ...state, routeResult: action.payload, routeLoading: false, vehicleProgress: 0, vehicleMoving: !!action.payload, rerouting: false };
    case 'SELECT_SEGMENT':
      return { ...state, selectedSegment: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_GRAPH_NODES':
      return { ...state, graphNodes: action.payload };
    // Vehicle & Obstacle actions
    case 'SET_OBSTACLE_MODE':
      return { ...state, obstacleMode: action.payload !== undefined ? action.payload : !state.obstacleMode };
    case 'ADD_OBSTACLE':
      return { ...state, obstacles: [...state.obstacles, action.payload] };
    case 'REMOVE_OBSTACLE':
      return { ...state, obstacles: state.obstacles.filter(o => o.id !== action.payload) };
    case 'CLEAR_OBSTACLES':
      return { ...state, obstacles: [] };
    case 'SET_VEHICLE_PROGRESS':
      return { ...state, vehicleProgress: action.payload };
    case 'SET_VEHICLE_MOVING':
      return { ...state, vehicleMoving: action.payload };
    case 'SET_REROUTING':
      return { ...state, rerouting: action.payload };
    case 'SET_LAST_ROUTE_ENDPOINTS':
      return { ...state, lastRouteOrigin: action.payload.origin, lastRouteDestination: action.payload.destination };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const trafficRef = useRef({});

  // ---- Start Demo Mode ----
  const startDemoMode = useCallback(() => {
    console.log('[DEMO] Starting offline demo mode...');
    dispatch({ type: 'SET_DEMO_MODE', payload: true });

    // Generate geodata client-side
    const roads = generateDemoRoads();
    const buildings = generateDemoBuildings();
    dispatch({ type: 'SET_GEODATA', payload: { roads, buildings } });

    // Initialize traffic
    const traffic = {};
    roads.features.forEach(f => {
      const density = Math.random() * 0.5 + 0.1;
      traffic[f.properties.id] = {
        density: Math.round(density * 1000) / 1000,
        speed: Math.round((65 - density * 55 + (Math.random() - 0.5) * 6) * 10) / 10,
        status: density < 0.35 ? 'green' : density < 0.65 ? 'yellow' : 'red',
      };
    });
    trafficRef.current = traffic;
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'SET_CONNECTED', payload: true });

    // Simulation loop
    let tick = 0;
    demoIntervalRef.current = setInterval(() => {
      tick++;
      const t = trafficRef.current;

      for (const segId of Object.keys(t)) {
        const s = t[segId];
        const delta = (Math.random() - 0.47) * 0.1;
        s.density = Math.max(0, Math.min(1, Math.round((s.density + delta) * 1000) / 1000));
        s.speed = Math.round(Math.max(5, 65 - s.density * 55 + (Math.random() - 0.5) * 6) * 10) / 10;
        s.status = s.density < 0.35 ? 'green' : s.density < 0.65 ? 'yellow' : 'red';
      }

      // Random accident
      if (tick % 20 === 0) {
        const keys = Object.keys(t);
        const accSeg = keys[Math.floor(Math.random() * keys.length)];
        t[accSeg].density = Math.min(1, t[accSeg].density + 0.3);
        t[accSeg].status = 'red';
        const severities = ['minor', 'moderate', 'severe', 'critical'];
        dispatch({
          type: 'ADD_EVENT',
          payload: { type: 'accident', segment_id: accSeg, severity: severities[Math.floor(Math.random() * 4)], timestamp: Date.now() / 1000 },
        });
      }

      // Predictions
      const preds = {};
      const keys = Object.keys(t);
      for (let i = 0; i < Math.min(10, keys.length); i++) {
        preds[keys[i]] = Math.round((t[keys[i]].density * 0.95 + 0.3 * 0.05) * 1000) / 1000;
      }

      // Stats
      const total = keys.length;
      let red = 0, yellow = 0, green = 0, totalDensity = 0, totalSpeed = 0;
      keys.forEach(k => {
        if (t[k].status === 'red') red++;
        else if (t[k].status === 'yellow') yellow++;
        else green++;
        totalDensity += t[k].density;
        totalSpeed += t[k].speed;
      });

      dispatch({ type: 'SET_STATS', payload: { total_segments: total, red, yellow, green, avg_density: Math.round(totalDensity / total * 1000) / 1000, avg_speed_mph: Math.round(totalSpeed / total * 10) / 10 } });
      dispatch({ type: 'TRAFFIC_UPDATE', payload: { data: { ...t }, predictions: preds, tick } });
    }, 1000);
  }, []);

  // ---- A* Pathfinding with obstacle avoidance ----
  const findPathAStar = useCallback((origin, destination, blockedNodes) => {
    const CENTER_LAT = 12.9716, CENTER_LNG = 77.5946, BLK_LAT = 0.0009, BLK_LNG = 0.0012, BX = 12, BY = 8;
    const parseNode = (id) => { const p = id.split('_'); return { row: parseInt(p[1]), col: parseInt(p[2]) }; };
    const nodeToId = (r, c) => `n_${r}_${c}`;
    const nodeToCoord = (r, c) => ({ lat: CENTER_LAT + (r - BY/2) * BLK_LAT, lng: CENTER_LNG + (c - BX/2) * BLK_LNG });

    const o = parseNode(origin), d = parseNode(destination);
    const blockedSet = new Set(blockedNodes.map(b => b.nodeId));

    // A* heuristic: Manhattan distance
    const heuristic = (r, c) => Math.abs(r - d.row) + Math.abs(c - d.col);

    // Priority queue (simple sorted array for small grid)
    const openSet = [{ r: o.row, c: o.col, g: 0, f: heuristic(o.row, o.col), parent: null }];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    gScore[nodeToId(o.row, o.col)] = 0;

    const directions = [[0,1],[0,-1],[1,0],[-1,0]]; // NESW

    while (openSet.length > 0) {
      // Get lowest f-score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const currentId = nodeToId(current.r, current.c);

      if (current.r === d.row && current.c === d.col) {
        // Reconstruct path
        const path = [];
        const coords = [];
        let node = currentId;
        while (node) {
          path.unshift(node);
          const p = parseNode(node);
          coords.unshift(nodeToCoord(p.row, p.col));
          node = cameFrom[node];
        }
        return { path, coordinates: coords, segment_ids: [], total_cost: path.length * 330, estimated_time_minutes: Math.round(path.length * 0.4 * 10) / 10, nodes_visited: closed.size };
      }

      closed.add(currentId);

      for (const [dr, dc] of directions) {
        const nr = current.r + dr, nc = current.c + dc;
        if (nr < 0 || nr > BY || nc < 0 || nc > BX) continue;
        const neighborId = nodeToId(nr, nc);
        if (closed.has(neighborId)) continue;
        if (blockedSet.has(neighborId)) continue; // Skip obstacle nodes

        const tentativeG = current.g + 1;
        if (tentativeG < (gScore[neighborId] ?? Infinity)) {
          gScore[neighborId] = tentativeG;
          cameFrom[neighborId] = currentId;
          const f = tentativeG + heuristic(nr, nc);
          // Check if already in openSet
          const existing = openSet.find(n => n.r === nr && n.c === nc);
          if (existing) {
            existing.g = tentativeG;
            existing.f = f;
          } else {
            openSet.push({ r: nr, c: nc, g: tentativeG, f, parent: currentId });
          }
        }
      }
    }

    return null; // No path found
  }, []);

  // ---- Demo Route (with obstacle support) ----
  const demoRoute = useCallback((origin, destination, obstacles = []) => {
    dispatch({ type: 'SET_ROUTE_LOADING', payload: true });
    dispatch({ type: 'SET_LAST_ROUTE_ENDPOINTS', payload: { origin, destination } });
    setTimeout(() => {
      const result = findPathAStar(origin, destination, obstacles);
      if (result) {
        dispatch({ type: 'SET_ROUTE_RESULT', payload: result });
      } else {
        // No route found — still set result with info
        dispatch({ type: 'SET_ROUTE_RESULT', payload: null });
        dispatch({ type: 'ADD_EVENT', payload: { type: 'route_blocked', severity: 'critical', segment_id: 'N/A', timestamp: Date.now() / 1000 } });
      }
    }, 300);
  }, [findPathAStar]);

  // ---- Fetch geodata from backend ----
  const fetchGeodata = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const [roadsRes, buildingsRes] = await Promise.all([
        fetch('/api/geodata/roads', { signal: controller.signal }),
        fetch('/api/geodata/buildings', { signal: controller.signal }),
      ]);
      clearTimeout(timeout);
      if (!roadsRes.ok || !buildingsRes.ok) throw new Error('Failed to fetch geodata');
      const roads = await roadsRes.json();
      const buildings = await buildingsRes.json();
      dispatch({ type: 'SET_GEODATA', payload: { roads, buildings } });
    } catch (err) {
      console.warn('[STORE] Backend unreachable, switching to demo mode:', err.message);
      startDemoMode();
    }
  }, [startDemoMode]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) { dispatch({ type: 'SET_STATS', payload: await res.json() }); }
    } catch (err) { /* ignore in demo mode */ }
  }, []);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'traffic_update') dispatch({ type: 'TRAFFIC_UPDATE', payload: msg });
        else if (msg.event === 'accident') dispatch({ type: 'ADD_EVENT', payload: msg.data });
        else if (msg.event === 'route_result') dispatch({ type: 'SET_ROUTE_RESULT', payload: msg.data });
      } catch (err) { console.error('[WS] Parse error:', err); }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected.');
      dispatch({ type: 'SET_CONNECTED', payload: false });
      // Only reconnect if not in demo mode
      if (!demoIntervalRef.current) setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => { /* handled by onclose */ };
  }, []);

  const requestRoute = useCallback((origin, destination) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      dispatch({ type: 'SET_ROUTE_LOADING', payload: true });
      wsRef.current.send(JSON.stringify({ type: 'request_route', origin, destination }));
    }
  }, []);

  const requestRouteREST = useCallback(async (origin, destination) => {
    // In demo mode, use client-side routing
    if (demoIntervalRef.current) {
      demoRoute(origin, destination, obstaclesRef.current);
      return;
    }
    dispatch({ type: 'SET_ROUTE_LOADING', payload: true });
    try {
      const res = await fetch('/api/route/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination }),
      });
      const data = await res.json();
      dispatch({ type: 'SET_ROUTE_RESULT', payload: data });
    } catch (err) {
      console.error('[ROUTE] Error:', err);
      dispatch({ type: 'SET_ROUTE_LOADING', payload: false });
    }
  }, [demoRoute]);

  // ---- Obstacle management ----
  const obstaclesRef = useRef([]);
  const lastRouteRef = useRef({ origin: null, destination: null });

  const addObstacle = useCallback((obstacle) => {
    dispatch({ type: 'ADD_OBSTACLE', payload: obstacle });
    obstaclesRef.current = [...obstaclesRef.current, obstacle];

    // Auto-reroute if a route exists
    const { origin, destination } = lastRouteRef.current;
    if (origin && destination) {
      dispatch({ type: 'SET_REROUTING', payload: true });
      dispatch({ type: 'ADD_EVENT', payload: { type: 'reroute', severity: 'moderate', segment_id: obstacle.nodeId, timestamp: Date.now() / 1000 } });
      setTimeout(() => {
        demoRoute(origin, destination, obstaclesRef.current);
      }, 400);
    }
  }, [demoRoute]);

  const clearObstacles = useCallback(() => {
    dispatch({ type: 'CLEAR_OBSTACLES' });
    obstaclesRef.current = [];

    // Re-route without obstacles
    const { origin, destination } = lastRouteRef.current;
    if (origin && destination) {
      demoRoute(origin, destination, []);
    }
  }, [demoRoute]);

  const toggleObstacleMode = useCallback(() => {
    dispatch({ type: 'SET_OBSTACLE_MODE', payload: undefined });
  }, []);

  // Track last route endpoints
  useEffect(() => {
    // We read from a custom ref approach — update ref when route endpoints change
  }, []);

  // Initialize
  useEffect(() => {
    fetchGeodata();
    connectWebSocket();

    // Stats polling only if connected to backend
    const statsInterval = setInterval(fetchStats, 5000);

    return () => {
      clearInterval(statsInterval);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Keep lastRouteRef in sync
  const wrappedRequestRouteREST = useCallback(async (origin, destination) => {
    lastRouteRef.current = { origin, destination };
    return requestRouteREST(origin, destination);
  }, [requestRouteREST]);

  return (
    <StoreContext.Provider value={{
      state, dispatch, requestRoute,
      requestRouteREST: wrappedRequestRouteREST,
      addObstacle, clearObstacles, toggleObstacleMode,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
