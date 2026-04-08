/**
 * UrbanFlow — Main Application
 * Combines 3D city scene with glassmorphism dashboard overlay.
 * Supports dark/light theme with reactive 3D scene colors.
 */

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { StoreProvider, useStore } from './store/Store';
import CityScene from './components/map/CityScene';
import Dashboard, { LoadingScreen } from './components/ui/Dashboard';

// =========================================
// Theme-aware 3D config
// =========================================
const THEME_3D = {
  dark: {
    bg: '#0a0e1a',
    fog: '#0a0e1a',
    ambient: '#4a6fa1',
    ambientIntensity: 0.3,
    dirColor: '#b0c4de',
    dirIntensity: 0.8,
    pointA: '#00e5ff',
    pointB: '#8b5cf6',
    showStars: true,
  },
  light: {
    bg: '#dbe4ee',
    fog: '#dbe4ee',
    ambient: '#ffffff',
    ambientIntensity: 0.7,
    dirColor: '#fff5e6',
    dirIntensity: 1.2,
    pointA: '#0891b2',
    pointB: '#7c3aed',
    showStars: false,
  },
};

function useCurrentTheme() {
  const [theme, setTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(t);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// =========================================
// Dynamic Scene Background
// =========================================
function SceneBackground({ color }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color(color);
  }, [color, scene]);
  return null;
}

// =========================================
// 3D Scene
// =========================================
function Scene3D() {
  const theme = useCurrentTheme();
  const config = THEME_3D[theme] || THEME_3D.dark;
  const { state } = useStore();

  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: config.bg }}
    >
      <SceneBackground color={config.bg} />

      <PerspectiveCamera
        makeDefault
        position={[4, 5, 6]}
        fov={50}
        near={0.1}
        far={500}
      />

      {/* Lighting — adapts to theme */}
      <ambientLight intensity={config.ambientIntensity} color={config.ambient} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={config.dirIntensity}
        color={config.dirColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-5, 8, -5]} intensity={0.4} color={config.pointA} />
      <pointLight position={[5, 6, 5]} intensity={0.3} color={config.pointB} />

      {/* Atmosphere */}
      <fog attach="fog" args={[config.fog, 15, 40]} />
      {config.showStars && (
        <Stars
          radius={80}
          depth={60}
          count={2000}
          factor={3}
          saturation={0.5}
          fade
          speed={0.5}
        />
      )}

      {/* City Scene */}
      <Suspense fallback={null}>
        <CityScene theme={theme} />
      </Suspense>

      {/* Controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate={!state.obstacleMode}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={2}
        maxDistance={25}
        target={[0, 0, 0]}
        autoRotate={!state.obstacleMode}
        autoRotateSpeed={0.3}
      />
    </Canvas>
  );
}

function AppContent() {
  const { state } = useStore();

  return (
    <div className="app-container" id="app-container">
      {/* 3D Canvas (background) */}
      <div className="canvas-wrapper">
        <Scene3D />
      </div>

      {/* Dashboard overlay (foreground) */}
      <Dashboard />

      {/* Loading screen */}
      {state.loading && !state.roads && <LoadingScreen />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
