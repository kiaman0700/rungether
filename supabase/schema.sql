create extension if not exists "pgcrypto";

do $$ begin
  create type friend_status as enum ('pending', 'accepted', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type visibility as enum ('public', 'friends', 'private');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  total_distance_m numeric not null default 0,
  badges text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists onboarding_completed boolean not null default false;

do $$ begin
  alter table public.users
    add constraint users_handle_format
    check (handle = lower(handle) and handle ~ '^[a-z0-9._]{3,20}$');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status friend_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_m numeric not null default 0,
  duration_s integer not null default 0,
  average_pace_s integer,
  calories integer,
  visibility visibility not null default 'friends',
  created_at timestamptz not null default now()
);

create table if not exists public.run_tracks (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  altitude_m numeric,
  speed_mps numeric
);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  is_private boolean not null default false,
  meeting_place text,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  start_place text not null,
  end_place text not null,
  starts_on date,
  ends_on date,
  budget_krw integer,
  max_members integer,
  total_distance_m numeric not null default 0,
  completed_distance_m numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.journey_members (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (journey_id, user_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  body text not null,
  media_urls text[] not null default '{}',
  hashtags text[] not null default '{}',
  visibility visibility not null default 'friends',
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references public.crews(id) on delete cascade,
  journey_id uuid references public.journeys(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text,
  image_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  latitude double precision,
  longitude double precision,
  reason text not null,
  notified_guardian boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.live_locations (
  user_id uuid primary key references public.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  sharing_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.chats
  add column if not exists is_public boolean not null default false;

insert into public.chats (id, title, is_public)
values ('00000000-0000-0000-0000-000000000001', 'RUNGETHER 라운지', true)
on conflict (id) do update
set title = excluded.title,
    is_public = true;

alter table public.users enable row level security;
alter table public.friends enable row level security;
alter table public.runs enable row level security;
alter table public.run_tracks enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.journeys enable row level security;
alter table public.journey_members enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.emergency_reports enable row level security;
alter table public.live_locations enable row level security;

drop policy if exists "Public profiles are readable" on public.users;
create policy "Public profiles are readable"
on public.users for select
to authenticated
using (true);

drop policy if exists "Users can create their own profile" on public.users;
create policy "Users can create their own profile"
on public.users for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can delete their own profile" on public.users;
create policy "Users can delete their own profile"
on public.users for delete
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create friend requests" on public.friends;
create policy "Users can create friend requests"
on public.friends for insert
to authenticated
with check (auth.uid() = requester_id and requester_id <> addressee_id);

drop policy if exists "Users can read their friend connections" on public.friends;
create policy "Users can read their friend connections"
on public.friends for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can update their friend connections" on public.friends;
create policy "Users can update their friend connections"
on public.friends for update
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users can delete their friend connections" on public.friends;
create policy "Users can delete their friend connections"
on public.friends for delete
to authenticated
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Users manage their own runs" on public.runs;
create policy "Users manage their own runs"
on public.runs for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage tracks for their own runs" on public.run_tracks;
create policy "Users manage tracks for their own runs"
on public.run_tracks for all
to authenticated
using (
  exists (
    select 1 from public.runs
    where runs.id = run_tracks.run_id and runs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.runs
    where runs.id = run_tracks.run_id and runs.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts"
on public.posts for select
to authenticated
using (visibility = 'public' or author_id = auth.uid() or visibility = 'friends');

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using (auth.uid() = author_id);

drop policy if exists "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read comments"
on public.comments for select
to authenticated
using (true);

drop policy if exists "Users manage their own comments" on public.comments;
create policy "Users manage their own comments"
on public.comments for all
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Authenticated users can read likes" on public.likes;
create policy "Authenticated users can read likes"
on public.likes for select
to authenticated
using (true);

drop policy if exists "Users can add their own likes" on public.likes;
create policy "Users can add their own likes"
on public.likes for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own likes" on public.likes;
create policy "Users can remove their own likes"
on public.likes for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read crews" on public.crews;
create policy "Authenticated users can read crews"
on public.crews for select
to authenticated
using (not is_private or owner_id = auth.uid());

drop policy if exists "Owners manage their crews" on public.crews;
create policy "Owners manage their crews"
on public.crews for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Authenticated users can read journeys" on public.journeys;
create policy "Authenticated users can read journeys"
on public.journeys for select
to authenticated
using (true);

drop policy if exists "Owners manage their journeys" on public.journeys;
create policy "Owners manage their journeys"
on public.journeys for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Authenticated users can read public chats" on public.chats;
create policy "Authenticated users can read public chats"
on public.chats for select
to authenticated
using (is_public);

drop policy if exists "Authenticated users can read public chat messages" on public.messages;
create policy "Authenticated users can read public chat messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.chats
    where chats.id = messages.chat_id and chats.is_public
  )
);

drop policy if exists "Users can send public chat messages" on public.messages;
create policy "Users can send public chat messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.chats
    where chats.id = messages.chat_id and chats.is_public
  )
);

drop policy if exists "Users can delete their own messages" on public.messages;
create policy "Users can delete their own messages"
on public.messages for delete
to authenticated
using (auth.uid() = sender_id);

drop policy if exists "Users can create their own notifications" on public.notifications;
create policy "Users can create their own notifications"
on public.notifications for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their own emergency reports" on public.emergency_reports;
create policy "Users manage their own emergency reports"
on public.emergency_reports for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can read active shared locations" on public.live_locations;
create policy "Authenticated users can read active shared locations"
on public.live_locations for select
to authenticated
using (sharing_until > now());

drop policy if exists "Users manage their own live location" on public.live_locations;
create policy "Users manage their own live location"
on public.live_locations for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
