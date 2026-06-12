import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ThreadArea } from './components/ThreadArea';
import { SpaceNebulaCanvas } from './components/SpaceNebulaCanvas';
import './App.css';

function MainLayout() {
  const { user, loading } = useAuth();
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('zarnex_hud_theme') || 'cosmic';
  });

  useEffect(() => {
    localStorage.setItem('zarnex_hud_theme', activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    (window as any).setHUDTheme = (themeName: string) => {
      setActiveTheme(themeName);
    };
    (window as any).getHUDTheme = () => activeTheme;
  }, [activeTheme]);

  if (loading) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          height: '100vh', 
          width: '100vw', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: '#060710', 
          color: '#64748b',
          fontFamily: 'sans-serif',
          fontSize: '1rem'
        }} 
        className="pulse"
      >
        Initializing ZarnexHub Command Center...
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`theme-${activeTheme}`} style={{ width: '100%', height: '100%' }}>
        <SpaceNebulaCanvas />
        <div className="mesh-gradient-backdrop">
          <div className="mesh-blob mesh-blob-1"></div>
          <div className="mesh-blob mesh-blob-2"></div>
        </div>
        <Auth />
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className={`theme-${activeTheme}`} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <SpaceNebulaCanvas />
        <div className="mesh-gradient-backdrop">
          <div className="mesh-blob mesh-blob-1"></div>
          <div className="mesh-blob mesh-blob-2"></div>
          <div className="mesh-blob mesh-blob-3"></div>
        </div>
        <div className="app-frame-wrapper">
          <div className="app-container">
            <Sidebar />
            <ChatArea />
            <ThreadArea />
          </div>
        </div>
      </div>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
