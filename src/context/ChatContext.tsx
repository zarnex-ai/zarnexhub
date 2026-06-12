import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Profile } from './AuthContext';


export interface Conversation {
  id: string;
  name: string | null;
  description: string | null;
  is_dm: boolean;
  is_private: boolean;
  created_by: string | null;
  parent_id?: string | null;
  created_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
}

export interface Reaction {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  parent_id: string | null;
  is_edited: boolean;
  created_at: string;
  profiles?: Profile | null; // Joined profile
  reactions?: Reaction[]; // Joined reactions
}

interface ChatContextType {
  conversations: Conversation[];
  members: ConversationMember[];
  profiles: Profile[];
  activeConversation: Conversation | null;
  messages: Message[];
  threadParent: Message | null;
  threadReplies: Message[];
  typingUsers: { [username: string]: boolean };
  loadingConversations: boolean;
  loadingMessages: boolean;
  setActiveConversationId: (id: string | null) => void;
  setThreadParent: (message: Message | null) => void;
  createChannel: (name: string, description: string, isPrivate: boolean, parentId?: string | null) => Promise<Conversation>;
  startDM: (targetProfileId: string) => Promise<Conversation>;
  sendMessage: (content: string, parentId?: string | null) => Promise<Message>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  sendTypingSignal: () => void;
  addConversationMember: (conversationId: string, profileId: string, role?: string) => Promise<void>;
  updateConversationMemberRole: (conversationId: string, profileId: string, role: string) => Promise<void>;
  removeConversationMember: (conversationId: string, profileId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadParent, setThreadParentState] = useState<Message | null>(null);
  
  const [typingUsers, setTypingUsers] = useState<{ [username: string]: boolean }>({});
  
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const threadParentIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<{ [username: string]: any }>({});
  const broadcastChannelRef = useRef<any>(null);

  // Helper to extract channel keys for JSON chats lookup
  const getChatKeys = (conv: Conversation) => {
    if (conv.is_dm) {
      return { channelId: conv.id, subChannelId: null };
    }
    if (conv.parent_id) {
      return { channelId: conv.parent_id, subChannelId: conv.id };
    }
    return { channelId: conv.id, subChannelId: null };
  };

  const threadReplies = threadParent 
    ? messages.filter(m => m.parent_id === threadParent.id) 
    : [];

  const setActiveConversationId = (id: string | null) => {
    setActiveConversationIdState(id);
    activeConvIdRef.current = id;
    setThreadParent(null); // Close thread on conversation change
  };

  const setThreadParent = (message: Message | null) => {
    setThreadParentState(message);
    threadParentIdRef.current = message ? message.id : null;
  };

  // Fetch all initial metadata (profiles, conversations user belongs to, and memberships)
  const loadWorkspaceData = async () => {
    if (!user) return;
    setLoadingConversations(true);
    try {
      // 1. Fetch profiles
      const { data: profs, error: profsErr } = await supabase
        .from('profiles')
        .select('*');
      if (profsErr) throw profsErr;
      setProfiles(profs || []);

      // 2. Fetch conversations (RLS handles filtering out inaccessible private channels/DMs)
      const { data: convs, error: convsErr } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: true });
      if (convsErr) throw convsErr;
      setConversations(convs || []);

      // 3. Fetch conversation memberships
      const { data: mems, error: memsErr } = await supabase
        .from('conversation_members')
        .select('*');
      if (memsErr) throw memsErr;
      setMembers(mems || []);

      // Auto-select first conversation if available
      if (convs && convs.length > 0 && !activeConvIdRef.current) {
        // Prefer first public channel or first available conversation
        const mainConv = convs.find(c => !c.is_dm && !c.is_private) || convs[0];
        setActiveConversationId(mainConv.id);
      }
    } catch (err) {
      console.error('Error loading workspace metadata:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Fetch messages in the active conversation from JSON Chats array
  const fetchMessages = async (conv: Conversation) => {
    setLoadingMessages(true);
    try {
      const { channelId, subChannelId } = getChatKeys(conv);
      let query = supabase
        .from('channel_chats')
        .select('chats')
        .eq('channel_id', channelId);

      if (subChannelId) {
        query = query.eq('sub_channel_id', subChannelId);
      } else {
        query = query.is('sub_channel_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      setMessages(data?.chats || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Trigger loading when active conversation changes
  useEffect(() => {
    if (user) {
      loadWorkspaceData();
    } else {
      setConversations([]);
      setMembers([]);
      setProfiles([]);
      setActiveConversationId(null);
      setMessages([]);
      setThreadParent(null);
    }
  }, [user]);

  useEffect(() => {
    if (activeConversationId) {
      const found = conversations.find(c => c.id === activeConversationId);
      setActiveConversation(found || null);
      if (found) {
        fetchMessages(found);
      } else {
        setMessages([]);
      }
      
      // Hook up Broadcast typing indicator channel
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
      }

      setTypingUsers({});
      const typingChan = supabase.channel(`room:${activeConversationId}`);
      
      typingChan
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const { username, isTyping } = payload;
          if (username === profile?.username) return;

          setTypingUsers(prev => ({ ...prev, [username]: isTyping }));

          // Auto clear typing status after 3 seconds of inactivity
          if (typingTimeoutRef.current[username]) {
            clearTimeout(typingTimeoutRef.current[username]);
          }

          if (isTyping) {
            typingTimeoutRef.current[username] = setTimeout(() => {
              setTypingUsers(prev => ({ ...prev, [username]: false }));
            }, 3000);
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            broadcastChannelRef.current = typingChan;
          }
        });

      return () => {
        typingChan.unsubscribe();
      };
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [activeConversationId, conversations]);

  // Real-time Database tables synchronization
  useEffect(() => {
    if (!user) return;

    // Listen to changes in channel_chats, profiles, and conversations
    const channel = supabase.channel('schema-db-changes');

    channel
      // CHANNEL CHATS ARRAY RE-SYNC
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_chats' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          if (activeConvIdRef.current) {
            const activeConv = conversations.find(c => c.id === activeConvIdRef.current);
            if (activeConv) {
              const { channelId, subChannelId } = getChatKeys(activeConv);
              const isMatch = newRecord.channel_id === channelId && 
                (newRecord.sub_channel_id === subChannelId || 
                 (!newRecord.sub_channel_id && !subChannelId));

              if (isMatch) {
                setMessages(newRecord.chats || []);
              }
            }
          }
        } else if (eventType === 'DELETE') {
          if (activeConvIdRef.current) {
            const activeConv = conversations.find(c => c.id === activeConvIdRef.current);
            if (activeConv) {
              const { channelId, subChannelId } = getChatKeys(activeConv);
              const isMatch = oldRecord.channel_id === channelId && 
                (oldRecord.sub_channel_id === subChannelId || 
                 (!oldRecord.sub_channel_id && !subChannelId));

              if (isMatch) {
                setMessages([]);
              }
            }
          }
        }
      })
      // CONVERSATION CHANGES
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setConversations(prev => {
            if (prev.some(c => c.id === newRecord.id)) return prev;
            return [...prev, newRecord as Conversation];
          });
        } else if (eventType === 'UPDATE') {
          setConversations(prev => prev.map(c => c.id === newRecord.id ? { ...c, ...newRecord } : c));
        } else if (eventType === 'DELETE') {
          setConversations(prev => prev.filter(c => c.id !== oldRecord.id));
          if (activeConvIdRef.current === oldRecord.id) {
            setActiveConversationId(null);
          }
        }
      })
      // MEMBERS CHANGES
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, async (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setMembers(prev => {
            if (prev.some(m => m.id === newRecord.id)) return prev;
            return [...prev, newRecord as ConversationMember];
          });

          // If current user was added as a member, fetch the full conversation details to render it
          if (newRecord.profile_id === user?.id) {
            const { data: conv, error } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', newRecord.conversation_id)
              .maybeSingle();
            if (conv && !error) {
              setConversations(prev => {
                if (prev.some(c => c.id === conv.id)) return prev;
                return [...prev, conv];
              });
            }
          }
        } else if (eventType === 'DELETE') {
          const deletedMemberId = oldRecord?.id;
          const removedMember = members.find(m => m.id === deletedMemberId);

          setMembers(prev => prev.filter(m => m.id !== oldRecord.id));

          // If current user was removed as a member, clean up the sidebar and active states
          if (removedMember && removedMember.profile_id === user?.id) {
            setConversations(prev => prev.filter(c => c.id !== removedMember.conversation_id));
            if (activeConvIdRef.current === removedMember.conversation_id) {
              setActiveConversationId(null);
            }
          }
        }
      })
      // PROFILE STATUS CHANGES (real-time presence toggle or avatar change)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const { new: newRecord } = payload;
        setProfiles(prev => prev.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p));
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, conversations]);

  // Operations
  const createChannel = async (name: string, description: string, isPrivate: boolean, parentId: string | null = null): Promise<Conversation> => {
    if (!user) throw new Error('Not authenticated');

    const cleanName = name.toLowerCase().replace(/\s+/g, '-');

    // 1. Check if a channel with the same name already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('name', cleanName)
      .eq('is_dm', false)
      .maybeSingle();

    if (existing) {
      throw new Error(`A channel named #${cleanName} already exists.`);
    }

    // 2. Create the conversation row
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        name: cleanName,
        description,
        is_dm: false,
        is_private: isPrivate,
        created_by: user.id,
        parent_id: parentId
      })
      .select()
      .single();

    if (convErr) throw convErr;

    // 3. Automatically join creator as owner/admin
    const { error: memErr } = await supabase
      .from('conversation_members')
      .insert({
        conversation_id: conv.id,
        profile_id: user.id,
        role: 'owner'
      });

    if (memErr) {
      // Clean up the created conversation to avoid dangling channels if member insertion fails
      await supabase.from('conversations').delete().eq('id', conv.id);
      throw memErr;
    }

    // Add to conversations state
    setConversations(prev => [...prev, conv]);
    setActiveConversationId(conv.id);
    return conv;
  };

  const startDM = async (targetProfileId: string): Promise<Conversation> => {
    if (!user) throw new Error('Not authenticated');

    // 1. Check if DM already exists with this user
    // To do this, we need to inspect conversation members where they have the same conversation
    // and both are members, and that conversation is a DM.
    const myConvIds = members.filter(m => m.profile_id === user.id).map(m => m.conversation_id);
    const targetConvIds = members.filter(m => m.profile_id === targetProfileId).map(m => m.conversation_id);
    
    // Find intersection
    const commonConvIds = myConvIds.filter(id => targetConvIds.includes(id));
    const existingDM = conversations.find(c => c.is_dm && commonConvIds.includes(c.id));

    if (existingDM) {
      setActiveConversationId(existingDM.id);
      return existingDM;
    }

    // 2. Create new DM conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        is_dm: true,
        is_private: true,
        created_by: user.id
      })
      .select()
      .single();

    if (convErr) throw convErr;

    // 3. Add members (Self and Target user)
    const membersToInsert = [
      { conversation_id: conv.id, profile_id: user.id, role: 'member' },
      { conversation_id: conv.id, profile_id: targetProfileId, role: 'member' }
    ];

    const { error: memErr } = await supabase
      .from('conversation_members')
      .insert(membersToInsert);

    if (memErr) throw memErr;

    setConversations(prev => [...prev, conv]);
    setActiveConversationId(conv.id);
    return conv;
  };

  const sendMessage = async (content: string, parentId: string | null = null): Promise<Message> => {
    if (!user || !activeConversation) throw new Error('Cannot send message');

    const newMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content,
      parent_id: parentId,
      is_edited: false,
      created_at: new Date().toISOString(),
      reactions: []
    };

    const { channelId, subChannelId } = getChatKeys(activeConversation);

    const { error } = await supabase.rpc('send_chat_message', {
      p_channel_id: channelId,
      p_sub_channel_id: subChannelId,
      p_message: newMessage
    });

    if (error) throw error;
    
    // Optimistically update local messages array
    setMessages(prev => [...prev, newMessage]);
    
    return newMessage;
  };

  const editMessage = async (messageId: string, content: string): Promise<void> => {
    if (!user || !activeConversation) throw new Error('Cannot edit message');

    const { channelId, subChannelId } = getChatKeys(activeConversation);

    const { error } = await supabase.rpc('edit_chat_message', {
      p_channel_id: channelId,
      p_sub_channel_id: subChannelId,
      p_message_id: messageId,
      p_content: content
    });

    if (error) throw error;

    // Optimistically update local message content
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, is_edited: true } : m));
  };

  const deleteMessage = async (messageId: string): Promise<void> => {
    if (!user || !activeConversation) throw new Error('Cannot delete message');

    const { channelId, subChannelId } = getChatKeys(activeConversation);

    const { error } = await supabase.rpc('delete_chat_message', {
      p_channel_id: channelId,
      p_sub_channel_id: subChannelId,
      p_message_id: messageId
    });

    if (error) throw error;

    // Optimistically remove local message
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  const toggleReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!user || !activeConversation) return;

    const { channelId, subChannelId } = getChatKeys(activeConversation);

    const { error } = await supabase.rpc('toggle_chat_reaction', {
      p_channel_id: channelId,
      p_sub_channel_id: subChannelId,
      p_message_id: messageId,
      p_profile_id: user.id,
      p_emoji: emoji
    });

    if (error) throw error;

    // Optimistically toggle reaction locally
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const currentReactions = m.reactions || [];
      const hasReaction = currentReactions.some(r => r.profile_id === user.id && r.emoji === emoji);
      
      let nextReactions;
      if (hasReaction) {
        nextReactions = currentReactions.filter(r => !(r.profile_id === user.id && r.emoji === emoji));
      } else {
        nextReactions = [...currentReactions, {
          id: crypto.randomUUID(),
          message_id: messageId,
          profile_id: user.id,
          emoji,
          created_at: new Date().toISOString()
        }];
      }
      return { ...m, reactions: nextReactions };
    }));
  };

  const deleteConversation = async (conversationId: string): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
  };

  const sendTypingSignal = () => {
    if (broadcastChannelRef.current && profile) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username: profile.username, isTyping: true }
      });
    }
  };

  const addConversationMember = async (conversationId: string, profileId: string, role: string = 'member'): Promise<void> => {
    const { error } = await supabase
      .from('conversation_members')
      .insert({
        conversation_id: conversationId,
        profile_id: profileId,
        role
      });
    if (error) throw error;
  };

  const updateConversationMemberRole = async (conversationId: string, profileId: string, role: string): Promise<void> => {
    const { error } = await supabase
      .from('conversation_members')
      .update({ role })
      .eq('conversation_id', conversationId)
      .eq('profile_id', profileId);
    if (error) throw error;
  };

  const removeConversationMember = async (conversationId: string, profileId: string): Promise<void> => {
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('profile_id', profileId);
    if (error) throw error;
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        members,
        profiles,
        activeConversation,
        messages,
        threadParent,
        threadReplies,
        typingUsers,
        loadingConversations,
        loadingMessages,
        setActiveConversationId,
        setThreadParent,
        createChannel,
        startDM,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        sendTypingSignal,
        addConversationMember,
        updateConversationMemberRole,
        removeConversationMember,
        deleteConversation
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
