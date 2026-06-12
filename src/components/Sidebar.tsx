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
  Trash2
} from 'lucide-react';
import { CreateChannelModal, StartDMModal, ProfileModal, SearchConversationsModal } from './Modals';

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

  const handleDeleteConversation = async (id: string, name: string) => {
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

  // Helper to extract DM conversation visual details (recipient username, avatar, online status)
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
      <aside className="sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="workspace-name">
            <Users size={18} className="pulse" style={{ color: 'var(--accent-hover)' }} />
            <span>ZarnexHub</span>
          </div>
          <button onClick={() => setShowProfileModal(true)} title="Edit profile settings">
            <Settings size={18} className="logout-btn" />
          </button>
        </div>

        {/* Global Search Button */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setShowSearchModal(true)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-input)',
              color: 'var(--text-muted)',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-fast)'
            }}
            className="search-conversations-btn"
            title="Search conversations (Ctrl+K)"
          >
            <Search size={14} />
            <span>Search conversations...</span>
            <span style={{ 
              marginLeft: 'auto', 
              opacity: 0.5, 
              fontSize: '0.7rem', 
              background: 'rgba(255,255,255,0.08)', 
              padding: '1px 6px', 
              borderRadius: '3px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              Ctrl+K
            </span>
          </button>
        </div>

        {/* Channels & DMs Scroll Workspace */}
        <div className="sidebar-content">
          {/* CHANNELS SECTION */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <button 
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setChannelsCollapsed(!channelsCollapsed)}
              >
                {channelsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Channels ({channels.length})</span>
              </button>
              <button onClick={() => setShowChannelModal(true)} title="Create a channel">
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
                        onClick={() => setActiveConversationId(parent.id)}
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
                          onClick={() => setActiveConversationId(child.id)}
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
                onClick={() => setDmsCollapsed(!dmsCollapsed)}
              >
                {dmsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Direct Messages ({dms.length})</span>
              </button>
              <button onClick={() => setShowDMModal(true)} title="Start new direct message">
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
                      onClick={() => setActiveConversationId(dm.id)}
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
                        <span style={{ textDecoration: dm.id === activeConversation?.id ? 'none' : 'none' }}>
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
            <div className="user-summary" onClick={() => setShowProfileModal(true)}>
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
            <button className="logout-btn" onClick={signOut} title="Sign Out">
              <LogOut size={18} />
            </button>
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
