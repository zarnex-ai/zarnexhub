import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import type { Message, Reaction } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, MessageSquare, Smile, Check, X } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isThreadView?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isThreadView = false }) => {
  const { user } = useAuth();
  const { editMessage, deleteMessage, toggleReaction, setThreadParent, messages, profiles } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Lookup sender profile from the global list loaded in ChatContext
  const senderProfile = profiles.find(p => p.id === message.sender_id);

  // Predefined reaction emojis
  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉', '🚀'];

  // Group reactions by emoji character
  const reactionsGroup = (message.reactions || []).reduce((acc, curr) => {
    if (!acc[curr.emoji]) {
      acc[curr.emoji] = {
        emoji: curr.emoji,
        count: 0,
        userIds: [] as string[],
        reactions: [] as Reaction[]
      };
    }
    acc[curr.emoji].count += 1;
    acc[curr.emoji].userIds.push(curr.profile_id);
    acc[curr.emoji].reactions.push(curr);
    return acc;
  }, {} as { [emoji: string]: { emoji: string; count: number; userIds: string[]; reactions: Reaction[] } });

  const replyCount = isThreadView ? 0 : messages.filter(m => m.parent_id === message.id).length;

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      return;
    }
    try {
      await editMessage(message.id, editContent);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteMessage(message.id);
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    }
  };

  const handleToggleReaction = async (emoji: string) => {
    try {
      await toggleReaction(message.id, emoji);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isSender = user?.id === message.sender_id;

  return (
    <div className="message-item animate-fade-in">
      {/* Sender Avatar */}
      <div className="avatar-wrapper" style={{ alignSelf: 'flex-start' }}>
        <div className="avatar">
          {senderProfile?.avatar_url ? (
            <img 
              src={senderProfile.avatar_url} 
              alt="" 
              style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} 
            />
          ) : (
            (senderProfile?.username || 'U').substring(0, 2).toUpperCase()
          )}
        </div>
      </div>

      {/* Message Core Container */}
      <div className="message-main">
        <div className="message-header">
          <span className="message-sender" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>{senderProfile?.full_name || `@${senderProfile?.username || 'unknown'}`}</span>
            {(senderProfile?.streak_count || 0) > 0 && (
              <span 
                style={{ 
                  fontSize: '0.75rem', 
                  background: 'rgba(249, 115, 22, 0.15)', 
                  color: '#f97316', 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  fontWeight: 700 
                }} 
                title="Active messaging streak!"
              >
                🔥 {senderProfile?.streak_count}
              </span>
            )}
          </span>
          <span className="message-time">{formatTime(message.created_at)}</span>
        </div>

        {isEditing ? (
          <div style={{ marginTop: '0.25rem', width: '100%' }}>
            <textarea
              className="form-input"
              style={{ width: '100%', resize: 'vertical', minHeight: '60px', backgroundColor: 'var(--bg-input)' }}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => { setIsEditing(false); setEditContent(message.content); }}
              >
                <X size={12} style={{ marginRight: '4px' }} /> Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                onClick={handleEdit}
              >
                <Check size={12} style={{ marginRight: '4px' }} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div className="message-content">
            {message.content}
            {message.is_edited && <span className="message-edited">(edited)</span>}
          </div>
        )}

        {/* Reactions List */}
        {Object.keys(reactionsGroup).length > 0 && (
          <div className="reactions-tray">
            {Object.values(reactionsGroup).map((group) => {
              const hasReacted = user ? group.userIds.includes(user.id) : false;
              return (
                <button
                  key={group.emoji}
                  className={`reaction-badge ${hasReacted ? 'active' : ''}`}
                  onClick={() => handleToggleReaction(group.emoji)}
                  title={`${group.userIds.length} reaction(s)`}
                >
                  <span>{group.emoji}</span>
                  <span className="reaction-count">{group.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread replies summary */}
        {replyCount > 0 && !isThreadView && (
          <button 
            className="thread-replies-link"
            onClick={() => setThreadParent(message)}
          >
            <MessageSquare size={12} />
            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
          </button>
        )}
      </div>

      {/* Floating Toolbar (appears on hover) */}
      {!isEditing && (
        <div className="message-actions">
          {/* Reaction Quick List */}
          <button 
            className="action-btn" 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="React with Emoji"
          >
            <Smile size={14} />
          </button>

          {isSender && (
            <>
              <button className="action-btn" onClick={() => setIsEditing(true)} title="Edit Message">
                <Edit2 size={14} />
              </button>
              <button className="action-btn" onClick={handleDelete} title="Delete Message">
                <Trash2 size={14} style={{ color: '#f87171' }} />
              </button>
            </>
          )}

          {!isThreadView && !message.parent_id && (
            <button 
              className="action-btn" 
              onClick={() => setThreadParent(message)} 
              title="Reply in Thread"
            >
              <MessageSquare size={14} />
            </button>
          )}

          {/* Floated Emoji Pick Popover */}
          {showEmojiPicker && (
            <div className="emoji-picker-container" style={{ bottom: '30px', right: '0px' }}>
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleToggleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
