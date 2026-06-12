-- ====================================================================
-- SUPABASE SLACK CLONE SCHEMA
-- Copy and run this script in the Supabase SQL Editor (SQL Editor -> New Query)
-- ====================================================================

-- 1. Create Profiles Table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  status_text text,
  is_online boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Conversations Table (Channels & DMs)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  name text, -- Name of the channel. NULL for Direct Messages (DMs)
  description text, -- NULL for DMs
  is_dm boolean default false not null,
  is_private boolean default false not null,
  created_by uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.conversations(id) on delete cascade, -- Self-referencing FK for sub-channels
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Conversation Members Table (Who is in which Channel/DM)
create table if not exists public.conversation_members (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (conversation_id, profile_id)
);

-- 4. Create Channel Chats Table (Stores all chat history in a single JSON column)
create table if not exists public.channel_chats (
  id uuid default gen_random_uuid() primary key,
  channel_id uuid references public.conversations(id) on delete cascade not null,
  sub_channel_id uuid references public.conversations(id) on delete cascade,
  chats jsonb default '[]'::jsonb not null
);

-- Ensure uniqueness of channel_id and sub_channel_id combinations (handling nulls)
create unique index if not exists channel_chats_unique_idx on public.channel_chats (channel_id) where sub_channel_id is null;
create unique index if not exists channel_sub_chats_unique_idx on public.channel_chats (channel_id, sub_channel_id) where sub_channel_id is not null;

-- ====================================================================
-- AUTOMATED PROFILE CREATION TRIGGER
-- ====================================================================

-- Automatically create a profile entry when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_username text;
  base_username text;
  suffix int := 1;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  new_username := base_username;
  
  -- Handle username uniqueness collisions
  while exists (select 1 from public.profiles where username = new_username) loop
    new_username := base_username || suffix::text;
    suffix := suffix + 1;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url, is_online)
  values (
    new.id,
    new_username,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ====================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Prevents RLS Recursion)
-- ====================================================================

create or replace function public.is_member_of_conversation(conv_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
    and profile_id = user_id
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_admin_or_owner(conv_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
    and profile_id = user_id
    and role in ('owner', 'admin')
  );
end;
$$ language plpgsql security definer;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;

-- --- PROFILES POLICIES ---
-- Anyone can view profiles (needed for displays, avatars, and DM initiation)
drop policy if exists "Allow profile viewing for all logged in users" on public.profiles;
create policy "Allow profile viewing for all logged in users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can insert their own profiles (self-healing fallback)
drop policy if exists "Allow profile insert for owners" on public.profiles;
create policy "Allow profile insert for owners"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Users can update their own profiles
drop policy if exists "Allow profile update for owners" on public.profiles;
create policy "Allow profile update for owners"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- --- CONVERSATIONS POLICIES ---
-- Users can select conversations they are a member of, or if they are the creator
drop policy if exists "Allow conversations access for members or public channels" on public.conversations;
create policy "Allow conversations access for members or public channels"
  on public.conversations for select
  to authenticated
  using (
    created_by = auth.uid() or
    public.is_member_of_conversation(id, auth.uid())
  );

-- Users can create conversations
drop policy if exists "Allow conversations creation for all users" on public.conversations;
create policy "Allow conversations creation for all users"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = created_by);

-- --- CONVERSATION MEMBERS POLICIES ---
-- Members or conversation creators can view memberships
drop policy if exists "Allow member listing for joined conversations" on public.conversation_members;
create policy "Allow member listing for joined conversations"
  on public.conversation_members for select
  to authenticated
  using (
    public.is_member_of_conversation(conversation_id, auth.uid())
    or exists (
      select 1 from public.conversations
      where conversations.id = conversation_members.conversation_id
      and conversations.created_by = auth.uid()
    )
  );

-- Users can join if they are the creator, or be added by admin/owner
drop policy if exists "Allow membership joining" on public.conversation_members;
create policy "Allow membership joining"
  on public.conversation_members for insert
  to authenticated
  with check (
    (profile_id = auth.uid() and exists (
      select 1 from public.conversations
      where id = conversation_id
      and created_by = auth.uid()
    )) or
    public.is_admin_or_owner(conversation_id, auth.uid())
  );

-- Owners/Admins can change roles
drop policy if exists "Allow member role updates" on public.conversation_members;
create policy "Allow member role updates"
  on public.conversation_members for update
  to authenticated
  using (
    public.is_admin_or_owner(conversation_id, auth.uid())
  );

-- Users can leave or be kicked out by owners/admins
drop policy if exists "Allow membership removal" on public.conversation_members;
create policy "Allow membership removal"
  on public.conversation_members for delete
  to authenticated
  using (
    profile_id = auth.uid() or
    public.is_admin_or_owner(conversation_id, auth.uid())
  );

-- --- CONVERSATIONS DELETION POLICY ---
-- Users can delete conversations if they are the creator or a member (cascades and deletes chats)
drop policy if exists "Allow conversations deletion for members or creators" on public.conversations;
create policy "Allow conversations deletion for members or creators"
  on public.conversations for delete
  to authenticated
  using (
    created_by = auth.uid() or
    public.is_member_of_conversation(id, auth.uid())
  );

-- --- CHANNEL CHATS POLICIES ---
alter table public.channel_chats enable row level security;

-- Members of the conversation can view its chats
drop policy if exists "Allow select on channel_chats for members" on public.channel_chats;
create policy "Allow select on channel_chats for members"
  on public.channel_chats for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations
      where id = channel_id
      and (
        not is_private or
        created_by = auth.uid() or
        public.is_member_of_conversation(id, auth.uid())
      )
    )
  );

-- ====================================================================
-- REALTIME ENABLEMENT
-- ====================================================================
-- Enable realtime publication for the following tables
-- In Supabase dashboard: Database -> Replication -> Click 'supabase_realtime' publication -> Toggle tables
-- Alternatively, execute these statements (requires superuser/dashboard permission):
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.channel_chats;

-- ====================================================================
-- STORAGE BUCKETS & POLICIES SETUP
-- ====================================================================

-- 1. Create Public Storage Buckets
insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 2. Enable Storage Objects Policies (RLS is enabled by default on storage.objects)

-- --- AVATARS BUCKET POLICIES ---
-- Allow public read access to avatars
create policy "Allow public avatar reads"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
create policy "Allow owners to upload avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow owners to update/delete their own avatar
create policy "Allow owners to update avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Allow owners to delete avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --- ATTACHMENTS BUCKET POLICIES ---
-- Allow public read access to chat attachments
create policy "Allow public attachment reads"
  on storage.objects for select
  using (bucket_id = 'attachments');

-- Allow authenticated users to upload attachments
create policy "Allow authenticated attachment uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attachments'
  );

-- ====================================================================
-- PROFILE STREAKS & CUSTOMIZATION
-- ====================================================================

-- 1. Add Streak & Customization Columns to Profiles
alter table public.profiles 
  add column if not exists streak_count int default 0,
  add column if not exists total_messages_count int default 0,
  add column if not exists banner_color text default 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)',
  add column if not exists joined_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 2. Create Streak Calculator Function
create or replace function public.increment_message_stats(p_sender_id uuid)
returns void as $$
declare
  last_msg timestamp with time zone;
  current_streak int;
  days_diff int;
begin
  -- Retrieve user's last message time and current streak
  select updated_at, streak_count into last_msg, current_streak
  from public.profiles
  where id = p_sender_id;

  -- Calculate days difference between now and last message (UTC dates)
  if last_msg is null or last_msg = '-infinity'::timestamp then
    -- First message ever, set streak to 1
    update public.profiles
    set 
      streak_count = 1,
      total_messages_count = 1,
      updated_at = now()
    where id = p_sender_id;
  else
    days_diff := extract(day from (date_trunc('day', now()) - date_trunc('day', last_msg)));

    if days_diff = 0 then
      -- Same day messaging: increment count only
      update public.profiles
      set 
        total_messages_count = coalesce(total_messages_count, 0) + 1
      where id = p_sender_id;
    elsif days_diff = 1 then
      -- Consecutive day messaging: increment streak & count, update active timestamp
      update public.profiles
      set 
        streak_count = coalesce(streak_count, 0) + 1,
        total_messages_count = coalesce(total_messages_count, 0) + 1,
        updated_at = now()
      where id = p_sender_id;
    else
      -- Streak broken: reset streak to 1, increment count, update active timestamp
      update public.profiles
      set 
        streak_count = 1,
        total_messages_count = coalesce(total_messages_count, 0) + 1,
        updated_at = now()
      where id = p_sender_id;
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- ====================================================================
-- CHAT HISTORY MANIPULATION FUNCTIONS (JSON Array)
-- ====================================================================

-- 1. Send Chat Message
create or replace function public.send_chat_message(
  p_channel_id uuid,
  p_sub_channel_id uuid,
  p_message jsonb
)
returns void as $$
begin
  -- Ensure a row exists in channel_chats for this channel/sub-channel
  insert into public.channel_chats (channel_id, sub_channel_id, chats)
  values (p_channel_id, p_sub_channel_id, '[]'::jsonb)
  on conflict (channel_id) where sub_channel_id is null do nothing;

  -- (Handling unique constraint conflict for sub_channels)
  if p_sub_channel_id is not null then
    insert into public.channel_chats (channel_id, sub_channel_id, chats)
    values (p_channel_id, p_sub_channel_id, '[]'::jsonb)
    on conflict (channel_id, sub_channel_id) where sub_channel_id is not null do nothing;
  end if;

  -- Append the new message to the chats array
  update public.channel_chats
  set chats = chats || jsonb_build_array(p_message)
  where channel_id = p_channel_id
  and (
    (sub_channel_id = p_sub_channel_id) or 
    (sub_channel_id is null and p_sub_channel_id is null)
  );

  -- Trigger user message stats increment
  perform public.increment_message_stats((p_message->>'sender_id')::uuid);
end;
$$ language plpgsql security definer;

-- 2. Edit Chat Message
create or replace function public.edit_chat_message(
  p_channel_id uuid,
  p_sub_channel_id uuid,
  p_message_id uuid,
  p_content text
)
returns void as $$
begin
  update public.channel_chats
  set chats = (
    select coalesce(jsonb_agg(
      case 
        when (elem->>'id')::uuid = p_message_id then 
          elem || jsonb_build_object('content', p_content, 'is_edited', true)
        else elem
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(chats) as elem
  )
  where channel_id = p_channel_id
  and (
    (sub_channel_id = p_sub_channel_id) or 
    (sub_channel_id is null and p_sub_channel_id is null)
  );
end;
$$ language plpgsql security definer;

-- 3. Delete Chat Message
create or replace function public.delete_chat_message(
  p_channel_id uuid,
  p_sub_channel_id uuid,
  p_message_id uuid
)
returns void as $$
begin
  update public.channel_chats
  set chats = (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements(chats) as elem
    where (elem->>'id')::uuid <> p_message_id
  )
  where channel_id = p_channel_id
  and (
    (sub_channel_id = p_sub_channel_id) or 
    (sub_channel_id is null and p_sub_channel_id is null)
  );
end;
$$ language plpgsql security definer;

-- 4. Toggle Chat Reaction
create or replace function public.toggle_chat_reaction(
  p_channel_id uuid,
  p_sub_channel_id uuid,
  p_message_id uuid,
  p_profile_id uuid,
  p_emoji text
)
returns void as $$
begin
  update public.channel_chats
  set chats = (
    select coalesce(jsonb_agg(
      case 
        when (elem->>'id')::uuid = p_message_id then 
          case 
            -- Check if user already reacted with this emoji
            when coalesce(elem->'reactions', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('profile_id', p_profile_id, 'emoji', p_emoji)) then
              elem || jsonb_build_object('reactions', (
                select coalesce(jsonb_agg(r), '[]'::jsonb)
                from jsonb_array_elements(coalesce(elem->'reactions', '[]'::jsonb)) r
                where not (r @> jsonb_build_object('profile_id', p_profile_id, 'emoji', p_emoji))
              ))
            -- Otherwise, add it
            else
              elem || jsonb_build_object('reactions', coalesce(elem->'reactions', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('profile_id', p_profile_id, 'emoji', p_emoji)))
          end
        else elem
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(chats) as elem
  )
  where channel_id = p_channel_id
  and (
    (sub_channel_id = p_sub_channel_id) or 
    (sub_channel_id is null and p_sub_channel_id is null)
  );
end;
$$ language plpgsql security definer;


