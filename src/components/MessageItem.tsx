import React, { useState, useRef, useLayoutEffect } from 'react';
import { useChat } from '../context/ChatContext';
import type { Message, Reaction } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, MessageSquare, Smile, Check, X, Download, Copy, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { soundFx } from '../lib/soundFx';


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
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snippetColor, setSnippetColor] = useState<'amber' | 'green' | 'steel'>('green');

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [pickerCoords, setPickerCoords] = useState<React.CSSProperties>({
    bottom: '35px',
    right: '0px',
    left: 'auto',
    opacity: 0,
  });

  useLayoutEffect(() => {
    if (showEmojiPicker && emojiPickerRef.current) {
      const rect = emojiPickerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      let rightVal = '0px';
      let leftVal = 'auto';
      let bottomVal = '35px';
      let topVal = 'auto';

      // Horizontal boundary auto-correction
      if (rect.right > viewportWidth - 16) {
        const overflowX = rect.right - (viewportWidth - 16);
        rightVal = `${overflowX}px`;
      }
      if (rect.left < 16) {
        leftVal = '0px';
        rightVal = 'auto';
      }

      // Vertical boundary auto-correction (if it overflows the top viewport boundary)
      if (rect.top < 16) {
        bottomVal = 'auto';
        topVal = '35px';
      }

      setPickerCoords({
        bottom: bottomVal,
        top: topVal,
        right: rightVal,
        left: leftVal,
        opacity: 1,
        transition: 'opacity 0.15s ease-out'
      });
    } else {
      setPickerCoords({
        bottom: '35px',
        right: '0px',
        left: 'auto',
        opacity: 0,
      });
    }
  }, [showEmojiPicker]);


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

  const lineCount = message.content.split('\n').length;
  const isLongMessage = lineCount > 15;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const getFileExtension = (content: string) => {
    const codeBlockMatch = content.match(/```(\w+)?/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      const lang = codeBlockMatch[1].toLowerCase();
      const mapping: { [key: string]: string } = {
        javascript: 'js', js: 'js',
        typescript: 'ts', ts: 'ts',
        tsx: 'tsx', jsx: 'jsx',
        python: 'py', py: 'py',
        html: 'html', css: 'css',
        sql: 'sql', json: 'json',
        rust: 'rs', cpp: 'cpp', c: 'c',
        java: 'java', go: 'go', sh: 'sh',
        bash: 'sh', yaml: 'yaml', yml: 'yaml'
      };
      return mapping[lang] || lang;
    }
    return 'txt';
  };

  const handleDownload = () => {
    let fileContent = message.content;
    const codeBlockRegex = /^```(?:\w+)?\n([\s\S]*?)\n```$/;
    const match = message.content.match(codeBlockRegex);
    if (match) {
      fileContent = match[1];
    }

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const ext = getFileExtension(message.content);
    const filename = `program_${message.id.substring(0, 8)}.${ext}`;
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            {isLongMessage ? (
              <div className="terminal-snippet-frame">
                {/* Vintage Snippet Header */}
                <div className="terminal-snippet-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={14} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                      program_{message.id.substring(0, 8)}.{getFileExtension(message.content)} ({lineCount} lines)
                    </span>
                  </div>

                  {/* Retro CRT Color Selector */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: 'auto', marginLeft: '16px' }}>
                    <button 
                      onClick={() => { soundFx.playClick(); setSnippetColor('green'); }}
                      style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#33ff33', border: '1px solid rgba(255,255,255,0.3)', opacity: snippetColor === 'green' ? 1 : 0.35, cursor: 'pointer' }}
                      title="Green Phosphor"
                    />
                    <button 
                      onClick={() => { soundFx.playClick(); setSnippetColor('amber'); }}
                      style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffb000', border: '1px solid rgba(255,255,255,0.3)', opacity: snippetColor === 'amber' ? 1 : 0.35, cursor: 'pointer' }}
                      title="Amber Phosphor"
                    />
                    <button 
                      onClick={() => { soundFx.playClick(); setSnippetColor('steel'); }}
                      style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1', border: '1px solid rgba(255,255,255,0.3)', opacity: snippetColor === 'steel' ? 1 : 0.35, cursor: 'pointer' }}
                      title="Steel console"
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => {
                        soundFx.playClick();
                        handleCopy();
                      }}
                      onMouseEnter={() => soundFx.playHover()}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={12} style={{ color: 'var(--online)' }} /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => {
                        soundFx.playClick();
                        handleDownload();
                      }}
                      onMouseEnter={() => soundFx.playHover()}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                      title="Download file"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Index Line-by-Line Snippet Body */}
                <div 
                  className={`terminal-snippet-body ${snippetColor}-phosphor`} 
                  style={{
                    maxHeight: isExpanded ? 'none' : '260px',
                    overflowY: isExpanded ? 'auto' : 'hidden',
                  }}
                >
                  {message.content.split('\n').map((line, idx) => (
                    <div key={idx} className="terminal-line">
                      <span className="terminal-line-index">{idx + 1}</span>
                      <span>{line}</span>
                    </div>
                  ))}
                  
                  {!isExpanded && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: '70px',
                      background: 'linear-gradient(180deg, transparent 0%, #030408 100%)',
                      pointerEvents: 'none',
                      zIndex: 3
                    }} />
                  )}
                </div>

                {/* Snippet Footer Expand Trigger */}
                <div style={{
                  padding: '0.4rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 4,
                  position: 'relative'
                }}>
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setIsExpanded(!isExpanded);
                    }}
                    onMouseEnter={() => soundFx.playHover()}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--accent-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      cursor: 'pointer'
                    }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={13} />
                        <span>Collapse Snippet</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={13} />
                        <span>Expand Snippet ({lineCount - 8} more lines)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {message.content}
                {message.is_edited && <span className="message-edited">(edited)</span>}
              </>
            )}
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
                  onMouseEnter={() => soundFx.playHover()}
                  onClick={() => {
                    soundFx.playClick();
                    handleToggleReaction(group.emoji);
                  }}
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
            onMouseEnter={() => soundFx.playHover()}
            onClick={() => {
              soundFx.playClick();
              setThreadParent(message);
            }}
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
            onMouseEnter={() => soundFx.playHover()}
            onClick={() => {
              soundFx.playClick();
              setShowEmojiPicker(!showEmojiPicker);
            }}
            title="React with Emoji"
          >
            <Smile size={14} />
          </button>

          {isSender && (
            <>
              <button 
                className="action-btn" 
                onMouseEnter={() => soundFx.playHover()}
                onClick={() => {
                  soundFx.playClick();
                  setIsEditing(true);
                }} 
                title="Edit Message"
              >
                <Edit2 size={14} />
              </button>
              <button 
                className="action-btn" 
                onMouseEnter={() => soundFx.playHover()}
                onClick={() => {
                  soundFx.playWarning();
                  handleDelete();
                }} 
                title="Delete Message"
              >
                <Trash2 size={14} style={{ color: '#f87171' }} />
              </button>
            </>
          )}

          {!isThreadView && !message.parent_id && (
            <button 
              className="action-btn" 
              onMouseEnter={() => soundFx.playHover()}
              onClick={() => {
                soundFx.playClick();
                setThreadParent(message);
              }} 
              title="Reply in Thread"
            >
              <MessageSquare size={14} />
            </button>
          )}

          {/* Floated Emoji Pick Popover */}
          {showEmojiPicker && (
            <div 
              ref={emojiPickerRef}
              className="emoji-picker-container" 
              style={{ ...pickerCoords }}
            >
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onMouseEnter={() => soundFx.playHover()}
                  onClick={() => {
                    soundFx.playClick();
                    handleToggleReaction(emoji);
                  }}
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
}
