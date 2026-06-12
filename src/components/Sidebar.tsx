import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { 
  Hash, 
  Plus, 
  LogOut, 
  Settings, 
  ChevronDown, 
  ChevronRight, 
  Users,
  Search,
  Trash2,
  MessageSquare,
  Volume2,
  VolumeX,
  Palette
} from 'lucide-react';
import { CreateChannelModal, StartDMModal, ProfileModal, SearchConversationsModal } from './Modals';
import { soundFx } from '../lib/soundFx';

export const Sidebar: React.FC = () => {
  const { 
    conversations, 
    members, 
    profiles, 
    activeConversation, 
    setActiveConversationId,
    deleteConversation
  } = useChat();

  const { user, profile, signOut } = useAuth();

  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);

  const [isMuted, setIsMuted] = useState(() => soundFx.getMutedState());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => (window as any).getHUDTheme() || 'cosmic');

  // Hotkey listener for Ctrl+K / Cmd+K search dialog
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Sync theme changes with global state
  const handleToggleMute = () => {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleSelectTheme = (themeName: string) => {
    if ((window as any).setHUDTheme) {
      (window as any).setHUDTheme(themeName);
      setActiveTheme(themeName);
    }
    setShowThemePicker(false);
  };

  const handleDeleteConversation = async (id: string, name: string) => {
    soundFx.playWarning();
    if (window.confirm(`Are you sure you want to delete "${name}"? This will permanently delete all chat history in Supabase.`)) {
      try {
        await deleteConversation(id);
      } catch (err: any) {
        console.error('Failed to delete conversation:', err);
        alert(`Failed to delete conversation: ${err.message || String(err)}`);
      }
    }
  };

  // Filter conversations
  const channels = conversations.filter(c => !c.is_dm);
  const dms = conversations.filter(c => c.is_dm);

  // Group channels into parents and subchannels
  const parentChannels = channels.filter(c => !c.parent_id);
  const subChannels = channels.filter(c => c.parent_id);

  // Helper to extract DM conversation visual details
  const getDMDetails = (convId: string) => {
    const convMembers = members.filter(m => m.conversation_id === convId);
    const otherMember = convMembers.find(m => m.profile_id !== user?.id);
    
    if (!otherMember) {
      return {
        name: `${profile?.full_name || profile?.username || 'You'} (you)`,
        avatarUrl: profile?.avatar_url,
        isOnline: true,
        statusText: profile?.status_text
      };
    }

    const otherProfile = profiles.find(p => p.id === otherMember.profile_id);
    return {
      name: otherProfile ? (otherProfile.full_name || otherProfile.username) : 'Loading user...',
      avatarUrl: otherProfile?.avatar_url,
      isOnline: otherProfile?.is_online || false,
      statusText: otherProfile?.status_text
    };
  };


  return (
    <>
      {/* Floating Bottom command center Console Dock (mockup inspired) */}
      <div className="bottom-command-dock">
        <button 
          className="dock-btn active" 
          title="Chat Console"
          onMouseEnter={() => soundFx.playHover()}
          onClick={() => soundFx.playClick()}
        >
          <MessageSquare size={18} />
        </button>
        <button 
          className="dock-btn" 
          title="Search Workspace (Ctrl+K)"
          onMouseEnter={() => soundFx.playHover()}
          onClick={() => {
            soundFx.playClick();
            setShowSearchModal(true);
          }}
        >
          <Search size={18} />
        </button>
        <button 
          className="dock-btn" 
          title="Start DM Conversation"
          onMouseEnter={() => soundFx.playHover()}
          onClick={() => {
            soundFx.playClick();
            setShowDMModal(true);
          }}
        >
          <Users size={18} />
        </button>
        
        {/* Synth Audio Mute Selector */}
        <button 
          className={`dock-btn ${isMuted ? '' : 'active'}`}
          style={{ background: isMuted ? 'rgba(255,255,255,0.02)' : 'rgba(217,70,239,0.1)' }}
          title={isMuted ? "Unmute HUD Synthesizer" : "Mute HUD Synthesizer"}
          onMouseEnter={() => soundFx.playHover()}
          onClick={handleToggleMute}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Dynamic Palette Theme Swapper */}
        <div style={{ position: 'relative' }}>
          <button 
            className="dock-btn" 
            title="Configure System Theme"
            onMouseEnter={() => soundFx.playHover()}
            onClick={() => {
              soundFx.playClick();
              setShowThemePicker(!showThemePicker);
            }}
          >
            <Palette size={18} />
          </button>
          
          {showThemePicker && (
            <div className="theme-selector-popover">
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', padding: '2px 4px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visual Accents</div>
              {[
                { name: 'cosmic', label: 'Cosmic Nebula', color: '#d946ef' },
                { name: 'solar', label: 'Solar Eclipse', color: '#f97316' },
                { name: 'matrix', label: 'Matrix Green', color: '#10b981' },
                { name: 'hyperdrive', label: 'Hyperdrive Blue', color: '#00e5ff' },
                { name: 'abyssal', label: 'Abyssal Red', color: '#ef4444' }
              ].map((themeOpt) => (
                <div 
                  key={themeOpt.name}
                  className={`theme-opt ${activeTheme === themeOpt.name ? 'active' : ''}`}
                  onClick={() => handleSelectTheme(themeOpt.name)}
                >
                  <span className="theme-color-dot" style={{ backgroundColor: themeOpt.color }}></span>
                  <span>{themeOpt.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          className="dock-btn" 
          title="Account profile"
          onMouseEnter={() => soundFx.playHover()}
          onClick={() => {
            soundFx.playClick();
            setShowProfileModal(true);
          }}
        >
          <Settings size={18} />
        </button>

        {user && (
          <div 
            className="dock-btn"
            style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
            title={`${profile?.full_name || profile?.username || 'User'} Profile Settings`}
            onClick={() => {
              soundFx.playClick();
              setShowProfileModal(true);
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', background: 'var(--accent-gradient)' }}>
                {(profile?.username || user.email || 'U').substring(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <button 
          className="dock-btn" 
          title="Command Shutdown (Sign Out)"
          onMouseEnter={() => soundFx.playHover()}
          onClick={() => {
            soundFx.playClick();
            signOut();
          }}
        >
          <LogOut size={18} style={{ color: '#ef4444' }} />
        </button>
      </div>

      <aside className="sidebar">
        {/* Sidebar Header with Overlapping member avatars cluster from mockup */}
        <div className="sidebar-header">
          <div className="workspace-name" style={{ flex: 1, minWidth: 0 }}>
            <Users size={16} className="pulse" style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ZarnexHub</span>
          </div>
          
          {user && (
            <div 
              className="avatar" 
              style={{ width: '28px', height: '28px', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}
              onClick={() => {
                soundFx.playClick();
                setShowProfileModal(true);
              }}
              title={`${profile?.full_name || 'User'} Profile`}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
              ) : (
                (profile?.username || user.email || 'U').substring(0, 2).toUpperCase()
              )}
            </div>
          )}
        </div>

        {/* Channels & DMs Scroll Workspace */}
        <div className="sidebar-content">
          {/* CHANNELS SECTION */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <button 
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  soundFx.playClick();
                  setChannelsCollapsed(!channelsCollapsed);
                }}
              >
                {channelsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Channels ({channels.length})</span>
              </button>
              <button 
                onClick={() => {
                  soundFx.playClick();
                  setShowChannelModal(true);
                }} 
                title="Create a channel"
              >
                <Plus size={14} />
              </button>
            </div>

            {!channelsCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {parentChannels.map((parent) => {
                  const children = subChannels.filter(child => child.parent_id === parent.id);
                  return (
                    <React.Fragment key={parent.id}>
                      <div
                        className={`sidebar-item ${activeConversation?.id === parent.id ? 'active' : ''}`}
                        onMouseEnter={() => soundFx.playHover()}
                        onClick={() => {
                          soundFx.playClick();
                          if ((window as any).triggerHyperdrive) (window as any).triggerHyperdrive();
                          setActiveConversationId(parent.id);
                        }}
                      >
                        <div className="sidebar-item-label">
                          <Hash size={16} style={{ color: activeConversation?.id === parent.id ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                          <span style={{ fontWeight: children.length > 0 ? 600 : 400 }}>{parent.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {parent.is_private && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>🔒</span>}
                          {(parent.created_by === user?.id) && (
                            <button
                              className="sidebar-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConversation(parent.id, `#${parent.name}`);
                              }}
                              title="Delete Channel"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {children.map((child) => (
                        <div
                          key={child.id}
                          className={`sidebar-item ${activeConversation?.id === child.id ? 'active' : ''}`}
                          style={{ paddingLeft: '1.75rem' }}
                          onMouseEnter={() => soundFx.playHover()}
                          onClick={() => {
                            soundFx.playClick();
                            if ((window as any).triggerHyperdrive) (window as any).triggerHyperdrive();
                            setActiveConversationId(child.id);
                          }}
                        >
                          <div className="sidebar-item-label">
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '2px', opacity: 0.6 }}>↳</span>
                            <Hash size={14} style={{ color: activeConversation?.id === child.id ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.85rem', color: activeConversation?.id === child.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{child.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {child.is_private && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>🔒</span>}
                            {(child.created_by === user?.id) && (
                              <button
                                className="sidebar-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConversation(child.id, `#${child.name}`);
                                }}
                                title="Delete Sub-Channel"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* DIRECT MESSAGES SECTION */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <button 
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  soundFx.playClick();
                  setDmsCollapsed(!dmsCollapsed);
                }}
              >
                {dmsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Direct Messages ({dms.length})</span>
              </button>
              <button 
                onClick={() => {
                  soundFx.playClick();
                  setShowDMModal(true);
                }} 
                title="Start new direct message"
              >
                <Plus size={14} />
              </button>
            </div>

            {!dmsCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dms.map((dm) => {
                  const details = getDMDetails(dm.id);
                  return (
                    <div
                      key={dm.id}
                      className={`sidebar-item ${activeConversation?.id === dm.id ? 'active' : ''}`}
                      onMouseEnter={() => soundFx.playHover()}
                      onClick={() => {
                        soundFx.playClick();
                        if ((window as any).triggerHyperdrive) (window as any).triggerHyperdrive();
                        setActiveConversationId(dm.id);
                      }}
                    >
                      <div className="sidebar-item-label">
                        <div className="avatar-wrapper">
                          <div className="avatar avatar-sm">
                            {details.avatarUrl ? (
                              <img src={details.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                            ) : (
                              details.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className={`status-dot ${details.isOnline ? 'online' : 'offline'}`}></span>
                        </div>
                        <span>
                          {details.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {details.statusText && (
                          <span 
                            title={details.statusText} 
                            style={{ fontSize: '0.8rem', opacity: 0.6, cursor: 'help' }}
                          >
                            💬
                          </span>
                        )}
                        <button
                          className="sidebar-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(dm.id, `DM with ${details.name}`);
                          }}
                          title="Close Direct Message"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Profile Section */}
        {user && (
          <div className="sidebar-footer">
            <div className="user-summary" onClick={() => { soundFx.playClick(); setShowProfileModal(true); }}>
              <div className="avatar-wrapper">
                <div className="avatar">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                  ) : (
                    (profile?.username || user.email || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>
                <span className="status-dot online"></span>
              </div>
              <div className="user-info">
                <span className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{profile?.full_name || profile?.username || user.email?.split('@')[0]}</span>
                  {(profile?.streak_count || 0) > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 'bold' }} title="Messaging Streak">
                      🔥{profile?.streak_count}
                    </span>
                  )}
                </span>
                <span className="user-status-text">{profile?.status_text || 'Active'}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Rendering Modals */}
      {showChannelModal && <CreateChannelModal onClose={() => setShowChannelModal(false)} />}
      {showDMModal && <StartDMModal onClose={() => setShowDMModal(false)} />}
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
      {showSearchModal && <SearchConversationsModal onClose={() => setShowSearchModal(false)} />}
    </>
  );
};
