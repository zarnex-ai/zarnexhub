import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  status_text: string | null;
  is_online: boolean;
  updated_at: string;
  streak_count?: number;
  total_messages_count?: number;
  banner_color?: string;
  joined_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateStatus: (statusText: string | null) => Promise<void>;
  updateProfileDetails: (fullName: string | null, avatarUrl: string | null) => Promise<void>;
  updateProfileBanner: (bannerColor: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile details from database, or create one if it is missing (self-healing fallback)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (!data) {
        // Profile doesn't exist yet (e.g. user registered before trigger/table was created)
        // Get user session metadata to prepopulate profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const baseUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
          // Append first 4 chars of user id to avoid collisions
          const uniqueUsername = `${baseUsername}_${user.id.substring(0, 4)}`.toLowerCase();

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              username: uniqueUsername,
              full_name: user.user_metadata?.full_name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              is_online: true
            })
            .select()
            .single();

          if (insertError) {
            console.error('Failed to auto-create profile:', insertError);
            return null;
          }
          return newProfile as Profile;
        }
      }

      return data as Profile;
    } catch (err) {
      console.error('Fetch profile catch:', err);
      return null;
    }
  };

  // Update online status in database
  const setOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
      await supabase
        .from('profiles')
        .update({ is_online: isOnline, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.error('Error setting online status:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id);
      if (prof) setProfile(prof);
    }
  };

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id).then((prof) => {
          setProfile(prof);
          setOnlineStatus(session.user.id, true);
        });
      }
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          setUser(session.user);
          const prof = await fetchProfile(session.user.id);
          setProfile(prof);
          await setOnlineStatus(session.user.id, true);
        } else {
          if (user) {
            await setOnlineStatus(user.id, false);
          }
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Tab close presence sync
    const handleBeforeUnload = () => {
      if (user) {
        // Use keepalive sendBeacon / trigger updates if possible (best-effort)
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (key && import.meta.env.VITE_SUPABASE_URL !== 'your-supabase-project-url') {
          const headers = {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          };
          const body = JSON.stringify({ is_online: false, updated_at: new Date().toISOString() });
          fetch(url, {
            method: 'PATCH',
            headers,
            body,
            keepalive: true
          }).catch(err => console.error('keepalive presence update error', err));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id]);

  const signOut = async () => {
    if (user) {
      await setOnlineStatus(user.id, false);
    }
    await supabase.auth.signOut();
  };

  const updateStatus = async (statusText: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ status_text: statusText, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating status:', error);
      throw error;
    }
    
    setProfile(prev => prev ? { ...prev, status_text: statusText } : null);
  };

  const updateProfileDetails = async (fullName: string | null, avatarUrl: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: fullName, 
        avatar_url: avatarUrl, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile details:', error);
      throw error;
    }

    setProfile(prev => prev ? { ...prev, full_name: fullName, avatar_url: avatarUrl } : null);
  };

  const updateProfileBanner = async (bannerColor: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ 
        banner_color: bannerColor, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating banner color:', error);
      throw error;
    }

    setProfile(prev => prev ? { ...prev, banner_color: bannerColor } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        updateStatus,
        updateProfileDetails,
        updateProfileBanner,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
