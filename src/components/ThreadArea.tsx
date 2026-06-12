import React, { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { X } from 'lucide-react';

export const ThreadArea: React.FC = () => {
  const { threadParent, threadReplies, setThreadParent } = useChat();
  const repliesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of thread replies when they load or update
  const scrollToBottom = () => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threadReplies]);

  if (!threadParent) return null;

  return (
    <section className="thread-panel">
      {/* Thread Header */}
      <header className="thread-header">
        <h3 className="thread-title">Thread</h3>
        <button 
          className="thread-close-btn" 
          onClick={() => setThreadParent(null)} 
          title="Close Thread"
        >
          <X size={20} />
        </button>
      </header>

      {/* Thread Content Viewport */}
      <div className="thread-content">
        {/* Parent Message Displayed at Top */}
        <div className="thread-parent-section">
          <MessageItem message={threadParent} isThreadView={true} />
        </div>

        {/* Replies Section */}
        <div className="thread-replies-section">
          <div className="thread-replies-divider">
            <span>{threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}</span>
          </div>

          {threadReplies.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }} className="pulse">
              No replies yet. Start the conversation!
            </div>
          ) : (
            threadReplies.map((reply) => (
              <MessageItem key={reply.id} message={reply} isThreadView={true} />
            ))
          )}
          <div ref={repliesEndRef} />
        </div>
      </div>

      {/* Thread Input Area */}
      <div className="message-input-area" style={{ padding: '1rem', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-subtle)' }}>
        <MessageInput 
          parentId={threadParent.id} 
          placeholder="Reply..." 
        />
      </div>
    </section>
  );
};
