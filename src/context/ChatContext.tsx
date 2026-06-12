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
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  
  const [typingUsers, setTypingUsers] = useState<{ [username: string]: boolean }>({});
  
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const threadParentIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<{ [username: string]: any }>({});
  const broadcastChannelRef = useRef<any>(null);

  const setActiveConversationId = (id: string | null) => {
    setActiveConversationIdState(id);
    activeConvIdRef.current = id;
    setThreadParent(null); // Close thread on conversation change
  };

  const setThreadParent = (message: Message | null) => {
    setThreadParentState(message);
    threadParentIdRef.current = message ? message.id : null;
    if (message) {
      fetchThreadReplies(message.id);
    } else {
      setThreadReplies([]);
    }
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

  // Fetch messages in the active conversation (excluding nested thread replies)
  const fetchMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), reactions(*)')
        .eq('conversation_id', convId)
        .is('parent_id', null) // Only top level messages
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Fetch replies in an active thread
  const fetchThreadReplies = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), reactions(*)')
        .eq('parent_id', messageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setThreadReplies(data || []);
    } catch (err) {
      console.error('Error loading thread replies:', err);
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
      fetchMessages(activeConversationId);
      
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

    // Listen to changes in messages, reactions, profiles, and conversations
    const channel = supabase.channel('schema-db-changes');

    channel
      // MESSAGE CHANGES
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'INSERT') {
          // Resolve sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newRecord.sender_id)
            .single();

          const enrichedMessage: Message = {
            ...newRecord as Message,
            profiles: senderProfile,
            reactions: []
          };

          // 1. Check if it's a top-level message for the active conversation
          if (enrichedMessage.conversation_id === activeConvIdRef.current && !enrichedMessage.parent_id) {
            setMessages(prev => {
              if (prev.some(m => m.id === enrichedMessage.id)) return prev;
              return [...prev, enrichedMessage];
            });
          }

          // 2. Check if it's a thread reply for the active thread
          if (enrichedMessage.parent_id === threadParentIdRef.current) {
            setThreadReplies(prev => {
              if (prev.some(m => m.id === enrichedMessage.id)) return prev;
              return [...prev, enrichedMessage];
            });

            // Update reply counts inside main messages list
            setMessages(prev => prev.map(m => {
              if (m.id === enrichedMessage.parent_id) {
                // Trigger profile refetch or state increase
                return { ...m }; // React render refresh trigger
              }
              return m;
            }));
          }
        } else if (eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === newRecord.id ? { ...m, ...newRecord } : m));
          setThreadReplies(prev => prev.map(m => m.id === newRecord.id ? { ...m, ...newRecord } : m));
          
          if (threadParentIdRef.current === newRecord.id) {
            setThreadParentState(prev => prev ? { ...prev, ...newRecord } : null);
          }
        } else if (eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== oldRecord.id));
          setThreadReplies(prev => prev.filter(m => m.id !== oldRecord.id));
          
          if (threadParentIdRef.current === oldRecord.id) {
            setThreadParentState(null);
          }
        }
      })
      // REACTION CHANGES
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        const updateMessageReactions = (msgs: Message[], targetMsgId: string, reaction: any, type: 'add' | 'remove') => {
          return msgs.map(m => {
            if (m.id !== targetMsgId) return m;
            const currentReactions = m.reactions || [];
            let nextReactions = [...currentReactions];
            
            if (type === 'add') {
              if (!nextReactions.some(r => r.id === reaction.id)) {
                nextReactions.push(reaction);
              }
            } else {
              nextReactions = nextReactions.filter(r => r.id !== reaction.id);
            }
            return { ...m, reactions: nextReactions };
          });
        };

        if (eventType === 'INSERT') {
          setMessages(prev => updateMessageReactions(prev, newRecord.message_id, newRecord, 'add'));
          setThreadReplies(prev => updateMessageReactions(prev, newRecord.message_id, newRecord, 'add'));
          if (threadParentIdRef.current === newRecord.message_id) {
            setThreadParentState(prev => prev ? { ...prev, reactions: [...(prev.reactions || []), newRecord as Reaction] } : null);
          }
        } else if (eventType === 'DELETE') {
          // oldRecord contains only the keys (id, message_id)
          setMessages(prev => updateMessageReactions(prev, oldRecord.message_id || '', oldRecord, 'remove'));
          setThreadReplies(prev => updateMessageReactions(prev, oldRecord.message_id || '', oldRecord, 'remove'));
          if (threadParentIdRef.current === oldRecord.message_id) {
            setThreadParentState(prev => prev ? { ...prev, reactions: (prev.reactions || []).filter(r => r.id !== oldRecord.id) } : null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setMembers(prev => {
            if (prev.some(m => m.id === newRecord.id)) return prev;
            return [...prev, newRecord as ConversationMember];
          });
        } else if (eventType === 'DELETE') {
          setMembers(prev => prev.filter(m => m.id !== oldRecord.id));
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
  }, [user]);

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
    if (!user || !activeConversationId) throw new Error('Cannot send message');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversationId,
        sender_id: user.id,
        content,
        parent_id: parentId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const editMessage = async (messageId: string, content: string): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .update({ content, is_edited: true })
      .eq('id', messageId);

    if (error) throw error;
  };

  const deleteMessage = async (messageId: string): Promise<void> => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) throw error;
  };

  const toggleReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!user) return;

    // Check if reaction already exists
    const { data: existing, error: fetchErr } = await supabase
      .from('reactions')
      .select('*')
      .eq('message_id', messageId)
      .eq('profile_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existing) {
      // Remove it
      const { error: deleteErr } = await supabase
        .from('reactions')
        .delete()
        .eq('id', existing.id);
      if (deleteErr) throw deleteErr;
    } else {
      // Add it
      const { error: insertErr } = await supabase
        .from('reactions')
        .insert({
          message_id: messageId,
          profile_id: user.id,
          emoji
        });
      if (insertErr) throw insertErr;
    }
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
        removeConversationMember
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
