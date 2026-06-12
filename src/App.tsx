import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ThreadArea } from './components/ThreadArea';
import './App.css';

function MainLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          height: '100vh', 
          width: '100vw', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: 'var(--bg-app)', 
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          fontSize: '1rem'
        }} 
        className="pulse"
      >
        Connecting to ZarnexHub...
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <ChatProvider>
      <div className="app-container">
        <Sidebar />
        <ChatArea />
        <ThreadArea />
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
