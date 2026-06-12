import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { Send, Paperclip, Smile } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MessageInputProps {
  parentId?: string | null;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({ parentId = null, placeholder }) => {
  const { sendMessage, sendTypingSignal } = useChat();
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingTimeRef = useRef<number>(0);

  // Predefined reaction emojis
  const quickEmojis = ['👍', '❤️', '😂', '🔥', '🎉', '🚀', '👀', '💯'];

  // Handle typing signal (throttled to once every 2 seconds)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    const now = Date.now();
    if (now - lastTypingTimeRef.current > 2000) {
      sendTypingSignal();
      lastTypingTimeRef.current = now;
    }
  };

  const handleSend = async () => {
    if (!content.trim() || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(content.trim(), parentId);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Adjust height of textarea dynamically based on content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Check size limit (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${Date.now()}_${cleanFileName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const isImage = file.type.startsWith('image/');
      const markdown = isImage 
        ? `\n![${file.name}](${publicUrl})\n` 
        : `\n📎 [${file.name}](${publicUrl})\n`;
      
      setContent(prev => prev + markdown);
      
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="emoji-picker-container">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              className="emoji-btn"
              onClick={() => insertEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="input-container-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder={placeholder || 'Send a message...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isSending}
        />

        <div className="input-toolbar">
          <div className="toolbar-group">
            <input
              type="file"
              id={`chat-file-upload-${parentId || 'main'}`}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={isSending || uploadingFile}
            />
            <button 
              className="toolbar-btn" 
              onClick={() => document.getElementById(`chat-file-upload-${parentId || 'main'}`)?.click()} 
              title="Attach a file"
              disabled={isSending || uploadingFile}
            >
              <Paperclip size={16} />
            </button>
            <button 
              className="toolbar-btn" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
              title="Choose an emoji"
              disabled={isSending || uploadingFile}
            >
              <Smile size={16} />
            </button>
            {uploadingFile && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-hover)', marginLeft: '8px' }} className="pulse">
                Uploading attachment...
              </span>
            )}
          </div>

          <button 
            className="send-btn" 
            onClick={handleSend} 
            disabled={!content.trim() || isSending}
            title="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
