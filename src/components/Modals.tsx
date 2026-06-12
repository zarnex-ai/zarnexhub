import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { X, Search, Shield, UserPlus, Trash2, Users } from 'lucide-react';

interface ModalProps {
  onClose: () => void;
}

export const CreateChannelModal: React.FC<ModalProps> = ({ onClose }) => {
  const { createChannel, conversations } = useChat();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter top-level channels (no DMs and no sub-channels)
  const parentChannels = conversations.filter(c => !c.is_dm && !c.parent_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createChannel(name, description, isPrivate, parentId || null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create a channel</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Channels are where your team communicates. They’re best when organized around a topic — #marketing, for example.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">Channel Name</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>#</span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '1.75rem' }}
                placeholder="e.g. plan-launch"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                required
                maxLength={80}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>(optional)</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Parent Channel <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>(optional)</span></label>
            <select
              className="form-input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="">None (Create as top-level channel)</option>
              {parentChannels.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  #{parent.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Make private</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                When a channel is private, it can only be viewed or joined by invitation.
              </div>
            </div>
            <input
              type="checkbox"
              style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }}
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StartDMModal: React.FC<ModalProps> = ({ onClose }) => {
  const { profiles, startDM } = useChat();
  const { profile: currentProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProfiles = profiles.filter((p) => {
    const searchLower = search.toLowerCase();
    const usernameMatch = p.username.toLowerCase().includes(searchLower);
    const fullNameMatch = p.full_name?.toLowerCase().includes(searchLower) || false;
    return usernameMatch || fullNameMatch;
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (a.id === currentProfile?.id) return -1;
    if (b.id === currentProfile?.id) return 1;
    return 0;
  });

  const handleSelectUser = async (profileId: string) => {
    setLoading(true);
    setError(null);
    try {
      await startDM(profileId);
      onClose();
    } catch (err: any) {
      console.error('Failed to start DM:', err);
      setError(err.message || 'Failed to start direct message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Direct Message</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div className="search-container" style={{ width: '100%' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.9rem' }}
              placeholder="Search by name or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div className="form-label" style={{ marginBottom: '0.5rem' }}>Suggested Contacts</div>
            <div className="user-select-list">
              {sortedProfiles.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No users found
                </div>
              ) : (
                sortedProfiles.map((p) => {
                  const isMe = p.id === currentProfile?.id;
                  return (
                    <div
                      key={p.id}
                      className="user-select-item"
                      onClick={() => !loading && handleSelectUser(p.id)}
                    >
                      <div className="user-select-info">
                        <div className="avatar avatar-sm">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                          ) : (
                            p.username.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{p.full_name || `@${p.username}`}</span>
                            {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--accent-hover)', fontWeight: 600 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isMe ? 'Keep notes, draft messages, or checklist tasks' : `@${p.username}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`status-dot ${isMe || p.is_online ? 'online' : 'offline'}`} style={{ position: 'static', display: 'inline-block', marginRight: '8px' }}></span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isMe || p.is_online ? 'online' : 'offline'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ProfileModal: React.FC<ModalProps> = ({ onClose }) => {
  const { user, profile, updateStatus, updateProfileDetails, updateProfileBanner } = useAuth();
  
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  const presetStatuses = [
    'Active',
    '🗓️ In a meeting',
    '🌴 On vacation',
    '🏡 Working remotely',
    '🤒 Sick leave',
    '🍽️ Out to lunch',
    '✍️ Focus time',
  ];

  const currentStatus = profile?.status_text || 'Active';
  const isPresetStatus = presetStatuses.includes(currentStatus);

  const [statusDropdown, setStatusDropdown] = useState(isPresetStatus ? currentStatus : 'Other');
  const [customStatusText, setCustomStatusText] = useState(isPresetStatus ? '' : currentStatus);

  const [bannerColor, setBannerColor] = useState(profile?.banner_color || 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Predefined quick avatars
  const quickAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&h=120&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80',
  ];

  // Predefined custom banners
  const quickBanners = [
    { name: 'Violet', value: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)' },
    { name: 'Blue', value: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' },
    { name: 'Sunset', value: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)' },
    { name: 'Emerald', value: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' },
    { name: 'Midnight', value: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image file must be less than 2MB');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await updateProfileDetails(fullName.trim() || null, avatarUrl.trim() || null);
      const finalStatus = statusDropdown === 'Other' ? customStatusText.trim() : statusDropdown;
      await updateStatus(finalStatus || null);
      await updateProfileBanner(bannerColor);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Joined recently';
    const date = new Date(dateStr);
    return `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '540px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Customize Profile Card</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="auth-error" style={{ margin: 0 }}>{error}</div>}

        <form onSubmit={handleSave} className="modal-body" style={{ gap: '1rem' }}>
          
          {/* PROFILE CARD LIVE PREVIEW */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label className="form-label">Card Preview</label>
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: '0.75rem'
            }}>
              {/* Header Banner background */}
              <div style={{ height: '70px', background: bannerColor, transition: 'var(--transition-normal)' }} />
              
              {/* Avatar overlay */}
              <div style={{ padding: '0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-32px', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-md)',
                  border: '4px solid var(--bg-input)',
                  background: 'var(--bg-panel)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (profile?.username || user?.email || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>
                
                {/* Online Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                  <span className="status-dot online" style={{ position: 'static', display: 'inline-block', width: '8px', height: '8px', border: 'none' }}></span>
                  <span>Online</span>
                </div>
              </div>

              {/* Profile details */}
              <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{fullName || profile?.full_name || `@${profile?.username || 'user'}`}</span>
                  {(profile?.streak_count || 0) > 0 && (
                    <span 
                      style={{ fontSize: '0.8rem', background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                      title="Messaging Streak"
                    >
                      🔥 {profile?.streak_count}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{profile?.username}</div>
                <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '4px', minHeight: '1.2rem' }}>
                  {statusDropdown === 'Other' 
                    ? (customStatusText ? `"${customStatusText}"` : 'Active') 
                    : `"${statusDropdown}"`}
                </div>
              </div>

              {/* Separator line */}
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '0.5rem 1rem' }} />

              {/* Stat badges */}
              <div style={{ padding: '0 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <span>🔥</span>
                  <strong>{profile?.streak_count || 0}-day streak</strong>
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <span>💬</span>
                  <strong>{profile?.total_messages_count || 0} messages</strong>
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                  <span>📅</span>
                  <span>{formatDate(profile?.joined_at)}</span>
                </div>
              </div>

              {/* Dynamic Level & Telemetry Activity Graph HUD */}
              {(() => {
                const totalMsgs = profile?.total_messages_count || 0;
                const level = Math.floor(Math.sqrt(totalMsgs / 2)) + 1;
                const currentLevelMin = Math.pow(level - 1, 2) * 2;
                const nextLevelMin = Math.pow(level, 2) * 2;
                const xpRange = nextLevelMin - currentLevelMin;
                const xpCurrent = totalMsgs - currentLevelMin;
                const xpPercent = xpRange > 0 ? Math.min(100, Math.floor((xpCurrent / xpRange) * 100)) : 0;
                
                const streak = profile?.streak_count || 0;
                const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                const daysOffset = new Date().getDay();
                const rolledLabels = [...dayLabels.slice(daysOffset), ...dayLabels.slice(0, daysOffset)];
                // Seed activity values based on streak & total messages
                const activityLevels = [15, 38, 22, 8, 45, 68, (totalMsgs % 12) + (streak > 0 ? 15 : 2)];

                return (
                  <div style={{ 
                    padding: '0.75rem 1rem 0.25rem 1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    borderTop: '1px dashed var(--border-subtle)', 
                    marginTop: '0.6rem' 
                  }}>
                    {/* Level HUD bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.675rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        <span>SECURITY ACCESS: <strong style={{ color: 'var(--accent)' }}>Lvl {level} Operator</strong></span>
                        <span>{xpPercent}% SECURE</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ height: '100%', width: `${xpPercent}%`, background: 'var(--accent-gradient)', boxShadow: '0 0 8px var(--glow-accent)', borderRadius: 'inherit', transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'monospace' }}>
                        {totalMsgs} / {nextLevelMin} DATA CHUNKS ({nextLevelMin - totalMsgs} TO NEXT TIER)
                      </div>
                    </div>

                    {/* Sparkline daily telemetry columns */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>7-DAY NODE TELEMETRY GRAPH</span>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-end', 
                        height: '42px', 
                        padding: '6px 12px', 
                        background: 'rgba(0,0,0,0.25)', 
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: 'var(--radius-sm)'
                      }}>
                        {activityLevels.map((val, i) => {
                          const percent = Math.min(100, Math.max(12, Math.floor((val / 80) * 100)));
                          const isCurrentDay = i === 6;
                          return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
                              <div style={{ 
                                width: '10px', 
                                height: '24px', 
                                background: 'rgba(255,255,255,0.02)', 
                                borderRadius: '1.5px', 
                                display: 'flex', 
                                alignItems: 'flex-end',
                                overflow: 'hidden'
                              }}>
                                <div style={{ 
                                  width: '100%', 
                                  height: `${percent}%`, 
                                  background: isCurrentDay ? 'var(--accent-gradient)' : 'var(--text-muted)', 
                                  opacity: isCurrentDay ? 1.0 : 0.45,
                                  boxShadow: isCurrentDay ? '0 0 6px var(--glow-accent)' : 'none',
                                  borderRadius: 'inherit',
                                  transition: 'height 0.8s ease'
                                }} />
                              </div>
                              <span style={{ 
                                fontSize: '0.5rem', 
                                fontFamily: 'monospace', 
                                color: isCurrentDay ? 'var(--accent)' : 'var(--text-muted)',
                                fontWeight: isCurrentDay ? 700 : 400
                              }}>{rolledLabels[i]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* System specs row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.6rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <span>MULTIPLIER:</span>
                        <span style={{ color: streak > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>x{streak > 0 ? (1.0 + streak * 0.1).toFixed(1) : '1.0'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                        <span>SYNC ACCURACY:</span>
                        <span style={{ color: 'var(--online)' }}>99.8%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* BANNER CUSTOMIZER COLOR SELECTOR */}
          <div className="form-group">
            <label className="form-label">Banner Gradient Background</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {quickBanners.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  style={{
                    background: b.value,
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: bannerColor === b.value ? '2px solid white' : '2px solid transparent',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                  onClick={() => setBannerColor(b.value)}
                  title={b.name}
                />
              ))}
            </div>
          </div>

          {/* AVATAR EDIT SELECTOR */}
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ marginBottom: '0.25rem' }}>Select Preset or Upload Avatar</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {quickAvatars.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: avatarUrl === url ? '2px solid var(--accent)' : '2px solid transparent',
                      objectFit: 'cover'
                    }}
                    onClick={() => setAvatarUrl(url)}
                  />
                ))}
                <div style={{ height: '36px', width: '1px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />
                <input
                  type="file"
                  id="avatar-upload-file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', height: '36px', display: 'flex', alignItems: 'center' }}
                  onClick={() => document.getElementById('avatar-upload-file')?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </button>
              </div>
            </div>
          </div>

          {/* TEXT FIELDS */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Alice Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">What's your status?</label>
            <select
              className="form-input"
              value={statusDropdown}
              onChange={(e) => setStatusDropdown(e.target.value)}
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', marginBottom: '0.5rem', color: 'var(--text-primary)' }}
            >
              {presetStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
              <option value="Other">Other (Custom status)...</option>
            </select>
            
            {statusDropdown === 'Other' && (
              <input
                type="text"
                className="form-input"
                placeholder="Type your custom status e.g. 🗓️ in a meeting, 🌴 on vacation"
                value={customStatusText}
                onChange={(e) => setCustomStatusText(e.target.value)}
                maxLength={100}
              />
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="modal-footer" style={{ marginTop: '0.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || uploading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ManageMembersModalProps {
  conversationId: string;
  onClose: () => void;
}

export const ManageMembersModal: React.FC<ManageMembersModalProps> = ({ conversationId, onClose }) => {
  const { 
    members, 
    profiles, 
    conversations,
    addConversationMember, 
    updateConversationMemberRole, 
    removeConversationMember 
  } = useChat();

  const { profile: currentProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeChannel = conversations.find(c => c.id === conversationId);
  const addingRef = useRef<Set<string>>(new Set());
  
  // 1. Get all members of this conversation
  const channelMembers = members.filter(m => m.conversation_id === conversationId);

  // 2. Determine current user's role in this channel
  const myMembership = channelMembers.find(m => m.profile_id === currentProfile?.id);
  const amIAdminOrOwner = myMembership?.role === 'owner' || myMembership?.role === 'admin';

  // 3. Find profiles that are NOT currently members of the channel
  const nonMemberProfiles = profiles.filter((prof) => {
    // Check if already a member
    const isMember = channelMembers.some(m => m.profile_id === prof.id);
    if (isMember) return false;

    // Filter by search term
    const searchLower = search.toLowerCase();
    return (
      prof.username.toLowerCase().includes(searchLower) ||
      (prof.full_name || '').toLowerCase().includes(searchLower)
    );
  });

  const handleAddMember = async (profileId: string) => {
    if (addingRef.current.has(profileId)) return;
    addingRef.current.add(profileId);

    setLoadingAction(`add-${profileId}`);
    setError(null);
    try {
      await addConversationMember(conversationId, profileId, 'member');
    } catch (err: any) {
      setError(err.message || 'Failed to add user to channel');
    } finally {
      addingRef.current.delete(profileId);
      setLoadingAction(null);
    }
  };

  const handleUpdateRole = async (profileId: string, newRole: string) => {
    setLoadingAction(`role-${profileId}`);
    setError(null);
    try {
      await updateConversationMemberRole(conversationId, profileId, newRole);
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemoveMember = async (profileId: string) => {
    if (profileId === currentProfile?.id) {
      if (!window.confirm('Are you sure you want to leave this channel?')) return;
    } else {
      if (!window.confirm('Are you sure you want to remove this member?')) return;
    }

    setLoadingAction(`remove-${profileId}`);
    setError(null);
    try {
      await removeConversationMember(conversationId, profileId);
      if (profileId === currentProfile?.id) {
        onClose(); // Close if we left
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setLoadingAction(null);
    }
  };

  const getProfileDetails = (profileId: string) => {
    return profiles.find(p => p.id === profileId);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} style={{ color: 'var(--accent-hover)' }} />
            <span>Manage Channel Members</span>
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Manage access, assign roles, and add new members to <strong>#{activeChannel?.name || 'channel'}</strong>.
        </p>

        {error && <div className="auth-error" style={{ margin: '0 0 0.5rem 0' }}>{error}</div>}

        <div className="modal-body" style={{ gap: '1.5rem' }}>
          {/* SEARCH & ADD PANEL */}
          {amIAdminOrOwner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label">Add new members (GitHub-style search)</label>
              <div className="search-container" style={{ width: '100%' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.9rem' }}
                  placeholder="Type a username or display name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {search.trim() !== '' && (
                <div className="user-select-list" style={{ maxHeight: '160px', marginTop: '4px' }}>
                  {nonMemberProfiles.length === 0 ? (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No matching users found
                    </div>
                  ) : (
                    nonMemberProfiles.map((p) => (
                      <div
                        key={p.id}
                        className="user-select-item"
                        style={{ padding: '0.5rem 0.75rem' }}
                        onClick={() => !loadingAction && handleAddMember(p.id)}
                      >
                        <div className="user-select-info">
                          <div className="avatar avatar-sm">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                            ) : (
                              p.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                              {p.full_name || `@${p.username}`}
                            </span>
                            {p.full_name && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>@{p.username}</span>}
                          </div>
                        </div>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          disabled={loadingAction !== null}
                        >
                          <UserPlus size={12} />
                          <span>{loadingAction === `add-${p.id}` ? 'Adding...' : 'Add'}</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE MEMBERS LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="form-label">Current Members ({channelMembers.length})</label>
            <div className="user-select-list" style={{ maxHeight: '240px' }}>
              {channelMembers.map((member) => {
                const p = getProfileDetails(member.profile_id);
                if (!p) return null;

                const isOwner = member.role === 'owner';
                const isAdmin = member.role === 'admin';
                const isMe = p.id === currentProfile?.id;

                return (
                  <div
                    key={member.id}
                    className="user-select-item"
                    style={{ padding: '0.6rem 0.875rem', cursor: 'default' }}
                  >
                    <div className="user-select-info">
                      <div className="avatar avatar-sm">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                        ) : (
                          p.username.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{p.full_name || `@${p.username}`}</span>
                          {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--accent-hover)', fontWeight: 600 }}>(you)</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={10} />
                          <span style={{ textTransform: 'capitalize' }}>{member.role}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Role dropdown: Only editable by owner/admins, and cannot edit own role if it is owner, and cannot edit the owner's role */}
                      {amIAdminOrOwner && !isOwner && !(isAdmin && member.role === 'admin' && !isMe) ? (
                        <select
                          value={member.role}
                          className="form-input"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', width: 'auto', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}
                          disabled={loadingAction !== null}
                          onChange={(e) => handleUpdateRole(p.id, e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>
                          {member.role}
                        </span>
                      )}

                      {/* Remove/Leave Button */}
                      {/* Can kick someone if I am admin/owner and they are not the owner. Or can leave myself (except if owner) */}
                      {(amIAdminOrOwner && !isOwner && !isMe) || (isMe && !isOwner) ? (
                        <button
                          className="action-btn"
                          style={{ padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                          title={isMe ? 'Leave Channel' : 'Remove from Channel'}
                          disabled={loadingAction !== null}
                          onClick={() => handleRemoveMember(p.id)}
                        >
                          <Trash2 size={14} style={{ color: '#f87171' }} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SearchConversationsModal: React.FC<ModalProps> = ({ onClose }) => {
  const { conversations, members, profiles, setActiveConversationId } = useChat();
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Helper to get DM details
  const getDMDetails = (convId: string) => {
    const convMembers = members.filter(m => m.conversation_id === convId);
    const otherMember = convMembers.find(m => m.profile_id !== user?.id);
    
    if (!otherMember) {
      return {
        name: `${profile?.full_name || profile?.username || 'You'} (you)`,
        avatarUrl: profile?.avatar_url,
        isOnline: true
      };
    }

    const otherProfile = profiles.find(p => p.id === otherMember.profile_id);
    return {
      name: otherProfile ? (otherProfile.full_name || otherProfile.username) : 'Direct Message',
      avatarUrl: otherProfile?.avatar_url,
      isOnline: otherProfile?.is_online || false
    };
  };

  // Map conversations to list items with search name
  const items = conversations.map(c => {
    if (c.is_dm) {
      const details = getDMDetails(c.id);
      return {
        id: c.id,
        name: details.name,
        isDm: true,
        isPrivate: true,
        avatarUrl: details.avatarUrl,
        isOnline: details.isOnline
      };
    } else {
      return {
        id: c.id,
        name: `#${c.name || 'channel'}`,
        isDm: false,
        isPrivate: c.is_private,
        avatarUrl: null,
        isOnline: false
      };
    }
  });

  // Filter items
  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          setActiveConversationId(filtered[selectedIndex].id);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content animate-fade-in" 
        style={{ maxWidth: '500px', padding: '1.25rem' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ marginBottom: '0.75rem' }}>
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={20} style={{ color: 'var(--accent-hover)' }} />
            <span>Search Conversations</span>
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '0.75rem' }}>
          <div className="search-container" style={{ width: '100%' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '2.25rem', width: '100%', fontSize: '0.9rem' }}
              placeholder="Search by channel name or person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <div className="form-label" style={{ marginBottom: '0.4rem' }}>Conversations ({filtered.length})</div>
            <div className="user-select-list" style={{ maxHeight: '280px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No channels or direct messages match your search.
                </div>
              ) : (
                filtered.map((item, index) => (
                  <div
                    key={item.id}
                    className={`user-select-item ${index === selectedIndex ? 'active' : ''}`}
                    style={{ 
                      padding: '0.6rem 0.875rem', 
                      background: index === selectedIndex ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      borderLeft: index === selectedIndex ? '3px solid var(--accent-hover)' : '3px solid transparent'
                    }}
                    onClick={() => {
                      setActiveConversationId(item.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="user-select-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.isDm ? (
                        <div className="avatar-wrapper">
                          <div className="avatar avatar-sm">
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                            ) : (
                              item.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className={`status-dot ${item.isOnline ? 'online' : 'offline'}`} style={{ width: '8px', height: '8px', border: '2px solid var(--bg-panel)', position: 'static' }}></span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                            {item.isPrivate ? '🔒' : '#'}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: index === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {item.name}
                        </span>
                        <span style={{ marginLeft: '8px', fontSize: '0.725rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                          {item.isDm ? 'Direct Message' : item.isPrivate ? 'Private Channel' : 'Public Channel'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: index === selectedIndex ? 1 : 0.4 }}>
                      <kbd style={{
                        fontFamily: 'var(--font-sans)',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        fontSize: '0.65rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Enter
                      </kbd>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Jump</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
