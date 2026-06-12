import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { Hash, Search, Smile, MessageSquare, Users } from 'lucide-react';
import { ManageMembersModal } from './Modals';
import { TelemetryWidget } from './TelemetryWidget';
import { soundFx } from '../lib/soundFx';

export const ChatArea: React.FC = () => {
  const { 
    activeConversation, 
    messages, 
    typingUsers, 
    members, 
    profiles, 
    loadingMessages 
  } = useChat();

  const { user, profile } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages feed to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Clean search query on channel swap
  useEffect(() => {
    setSearchQuery('');
  }, [activeConversation?.id]);

  if (!activeConversation) {
    return (
      <div className="chat-area">
        <div className="no-messages-placeholder">
          <MessageSquare className="no-messages-icon pulse" />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>No Conversation Selected</h2>
          <p style={{ maxWidth: '320px', fontSize: '0.9rem' }}>
            Choose a channel or direct message from the sidebar to start collaborating.
          </p>
        </div>
      </div>
    );
  }

  // Resolve Recipient Details for DMs
  const getDMDetails = (convId: string) => {
    const convMembers = members.filter(m => m.conversation_id === convId);
    const otherMember = convMembers.find(m => m.profile_id !== user?.id);
    
    if (!otherMember) {
      return {
        name: `${profile?.full_name || profile?.username || 'You'} (you)`,
        isOnline: true,
        statusText: profile?.status_text
      };
    }

    const otherProfile = profiles.find(p => p.id === otherMember.profile_id);
    return {
      name: otherProfile ? (otherProfile.full_name || otherProfile.username) : 'Direct Message',
      isOnline: otherProfile?.is_online || false,
      statusText: otherProfile?.status_text
    };
  };

  const dmDetails = activeConversation.is_dm ? getDMDetails(activeConversation.id) : null;
  const channelMembers = members.filter(m => m.conversation_id === activeConversation.id);
  const channelMembersCount = channelMembers.length;

  // Map member profiles for cluster display (mockup layout)
  const conversationProfiles = channelMembers
    .map(m => profiles.find(p => p.id === m.profile_id))
    .filter(Boolean);
  const chatClusterCount = Math.min(conversationProfiles.length, 4);
  const chatCluster = conversationProfiles.slice(0, chatClusterCount);

  // Filter messages based on search text and only render top-level messages in main feed
  const filteredMessages = messages.filter((msg) => {
    if (msg.parent_id) return false;
    if (!searchQuery.trim()) return true;
    return msg.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Extract active typing users list text
  const activeTypers = Object.entries(typingUsers)
    .filter(([_, isTyping]) => isTyping)
    .map(([username]) => username);

  const renderTypingText = () => {
    if (activeTypers.length === 0) return null;
    if (activeTypers.length === 1) return `${activeTypers[0]} is typing...`;
    if (activeTypers.length === 2) return `${activeTypers[0]} and ${activeTypers[1]} are typing...`;
    return 'Multiple users are typing...';
  };

  return (
    <div className="chat-area">
      {/* Chat Canvas Header */}
      <header className="chat-header" style={{ height: 'auto', padding: '0.75rem 1.5rem', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
          <div className="chat-title-info">
            <h2 className="chat-title">
              {activeConversation.is_dm ? (
                <>
                  <span className={`status-dot ${dmDetails?.isOnline ? 'online' : 'offline'}`} style={{ position: 'static', display: 'inline-block', width: '12px', height: '12px', border: 'none' }}></span>
                  <span>{dmDetails?.name}</span>
                </>
              ) : (
                <>
                  <Hash size={18} style={{ color: 'var(--accent)' }} />
                  <span>{activeConversation.name}</span>
                </>
              )}
            </h2>
            <p className="chat-subtitle" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {activeConversation.is_dm ? (
                dmDetails?.statusText || 'Direct messaging room'
              ) : (
                <>
                  <button 
                    onClick={() => {
                      soundFx.playClick();
                      setShowMembersModal(true);
                    }} 
                    onMouseEnter={() => soundFx.playHover()}
                    className="console-badge"
                    title="Manage channel members"
                  >
                    <Users size={12} style={{ color: 'var(--accent)' }} />
                    <span>{channelMembersCount} {channelMembersCount === 1 ? 'member' : 'members'}</span>
                  </button>
                  <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{activeConversation.description || 'No description provided.'}</span>
                </>
              )}
            </p>
          </div>

          {/* Overlapping member cluster on the right side of title (ref image style) */}
          {!activeConversation.is_dm && (
            <div className="avatar-cluster" title="Conversation node members" style={{ marginLeft: '6px' }}>
              {chatCluster.map((p, idx) => (
                <div 
                  key={p!.id} 
                  className="avatar-cluster-item"
                  style={{ zIndex: chatClusterCount - idx, width: '26px', height: '26px' }}
                  title={p!.full_name || p!.username}
                >
                  {p!.avatar_url ? (
                    <img src={p!.avatar_url} alt="" />
                  ) : (
                    (p!.username || 'U').substring(0, 1).toUpperCase()
                  )}
                </div>
              ))}
              {conversationProfiles.length > chatClusterCount && (
                <div className="avatar-cluster-item" style={{ zIndex: 0, width: '26px', height: '26px' }} title="More conversation members">
                  +{conversationProfiles.length - chatClusterCount}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live HUD Telemetry Widget */}
        <TelemetryWidget />

        {/* Header Search Filter & Actions */}
        <div className="chat-header-actions" style={{ marginLeft: 'auto' }}>
          {!activeConversation.is_dm && (
            <button 
              className="toolbar-btn" 
              style={{ 
                padding: '0.45rem 0.85rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                background: 'rgba(255, 255, 255, 0.02)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                marginRight: '0.5rem',
              }}
              onMouseEnter={() => soundFx.playHover()}
              onClick={() => {
                soundFx.playClick();
                setShowMembersModal(true);
              }}
              title="Manage channel members"
            >
              <Users size={14} style={{ color: 'var(--accent)' }} />
              <span>Manage Members</span>
            </button>
          )}
          <div className="search-container">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => soundFx.playHover()}
            />
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="messages-viewport">
        {loadingMessages ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }} className="pulse">
            Loading conversation messages...
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="no-messages-placeholder" style={{ display: 'flex' }}>
            <Smile className="no-messages-icon" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              {searchQuery.trim() ? 'No matches found' : 'This is the start of something new'}
            </h3>
            <p style={{ fontSize: '0.8rem', maxWidth: '280px' }}>
              {searchQuery.trim() 
                ? `We couldn't find matches for "${searchQuery}"` 
                : activeConversation.is_dm 
                  ? `Say hello to establish your DM conversation.` 
                  : `This is the very beginning of the #${activeConversation.name} channel.`}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicators & Message Input bar */}
      <div className="message-input-area">
        <div className="typing-indicator-wrapper">
          {activeTypers.length > 0 && (
            <>
              <span className="pulse" style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: 'var(--typing)', borderRadius: '50%' }}></span>
              <span>{renderTypingText()}</span>
            </>
          )}
        </div>
        <MessageInput 
          placeholder={
            activeConversation.is_dm 
              ? `Message ${dmDetails?.name}...` 
              : `Message #${activeConversation.name}...`
          } 
        />
      </div>
      {showMembersModal && (
        <ManageMembersModal 
          conversationId={activeConversation.id} 
          onClose={() => setShowMembersModal(false)} 
        />
      )}
    </div>
  );
};
