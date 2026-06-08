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
  region_level1 text not null,
  region_level2 text not null,
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

alter table public.chats
  add column if not exists is_public boolean not null default false,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists direct_key text;

create unique index if not exists chats_direct_key_unique
on public.chats (direct_key)
where direct_key is not null;

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
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

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.group_runs (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  meeting_place text not null,
  starts_at timestamptz not null,
  max_members integer not null default 10 check (max_members between 2 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.group_run_members (
  group_run_id uuid not null references public.group_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_run_id, user_id)
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
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.stories enable row level security;
alter table public.group_runs enable row level security;
alter table public.group_run_members enable row level security;
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

drop policy if exists "Authenticated users can read active stories" on public.stories;
create policy "Authenticated users can read active stories"
on public.stories for select
to authenticated
using (expires_at > now());

drop policy if exists "Users can create their own stories" on public.stories;
create policy "Users can create their own stories"
on public.stories for insert
to authenticated
with check (auth.uid() = author_id);

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
on public.stories for delete
to authenticated
using (auth.uid() = author_id);

drop policy if exists "Authenticated users can read group runs" on public.group_runs;
create policy "Authenticated users can read group runs"
on public.group_runs for select
to authenticated
using (true);

drop policy if exists "Users can create group runs" on public.group_runs;
create policy "Users can create group runs"
on public.group_runs for insert
to authenticated
with check (auth.uid() = host_id);

drop policy if exists "Hosts can update group runs" on public.group_runs;
create policy "Hosts can update group runs"
on public.group_runs for update
to authenticated
using (auth.uid() = host_id)
with check (auth.uid() = host_id);

drop policy if exists "Hosts can delete group runs" on public.group_runs;
create policy "Hosts can delete group runs"
on public.group_runs for delete
to authenticated
using (auth.uid() = host_id);

drop policy if exists "Authenticated users can read group run members" on public.group_run_members;
create policy "Authenticated users can read group run members"
on public.group_run_members for select
to authenticated
using (true);

drop policy if exists "Users can join group runs" on public.group_run_members;
create policy "Users can join group runs"
on public.group_run_members for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can leave group runs" on public.group_run_members;
create policy "Users can leave group runs"
on public.group_run_members for delete
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

drop policy if exists "Authenticated users can read shared runs" on public.runs;
create policy "Authenticated users can read shared runs"
on public.runs for select
to authenticated
using (visibility in ('public', 'friends') or auth.uid() = user_id);

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
drop policy if exists "Users can read available chats" on public.chats;
create policy "Users can read available chats"
on public.chats for select
to authenticated
using (
  is_public
  or created_by = auth.uid()
  or exists (
    select 1 from public.chat_members
    where chat_members.chat_id = chats.id
      and chat_members.user_id = auth.uid()
  )
);

drop policy if exists "Users can create direct chats" on public.chats;
create policy "Users can create direct chats"
on public.chats for insert
to authenticated
with check (
  auth.uid() = created_by
  and not is_public
  and direct_key is not null
);

drop policy if exists "Authenticated users can read chat members" on public.chat_members;
create policy "Authenticated users can read chat members"
on public.chat_members for select
to authenticated
using (true);

drop policy if exists "Creators can add direct chat members" on public.chat_members;
create policy "Creators can add direct chat members"
on public.chat_members for insert
to authenticated
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.chats
    where chats.id = chat_members.chat_id
      and chats.created_by = auth.uid()
  )
);

drop policy if exists "Users can leave direct chats" on public.chat_members;
create policy "Users can leave direct chats"
on public.chat_members for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read public chat messages" on public.messages;
drop policy if exists "Users can read available chat messages" on public.messages;
create policy "Users can read available chat messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1 from public.chats
    where chats.id = messages.chat_id
      and (
        chats.is_public
        or exists (
          select 1 from public.chat_members
          where chat_members.chat_id = chats.id
            and chat_members.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can send public chat messages" on public.messages;
drop policy if exists "Users can send available chat messages" on public.messages;
create policy "Users can send available chat messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.chats
    where chats.id = messages.chat_id
      and (
        chats.is_public
        or exists (
          select 1 from public.chat_members
          where chat_members.chat_id = chats.id
            and chat_members.user_id = auth.uid()
        )
      )
  )
);

-- Instagram-style social graph, privacy, crews, and controlled live location.
alter table public.users
  add column if not exists is_private boolean not null default false;

alter table public.users
  add column if not exists experience_points integer not null default 0,
  add column if not exists level integer not null default 1,
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_run_date date;

alter table public.runs
  add column if not exists route_image_url text,
  add column if not exists xp_earned integer not null default 0,
  add column if not exists streak_day integer not null default 0;

create or replace function public.level_for_experience(total_xp integer)
returns integer
language sql
immutable
as $$
  select least(
    100,
    coalesce(
      max(candidate_level),
      1
    )
  )
  from generate_series(1, 100) as candidate_level
  where total_xp >= (
    (candidate_level - 1)
    * (400 + (candidate_level - 2) * 50)
    / 2
  );
$$;

create or replace function public.award_run_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  runner public.users%rowtype;
  run_date date;
  next_streak integer;
  base_xp integer;
  bonus_xp integer;
  awarded_xp integer;
  next_xp integer;
begin
  select *
  into runner
  from public.users
  where id = new.user_id
  for update;

  run_date := timezone('Asia/Seoul', new.started_at)::date;

  if runner.last_run_date = run_date then
    next_streak := greatest(runner.current_streak, 1);
  elsif runner.last_run_date = run_date - 1 then
    next_streak := runner.current_streak + 1;
  else
    next_streak := 1;
  end if;

  base_xp := floor(greatest(new.distance_m, 0) / 100.0);
  bonus_xp := floor(
    base_xp
    * greatest(least(next_streak, 10) - 1, 0)
    * 0.05
  );
  awarded_xp := base_xp + bonus_xp;
  next_xp := runner.experience_points + awarded_xp;

  new.xp_earned := awarded_xp;
  new.streak_day := next_streak;

  update public.users
  set total_distance_m = total_distance_m + greatest(new.distance_m, 0),
      experience_points = next_xp,
      level = public.level_for_experience(next_xp),
      current_streak = next_streak,
      longest_streak = greatest(longest_streak, next_streak),
      last_run_date = run_date
  where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists award_experience_before_run on public.runs;
create trigger award_experience_before_run
before insert on public.runs
for each row execute function public.award_run_experience();

alter table public.crews
  add column if not exists image_url text;

alter table public.group_runs
  add column if not exists crew_id uuid references public.crews(id) on delete set null;

alter table public.live_locations
  add column if not exists visibility_scope text not null default 'followers',
  add column if not exists selected_user_ids uuid[] not null default '{}',
  add column if not exists crew_ids uuid[] not null default '{}';

do $$ begin
  alter table public.live_locations
    add constraint live_locations_visibility_scope
    check (visibility_scope in ('everyone', 'followers', 'crew', 'selected'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create or replace function public.is_accepted_follower(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer = owner or exists (
    select 1
    from public.follows
    where follower_id = viewer
      and following_id = owner
      and status = 'accepted'
  );
$$;

create or replace function public.share_crew(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members mine
    join public.crew_members theirs on theirs.crew_id = mine.crew_id
    where mine.user_id = viewer
      and theirs.user_id = owner
  );
$$;

drop policy if exists "Users can read their follow relationships" on public.follows;
create policy "Users can read their follow relationships"
on public.follows for select
to authenticated
using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "Users can request follows" on public.follows;
create policy "Users can request follows"
on public.follows for insert
to authenticated
with check (
  auth.uid() = follower_id
  and (
    status = 'pending'
    or (
      status = 'accepted'
      and exists (
        select 1 from public.users
        where users.id = following_id and not users.is_private
      )
    )
  )
);

-- One primary crew per runner, persistent contribution history, and temporary guest runners.
alter table public.crews
  add column if not exists experience_points integer not null default 0;

alter table public.runs
  add column if not exists crew_id uuid references public.crews(id) on delete set null;

create table if not exists public.crew_contributions (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  contribution_xp integer not null default 0,
  active boolean not null default true
);

create unique index if not exists crew_contributions_one_active_stint
on public.crew_contributions (crew_id, user_id)
where active;

create table if not exists public.crew_guest_passes (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  group_run_id uuid references public.group_runs(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'accepted'
    check (status in ('accepted', 'cancelled', 'expired')),
  contribution_xp integer not null default 0,
  created_at timestamptz not null default now(),
  unique (group_run_id, user_id)
);

create table if not exists public.crew_xp_events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  xp integer not null check (xp >= 0),
  source text not null check (source in ('member', 'guest')),
  earned_at timestamptz not null,
  unique (run_id)
);

create table if not exists public.crew_monthly_benefits (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  season_month date not null,
  rank integer not null check (rank between 1 and 3),
  season_xp integer not null default 0,
  benefit_code text not null,
  valid_from date not null,
  valid_until date not null,
  created_at timestamptz not null default now(),
  unique (crew_id, season_month)
);

alter table public.crew_contributions enable row level security;
alter table public.crew_guest_passes enable row level security;
alter table public.crew_xp_events enable row level security;
alter table public.crew_monthly_benefits enable row level security;

insert into public.crew_contributions (
  crew_id,
  user_id,
  joined_at,
  contribution_xp,
  active
)
select
  crew_members.crew_id,
  crew_members.user_id,
  crew_members.joined_at,
  0,
  true
from public.crew_members
where not exists (
  select 1
  from public.crew_contributions
  where crew_contributions.crew_id = crew_members.crew_id
    and crew_contributions.user_id = crew_members.user_id
    and crew_contributions.active
);

create or replace function public.limit_user_crews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.crew_members
    where crew_id = new.crew_id
  ) >= 50 then
    raise exception 'A crew can have up to fifty primary members';
  end if;

  if exists (
    select 1
    from public.crew_members
    where user_id = new.user_id
      and crew_id <> new.crew_id
  ) then
    raise exception 'A runner can belong to only one primary crew';
  end if;
  return new;
end;
$$;

create or replace function public.validate_crew_guest_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  maximum_end timestamptz;
begin
  maximum_end := (
    date_trunc('day', timezone('Asia/Seoul', new.starts_at))
    + interval '3 days'
  ) at time zone 'Asia/Seoul';

  if new.ends_at <= new.starts_at then
    raise exception 'Guest access must end after it starts';
  end if;

  if new.ends_at > maximum_end then
    raise exception 'Guest access can last through at most three calendar days';
  end if;

  if new.status = 'accepted'
    and (
      select count(*)
      from public.crew_guest_passes
      where crew_id = new.crew_id
        and status = 'accepted'
        and starts_at < new.ends_at
        and ends_at > new.starts_at
        and id <> new.id
    ) >= 10
  then
    raise exception 'A crew can have up to ten active guest runners';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_crew_guest_pass_before_write
on public.crew_guest_passes;
create trigger validate_crew_guest_pass_before_write
before insert or update on public.crew_guest_passes
for each row execute function public.validate_crew_guest_pass();

create or replace function public.sync_crew_contribution_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crew_contributions (
      crew_id,
      user_id,
      joined_at,
      contribution_xp,
      active
    )
    values (new.crew_id, new.user_id, new.joined_at, 0, true)
    on conflict do nothing;
    return new;
  end if;

  update public.crew_contributions
  set active = false,
      left_at = now()
  where crew_id = old.crew_id
    and user_id = old.user_id
    and active;
  return old;
end;
$$;

drop trigger if exists sync_crew_contribution_after_membership on public.crew_members;
create trigger sync_crew_contribution_after_membership
after insert or delete on public.crew_members
for each row execute function public.sync_crew_contribution_history();

create or replace function public.sync_group_run_guest_pass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_crew_id uuid;
  target_starts_at timestamptz;
begin
  if tg_op = 'INSERT' then
    select crew_id, starts_at
    into target_crew_id, target_starts_at
    from public.group_runs
    where id = new.group_run_id;

    if target_crew_id is not null
      and not exists (
        select 1
        from public.crew_members
        where crew_id = target_crew_id
          and user_id = new.user_id
      )
    then
      insert into public.crew_guest_passes (
        crew_id,
        user_id,
        group_run_id,
        starts_at,
        ends_at,
        status
      )
      values (
        target_crew_id,
        new.user_id,
        new.group_run_id,
        now(),
        greatest(target_starts_at + interval '12 hours', now() + interval '24 hours'),
        'accepted'
      )
      on conflict (group_run_id, user_id)
      do update set
        starts_at = now(),
        ends_at = greatest(excluded.ends_at, now() + interval '24 hours'),
        status = 'accepted';
    end if;
    return new;
  end if;

  update public.crew_guest_passes
  set status = 'cancelled',
      ends_at = least(ends_at, now())
  where group_run_id = old.group_run_id
    and user_id = old.user_id
    and status = 'accepted';
  return old;
end;
$$;

drop trigger if exists sync_guest_pass_after_group_run_membership on public.group_run_members;
create trigger sync_guest_pass_after_group_run_membership
after insert or delete on public.group_run_members
for each row execute function public.sync_group_run_guest_pass();

create or replace function public.sync_guest_chat_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_chat_id uuid;
begin
  select id into target_chat_id
  from public.chats
  where crew_id = coalesce(new.crew_id, old.crew_id);

  if target_chat_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.status = 'accepted' and new.ends_at > now())
  then
    insert into public.chat_members (chat_id, user_id)
    values (target_chat_id, new.user_id)
    on conflict (chat_id, user_id) do nothing;
    return new;
  end if;

  if not exists (
    select 1
    from public.crew_members
    where crew_id = old.crew_id
      and user_id = old.user_id
  )
  and not exists (
    select 1
    from public.crew_guest_passes
    where crew_id = old.crew_id
      and user_id = old.user_id
      and status = 'accepted'
      and starts_at <= now()
      and ends_at > now()
      and id <> old.id
  )
  then
    delete from public.chat_members
    where chat_id = target_chat_id
      and user_id = old.user_id;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_guest_chat_after_pass on public.crew_guest_passes;
create trigger sync_guest_chat_after_pass
after insert or update or delete on public.crew_guest_passes
for each row execute function public.sync_guest_chat_access();

create or replace function public.award_run_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  runner public.users%rowtype;
  run_date date;
  next_streak integer;
  base_xp integer;
  bonus_xp integer;
  awarded_xp integer;
  next_xp integer;
  contributes_as_member boolean := false;
  contributes_as_guest boolean := false;
begin
  select *
  into runner
  from public.users
  where id = new.user_id
  for update;

  run_date := timezone('Asia/Seoul', new.started_at)::date;

  if runner.last_run_date = run_date then
    next_streak := greatest(runner.current_streak, 1);
  elsif runner.last_run_date = run_date - 1 then
    next_streak := runner.current_streak + 1;
  else
    next_streak := 1;
  end if;

  base_xp := floor(greatest(new.distance_m, 0) / 100.0);
  bonus_xp := floor(
    base_xp
    * greatest(least(next_streak, 10) - 1, 0)
    * 0.05
  );
  awarded_xp := base_xp + bonus_xp;
  next_xp := runner.experience_points + awarded_xp;

  new.xp_earned := awarded_xp;
  new.streak_day := next_streak;

  update public.users
  set total_distance_m = total_distance_m + greatest(new.distance_m, 0),
      experience_points = next_xp,
      level = public.level_for_experience(next_xp),
      current_streak = next_streak,
      longest_streak = greatest(longest_streak, next_streak),
      last_run_date = run_date
  where id = new.user_id;

  if new.crew_id is not null then
    select exists (
      select 1
      from public.crew_members
      where crew_id = new.crew_id
        and user_id = new.user_id
        and joined_at <= new.started_at
    )
    into contributes_as_member;

    select exists (
      select 1
      from public.crew_guest_passes
      where crew_id = new.crew_id
        and user_id = new.user_id
        and status = 'accepted'
        and starts_at <= new.started_at
        and ends_at >= new.started_at
    )
    into contributes_as_guest;

    if contributes_as_member then
      update public.crew_contributions
      set contribution_xp = contribution_xp + awarded_xp
      where crew_id = new.crew_id
        and user_id = new.user_id
        and active;
    elsif contributes_as_guest then
      update public.crew_guest_passes
      set contribution_xp = contribution_xp + awarded_xp
      where id = (
        select id
        from public.crew_guest_passes
        where crew_id = new.crew_id
          and user_id = new.user_id
          and status = 'accepted'
          and starts_at <= new.started_at
          and ends_at >= new.started_at
        order by ends_at desc
        limit 1
      );
    else
      new.crew_id := null;
    end if;

    if contributes_as_member or contributes_as_guest then
      insert into public.crew_xp_events (
        crew_id,
        user_id,
        run_id,
        xp,
        source,
        earned_at
      )
      values (
        new.crew_id,
        new.user_id,
        new.id,
        awarded_xp,
        case when contributes_as_member then 'member' else 'guest' end,
        new.started_at
      )
      on conflict (run_id) do nothing;

      update public.crews
      set experience_points = experience_points + awarded_xp
      where id = new.crew_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists award_experience_before_run on public.runs;
create trigger award_experience_before_run
before insert on public.runs
for each row execute function public.award_run_experience();

drop policy if exists "Authenticated users can read crew contributions" on public.crew_contributions;
create policy "Authenticated users can read crew contributions"
on public.crew_contributions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read crew XP events" on public.crew_xp_events;
create policy "Authenticated users can read crew XP events"
on public.crew_xp_events for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read monthly crew benefits" on public.crew_monthly_benefits;
create policy "Authenticated users can read monthly crew benefits"
on public.crew_monthly_benefits for select
to authenticated
using (true);

create or replace function public.finalize_crew_monthly_season(
  target_month date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  season_start date;
  next_month date;
begin
  season_start := coalesce(
    date_trunc('month', target_month)::date,
    (date_trunc('month', timezone('Asia/Seoul', now())) - interval '1 month')::date
  );
  next_month := (season_start + interval '1 month')::date;

  insert into public.crew_monthly_benefits (
    crew_id,
    season_month,
    rank,
    season_xp,
    benefit_code,
    valid_from,
    valid_until
  )
  select
    ranked.crew_id,
    season_start,
    ranked.rank,
    ranked.season_xp,
    case ranked.rank
      when 1 then 'gold_featured'
      when 2 then 'silver_featured'
      else 'bronze_featured'
    end,
    next_month,
    (next_month + interval '1 month - 1 day')::date
  from (
    select
      crew_id,
      sum(xp)::integer as season_xp,
      row_number() over (order by sum(xp) desc, crew_id) as rank
    from public.crew_xp_events
    where earned_at >= season_start::timestamptz
      and earned_at < next_month::timestamptz
    group by crew_id
  ) ranked
  where ranked.rank <= 3
  on conflict (crew_id, season_month) do update
  set rank = excluded.rank,
      season_xp = excluded.season_xp,
      benefit_code = excluded.benefit_code,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until;
end;
$$;

grant execute on function public.finalize_crew_monthly_season(date) to authenticated;

drop policy if exists "Users can read relevant guest passes" on public.crew_guest_passes;
create policy "Users can read relevant guest passes"
on public.crew_guest_passes for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.crews
    where crews.id = crew_guest_passes.crew_id
      and crews.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.crew_members
    where crew_members.crew_id = crew_guest_passes.crew_id
      and crew_members.user_id = auth.uid()
  )
);

drop policy if exists "Users can read available chats" on public.chats;
create policy "Users can read available chats"
on public.chats for select
to authenticated
using (
  (
    crew_id is null
    and exists (
      select 1 from public.chat_members
      where chat_members.chat_id = chats.id
        and chat_members.user_id = auth.uid()
    )
  )
  or (
    crew_id is not null
    and (
      exists (
        select 1 from public.crew_members
        where crew_members.crew_id = chats.crew_id
          and crew_members.user_id = auth.uid()
      )
      or exists (
        select 1 from public.crew_guest_passes
        where crew_guest_passes.crew_id = chats.crew_id
          and crew_guest_passes.user_id = auth.uid()
          and crew_guest_passes.status = 'accepted'
          and crew_guest_passes.starts_at <= now()
          and crew_guest_passes.ends_at > now()
      )
    )
  )
);

drop policy if exists "Users can read available chat messages" on public.messages;
create policy "Users can read available chat messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and (
        (
          chats.crew_id is null
          and exists (
            select 1 from public.chat_members
            where chat_members.chat_id = chats.id
              and chat_members.user_id = auth.uid()
          )
        )
        or exists (
          select 1 from public.crew_members
          where crew_members.crew_id = chats.crew_id
            and crew_members.user_id = auth.uid()
        )
        or exists (
          select 1 from public.crew_guest_passes
          where crew_guest_passes.crew_id = chats.crew_id
            and crew_guest_passes.user_id = auth.uid()
            and crew_guest_passes.status = 'accepted'
            and crew_guest_passes.starts_at <= now()
            and crew_guest_passes.ends_at > now()
        )
      )
  )
);

drop policy if exists "Users can send available chat messages" on public.messages;
create policy "Users can send available chat messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and (
        (
          chats.crew_id is null
          and exists (
            select 1 from public.chat_members
            where chat_members.chat_id = chats.id
              and chat_members.user_id = auth.uid()
          )
        )
        or exists (
          select 1 from public.crew_members
          where crew_members.crew_id = chats.crew_id
            and crew_members.user_id = auth.uid()
        )
        or exists (
          select 1 from public.crew_guest_passes
          where crew_guest_passes.crew_id = chats.crew_id
            and crew_guest_passes.user_id = auth.uid()
            and crew_guest_passes.status = 'accepted'
            and crew_guest_passes.starts_at <= now()
            and crew_guest_passes.ends_at > now()
        )
      )
  )
);

drop policy if exists "Private accounts can accept follows" on public.follows;
create policy "Private accounts can accept follows"
on public.follows for update
to authenticated
using (auth.uid() = following_id)
with check (auth.uid() = following_id and status = 'accepted');

drop policy if exists "Users can remove follows" on public.follows;
create policy "Users can remove follows"
on public.follows for delete
to authenticated
using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "Authenticated users can read active stories" on public.stories;
create policy "Authenticated users can read active stories"
on public.stories for select
to authenticated
using (
  expires_at > now()
  and (
    author_id = auth.uid()
    or public.is_accepted_follower(auth.uid(), author_id)
    or exists (
      select 1 from public.users
      where users.id = stories.author_id and not users.is_private
    )
  )
);

drop policy if exists "Authenticated users can read shared runs" on public.runs;
create policy "Authenticated users can read shared runs"
on public.runs for select
to authenticated
using (
  auth.uid() = user_id
  or (
    visibility = 'public'
    and exists (
      select 1 from public.users
      where users.id = runs.user_id and not users.is_private
    )
  )
  or (
    visibility = 'friends'
    and public.is_accepted_follower(auth.uid(), user_id)
  )
);

drop policy if exists "Users can read tracks for visible runs" on public.run_tracks;
create policy "Users can read tracks for visible runs"
on public.run_tracks for select
to authenticated
using (
  exists (
    select 1 from public.runs
    where runs.id = run_tracks.run_id
  )
);

drop policy if exists "Authenticated users can read posts" on public.posts;
create policy "Authenticated users can read posts"
on public.posts for select
to authenticated
using (
  author_id = auth.uid()
  or (
    visibility = 'public'
    and exists (
      select 1 from public.users
      where users.id = posts.author_id and not users.is_private
    )
  )
  or (
    visibility = 'friends'
    and public.is_accepted_follower(auth.uid(), author_id)
  )
);

drop policy if exists "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read comments"
on public.comments for select
to authenticated
using (
  exists (
    select 1 from public.posts
    where posts.id = comments.post_id
  )
);

drop policy if exists "Authenticated users can read crews" on public.crews;
create policy "Authenticated users can read crews"
on public.crews for select
to authenticated
using (
  not is_private
  or owner_id = auth.uid()
  or exists (
    select 1 from public.crew_members
    where crew_members.crew_id = crews.id
      and crew_members.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read crew members" on public.crew_members;
create policy "Authenticated users can read crew members"
on public.crew_members for select
to authenticated
using (true);

drop policy if exists "Users can join crews" on public.crew_members;
create policy "Users can join crews"
on public.crew_members for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can leave crews" on public.crew_members;
create policy "Users can leave crews"
on public.crew_members for delete
to authenticated
using (auth.uid() = user_id and role <> 'owner');

create or replace function public.limit_user_crews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.crew_members
    where user_id = new.user_id
  ) >= 5 then
    raise exception 'A user can join up to five crews';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_five_crews on public.crew_members;
create trigger enforce_five_crews
before insert on public.crew_members
for each row execute function public.limit_user_crews();

create unique index if not exists chats_crew_id_unique
on public.chats (crew_id)
where crew_id is not null;

delete from public.chats
where id = '00000000-0000-0000-0000-000000000001';

insert into public.chats (crew_id, title, created_by, is_public)
select crews.id, crews.name, crews.owner_id, false
from public.crews
where not exists (
  select 1
  from public.chats
  where chats.crew_id = crews.id
);

insert into public.chat_members (chat_id, user_id)
select chats.id, crew_members.user_id
from public.crew_members
join public.chats on chats.crew_id = crew_members.crew_id
on conflict (chat_id, user_id) do nothing;

create or replace function public.sync_crew_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_chat_id uuid;
  crew_name text;
  crew_owner_id uuid;
begin
  if tg_op = 'INSERT' then
    select id into target_chat_id
    from public.chats
    where crew_id = new.crew_id;

    if target_chat_id is null then
      select name, owner_id
      into crew_name, crew_owner_id
      from public.crews
      where id = new.crew_id;

      insert into public.chats (crew_id, title, created_by, is_public)
      values (new.crew_id, crew_name, crew_owner_id, false)
      returning id into target_chat_id;
    end if;

    insert into public.chat_members (chat_id, user_id)
    values (target_chat_id, new.user_id)
    on conflict (chat_id, user_id) do nothing;
    return new;
  end if;

  select id into target_chat_id
  from public.chats
  where crew_id = old.crew_id;

  if target_chat_id is not null then
    delete from public.chat_members
    where chat_id = target_chat_id
      and user_id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists sync_crew_chat_after_membership on public.crew_members;
create trigger sync_crew_chat_after_membership
after insert or delete on public.crew_members
for each row execute function public.sync_crew_chat_membership();

drop policy if exists "Users can read available chats" on public.chats;
create policy "Users can read available chats"
on public.chats for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.chat_members
    where chat_members.chat_id = chats.id
      and chat_members.user_id = auth.uid()
  )
);

drop policy if exists "Creators can add direct chat members" on public.chat_members;
create policy "Creators can add direct chat members"
on public.chat_members for insert
to authenticated
with check (
  exists (
    select 1 from public.chats
    where chats.id = chat_members.chat_id
      and chats.crew_id is null
      and (
        auth.uid() = chat_members.user_id
        or chats.created_by = auth.uid()
      )
  )
);

drop policy if exists "Users can leave direct chats" on public.chat_members;
create policy "Users can leave direct chats"
on public.chat_members for delete
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.chats
    where chats.id = chat_members.chat_id
      and chats.crew_id is null
  )
);

drop policy if exists "Users can join crews" on public.crew_members;
create policy "Users can join crews"
on public.crew_members for insert
to authenticated
with check (
  auth.uid() = user_id
  and role in ('owner', 'member')
  and (
    (
      role = 'owner'
      and exists (
        select 1 from public.crews
        where crews.id = crew_members.crew_id
          and crews.owner_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.crews
      where crews.id = crew_members.crew_id
        and not crews.is_private
    )
  )
);

drop policy if exists "Users can leave crews" on public.crew_members;
create policy "Users can leave crews"
on public.crew_members for delete
to authenticated
using (
  (auth.uid() = user_id and role <> 'owner')
  or exists (
    select 1 from public.crews
    where crews.id = crew_members.crew_id
      and crews.owner_id = auth.uid()
      and crew_members.user_id <> auth.uid()
  )
);

drop policy if exists "Crew owners can update member roles" on public.crew_members;
create policy "Crew owners can update member roles"
on public.crew_members for update
to authenticated
using (
  role <> 'owner'
  and exists (
    select 1 from public.crews
    where crews.id = crew_members.crew_id
      and crews.owner_id = auth.uid()
  )
)
with check (
  role in ('member', 'manager')
  and exists (
    select 1 from public.crews
    where crews.id = crew_members.crew_id
      and crews.owner_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read active shared locations" on public.live_locations;
create policy "Authenticated users can read active shared locations"
on public.live_locations for select
to authenticated
using (
  sharing_until > now()
  and (
    user_id = auth.uid()
    or visibility_scope = 'everyone'
    or (
      visibility_scope = 'followers'
      and public.is_accepted_follower(auth.uid(), user_id)
      and public.is_accepted_follower(user_id, auth.uid())
    )
    or (
      visibility_scope = 'selected'
      and auth.uid() = any(selected_user_ids)
    )
    or (
      visibility_scope = 'crew'
      and public.share_crew(auth.uid(), user_id)
      and exists (
        select 1 from public.crew_members viewer_membership
        where viewer_membership.user_id = auth.uid()
          and viewer_membership.crew_id = any(live_locations.crew_ids)
      )
    )
  )
);

do $$
begin
  alter publication supabase_realtime add table public.live_locations;
exception when duplicate_object then null;
end $$;

-- Final crew model: one primary crew, owner-approved guest runners, and request DMs.
alter table public.crews
  add column if not exists guest_recruiting boolean not null default false,
  add column if not exists guest_default_hours integer not null default 24
    check (guest_default_hours between 1 and 720);

create table if not exists public.crew_guest_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  request_chat_id uuid references public.chats(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz
);

create unique index if not exists crew_guest_requests_one_pending
on public.crew_guest_requests (crew_id, requester_id)
where status = 'pending';

alter table public.crew_guest_passes
  add column if not exists request_id uuid
    references public.crew_guest_requests(id) on delete set null;

create unique index if not exists crew_guest_passes_request_unique
on public.crew_guest_passes (request_id)
where request_id is not null;

alter table public.crew_guest_requests enable row level security;

drop trigger if exists sync_guest_pass_after_group_run_membership
on public.group_run_members;

create or replace function public.limit_user_crews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.crew_members
    where user_id = new.user_id
      and crew_id <> new.crew_id
  ) then
    raise exception 'A runner can belong to only one primary crew';
  end if;
  return new;
end;
$$;

create or replace function public.sync_crew_chat_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_chat_id uuid;
  target_crew_id uuid;
  target_user_id uuid;
  crew_name text;
  crew_owner_id uuid;
begin
  if tg_op = 'INSERT' then
    target_crew_id := new.crew_id;
    target_user_id := new.user_id;
  else
    target_crew_id := old.crew_id;
    target_user_id := old.user_id;
  end if;

  select id into target_chat_id
  from public.chats
  where crew_id = target_crew_id;

  if tg_op = 'INSERT' then
    if target_chat_id is null then
      select name, owner_id
      into crew_name, crew_owner_id
      from public.crews
      where id = target_crew_id;

      insert into public.chats (crew_id, title, created_by, is_public)
      values (target_crew_id, crew_name, crew_owner_id, false)
      returning id into target_chat_id;
    end if;

    insert into public.chat_members (chat_id, user_id)
    values (target_chat_id, target_user_id)
    on conflict (chat_id, user_id) do nothing;
    return new;
  end if;

  if target_chat_id is not null
    and not exists (
      select 1
      from public.crew_guest_passes
      where crew_id = target_crew_id
        and user_id = target_user_id
        and status = 'accepted'
        and starts_at <= now()
        and ends_at > now()
    )
  then
    delete from public.chat_members
    where chat_id = target_chat_id
      and user_id = target_user_id;
  end if;
  return old;
end;
$$;

create or replace function public.sync_guest_chat_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_chat_id uuid;
  target_crew_id uuid;
  target_user_id uuid;
  target_pass_id uuid;
begin
  if tg_op = 'DELETE' then
    target_crew_id := old.crew_id;
    target_user_id := old.user_id;
    target_pass_id := old.id;
  else
    target_crew_id := new.crew_id;
    target_user_id := new.user_id;
    target_pass_id := new.id;
  end if;

  select id into target_chat_id
  from public.chats
  where crew_id = target_crew_id;

  if target_chat_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op <> 'DELETE'
    and new.status = 'accepted'
    and new.ends_at > now()
  then
    insert into public.chat_members (chat_id, user_id)
    values (target_chat_id, target_user_id)
    on conflict (chat_id, user_id) do nothing;
    return new;
  end if;

  if not exists (
    select 1
    from public.crew_members
    where crew_id = target_crew_id
      and user_id = target_user_id
  )
  and not exists (
    select 1
    from public.crew_guest_passes
    where crew_id = target_crew_id
      and user_id = target_user_id
      and status = 'accepted'
      and starts_at <= now()
      and ends_at > now()
      and id <> target_pass_id
  )
  then
    delete from public.chat_members
    where chat_id = target_chat_id
      and user_id = target_user_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.request_crew_guest_access(target_crew_id uuid)
returns table(request_id uuid, chat_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  crew_owner uuid;
  crew_name text;
  direct_chat_key text;
  target_chat_id uuid;
  target_request_id uuid;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  select owner_id, name
  into crew_owner, crew_name
  from public.crews
  where id = target_crew_id
    and guest_recruiting;

  if crew_owner is null then
    raise exception 'Guest runner recruitment is closed';
  end if;

  if requester = crew_owner
    or exists (
      select 1 from public.crew_members
      where crew_id = target_crew_id and user_id = requester
    )
  then
    raise exception 'Crew members cannot request guest access';
  end if;

  select id into target_request_id
  from public.crew_guest_requests
  where crew_id = target_crew_id
    and requester_id = requester
    and status = 'pending';

  direct_chat_key := case
    when requester::text < crew_owner::text
      then requester::text || ':' || crew_owner::text
    else crew_owner::text || ':' || requester::text
  end;

  select id into target_chat_id
  from public.chats
  where direct_key = direct_chat_key;

  if target_chat_id is null then
    insert into public.chats (created_by, direct_key, is_public, title)
    values (requester, direct_chat_key, false, null)
    returning id into target_chat_id;
  end if;

  insert into public.chat_members (chat_id, user_id)
  values
    (target_chat_id, requester),
    (target_chat_id, crew_owner)
  on conflict (chat_id, user_id) do nothing;

  if target_request_id is null then
    insert into public.crew_guest_requests (
      crew_id,
      requester_id,
      request_chat_id
    )
    values (target_crew_id, requester, target_chat_id)
    returning id into target_request_id;

    insert into public.messages (chat_id, sender_id, body)
    values (
      target_chat_id,
      requester,
      '[게스트 러너 참가 요청] ' || crew_name || ' 크루에 함께 달리기를 요청했습니다.'
    );
  end if;

  return query select target_request_id, target_chat_id;
end;
$$;

create or replace function public.decide_crew_guest_request(
  target_request_id uuid,
  decision text,
  access_starts_at timestamptz default null,
  access_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewer uuid := auth.uid();
  target_request public.crew_guest_requests%rowtype;
  crew_name text;
  target_pass_id uuid;
begin
  select *
  into target_request
  from public.crew_guest_requests
  where id = target_request_id
    and status = 'pending'
  for update;

  if target_request.id is null then
    raise exception 'Pending request not found';
  end if;

  if not exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = reviewer
    where crews.id = target_request.crew_id
      and (
        crews.owner_id = reviewer
        or crew_members.role = 'manager'
      )
  ) then
    raise exception 'Only the crew owner or manager can decide';
  end if;

  if decision not in ('accepted', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  if decision = 'accepted' then
    if access_starts_at is null or access_ends_at is null
      or access_ends_at <= access_starts_at
      or date_trunc('hour', access_ends_at) <> access_ends_at
    then
      raise exception 'Access time must use exact one-hour boundaries';
    end if;

    insert into public.crew_guest_passes (
      crew_id,
      user_id,
      request_id,
      starts_at,
      ends_at,
      status
    )
    values (
      target_request.crew_id,
      target_request.requester_id,
      target_request.id,
      access_starts_at,
      access_ends_at,
      'accepted'
    )
    on conflict (request_id) do update
    set starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = 'accepted'
    returning id into target_pass_id;
  end if;

  update public.crew_guest_requests
  set status = decision,
      decided_at = now(),
      reviewed_by = reviewer,
      starts_at = access_starts_at,
      ends_at = access_ends_at
  where id = target_request.id;

  select name into crew_name
  from public.crews
  where id = target_request.crew_id;

  insert into public.messages (chat_id, sender_id, body)
  values (
    target_request.request_chat_id,
    reviewer,
    case
      when decision = 'accepted' then
        '[참가 요청 수락] ' || crew_name || ' 게스트 러너 활동 시간이 설정되었습니다: '
        || to_char(access_starts_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:00')
        || ' ~ '
        || to_char(access_ends_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:00')
      else '[참가 요청 거절] ' || crew_name || ' 게스트 러너 요청이 거절되었습니다.'
    end
  );

  return target_pass_id;
end;
$$;

create or replace function public.manage_crew_guest_pass(
  target_pass_id uuid,
  action text,
  access_starts_at timestamptz default null,
  access_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  manager uuid := auth.uid();
  target_pass public.crew_guest_passes%rowtype;
  request_chat uuid;
  crew_name text;
begin
  select *
  into target_pass
  from public.crew_guest_passes
  where id = target_pass_id
  for update;

  if target_pass.id is null then
    raise exception 'Guest pass not found';
  end if;

  if not exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = manager
    where crews.id = target_pass.crew_id
      and (
        crews.owner_id = manager
        or crew_members.role = 'manager'
      )
  ) then
    raise exception 'Only the crew owner or manager can manage guest access';
  end if;

  if action = 'end' then
    update public.crew_guest_passes
    set status = 'cancelled',
        ends_at = now()
    where id = target_pass.id;
  elsif action = 'update' then
    if access_starts_at is null or access_ends_at is null
      or access_ends_at <= access_starts_at
      or date_trunc('hour', access_ends_at) <> access_ends_at
    then
      raise exception 'Access time must use exact one-hour boundaries';
    end if;

    update public.crew_guest_passes
    set starts_at = access_starts_at,
        ends_at = access_ends_at,
        status = 'accepted'
    where id = target_pass.id;
  else
    raise exception 'Invalid action';
  end if;

  select crew_guest_requests.request_chat_id, crews.name
  into request_chat, crew_name
  from public.crew_guest_requests
  join public.crews on crews.id = crew_guest_requests.crew_id
  where crew_guest_requests.id = target_pass.request_id;

  if request_chat is not null then
    insert into public.messages (chat_id, sender_id, body)
    values (
      request_chat,
      manager,
      case
        when action = 'end' then
          '[게스트 러너 종료] ' || crew_name || ' 게스트 러너 활동이 종료되었습니다.'
        else
          '[활동 시간 변경] '
          || to_char(access_starts_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:00')
          || ' ~ '
          || to_char(access_ends_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:00')
      end
    );
  end if;
end;
$$;

drop policy if exists "Users can read guest requests" on public.crew_guest_requests;
create policy "Users can read guest requests"
on public.crew_guest_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = auth.uid()
    where crews.id = crew_guest_requests.crew_id
      and (
        crews.owner_id = auth.uid()
        or crew_members.role = 'manager'
      )
  )
);

grant execute on function public.request_crew_guest_access(uuid) to authenticated;
grant execute on function public.decide_crew_guest_request(uuid, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.manage_crew_guest_pass(uuid, text, timestamptz, timestamptz) to authenticated;

drop policy if exists "Users can read available chats" on public.chats;
create policy "Users can read available chats"
on public.chats for select
to authenticated
using (
  (
    crew_id is null
    and exists (
      select 1 from public.chat_members
      where chat_members.chat_id = chats.id
        and chat_members.user_id = auth.uid()
    )
  )
  or (
    crew_id is not null
    and (
      exists (
        select 1 from public.crew_members
        where crew_members.crew_id = chats.crew_id
          and crew_members.user_id = auth.uid()
      )
      or exists (
        select 1 from public.crew_guest_passes
        where crew_guest_passes.crew_id = chats.crew_id
          and crew_guest_passes.user_id = auth.uid()
          and crew_guest_passes.status = 'accepted'
          and crew_guest_passes.starts_at <= now()
          and crew_guest_passes.ends_at > now()
      )
    )
  )
);

drop policy if exists "Users can read available chat messages" on public.messages;
create policy "Users can read available chat messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and (
        (
          chats.crew_id is null
          and exists (
            select 1 from public.chat_members
            where chat_members.chat_id = chats.id
              and chat_members.user_id = auth.uid()
          )
        )
        or exists (
          select 1 from public.crew_members
          where crew_members.crew_id = chats.crew_id
            and crew_members.user_id = auth.uid()
        )
        or exists (
          select 1 from public.crew_guest_passes
          where crew_guest_passes.crew_id = chats.crew_id
            and crew_guest_passes.user_id = auth.uid()
            and crew_guest_passes.status = 'accepted'
            and crew_guest_passes.starts_at <= now()
            and crew_guest_passes.ends_at > now()
        )
      )
  )
);

drop policy if exists "Users can send available chat messages" on public.messages;
create policy "Users can send available chat messages"
on public.messages for insert
to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and (
        (
          chats.crew_id is null
          and exists (
            select 1 from public.chat_members
            where chat_members.chat_id = chats.id
              and chat_members.user_id = auth.uid()
          )
        )
        or exists (
          select 1 from public.crew_members
          where crew_members.crew_id = chats.crew_id
            and crew_members.user_id = auth.uid()
        )
        or exists (
          select 1 from public.crew_guest_passes
          where crew_guest_passes.crew_id = chats.crew_id
            and crew_guest_passes.user_id = auth.uid()
            and crew_guest_passes.status = 'accepted'
            and crew_guest_passes.starts_at <= now()
            and crew_guest_passes.ends_at > now()
        )
      )
  )
);

-- Crew rejoin cooldowns and crew-level blocks.
create table if not exists public.crew_membership_cooldowns (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  left_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create table if not exists public.crew_blocks (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  blocked_by uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

alter table public.crew_membership_cooldowns enable row level security;
alter table public.crew_blocks enable row level security;

drop policy if exists "Users can read own crew cooldowns" on public.crew_membership_cooldowns;
create policy "Users can read own crew cooldowns"
on public.crew_membership_cooldowns for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = auth.uid()
    where crews.id = crew_membership_cooldowns.crew_id
      and (
        crews.owner_id = auth.uid()
        or crew_members.role = 'manager'
      )
  )
);

drop policy if exists "Crew managers can read blocks" on public.crew_blocks;
create policy "Crew managers can read blocks"
on public.crew_blocks for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = auth.uid()
    where crews.id = crew_blocks.crew_id
      and (
        crews.owner_id = auth.uid()
        or crew_members.role = 'manager'
      )
  )
);

create or replace function public.limit_user_crews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_left_at timestamptz;
begin
  if (
    select count(*)
    from public.crew_members
    where crew_id = new.crew_id
  ) >= 50 then
    raise exception 'A crew can have up to fifty primary members';
  end if;

  if exists (
    select 1
    from public.crew_members
    where user_id = new.user_id
      and crew_id <> new.crew_id
  ) then
    raise exception 'A runner can belong to only one primary crew';
  end if;

  if exists (
    select 1
    from public.crew_blocks
    where crew_id = new.crew_id
      and user_id = new.user_id
  ) then
    raise exception 'This runner is blocked from the crew';
  end if;

  select left_at
  into last_left_at
  from public.crew_membership_cooldowns
  where crew_id = new.crew_id
    and user_id = new.user_id;

  if last_left_at is not null
    and last_left_at + interval '30 days' > now()
  then
    raise exception 'A runner must wait thirty days before rejoining this crew';
  end if;

  return new;
end;
$$;

create or replace function public.sync_crew_contribution_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    delete from public.crew_membership_cooldowns
    where crew_id = new.crew_id
      and user_id = new.user_id;

    insert into public.crew_contributions (
      crew_id,
      user_id,
      joined_at,
      contribution_xp,
      active
    )
    values (new.crew_id, new.user_id, new.joined_at, 0, true)
    on conflict do nothing;
    return new;
  end if;

  delete from public.crew_contributions
  where crew_id = old.crew_id
    and user_id = old.user_id;

  insert into public.crew_membership_cooldowns (crew_id, user_id, left_at)
  values (old.crew_id, old.user_id, now())
  on conflict (crew_id, user_id) do update
  set left_at = excluded.left_at;

  return old;
end;
$$;

create or replace function public.request_crew_guest_access(target_crew_id uuid)
returns table(request_id uuid, chat_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  crew_owner uuid;
  crew_name text;
  direct_chat_key text;
  target_chat_id uuid;
  target_request_id uuid;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.crew_blocks
    where crew_id = target_crew_id
      and user_id = requester
  ) then
    raise exception 'This runner is blocked from the crew';
  end if;

  select owner_id, name
  into crew_owner, crew_name
  from public.crews
  where id = target_crew_id
    and guest_recruiting;

  if crew_owner is null then
    raise exception 'Guest runner recruitment is closed';
  end if;

  if requester = crew_owner
    or exists (
      select 1 from public.crew_members
      where crew_id = target_crew_id and user_id = requester
    )
  then
    raise exception 'Crew members cannot request guest access';
  end if;

  select id into target_request_id
  from public.crew_guest_requests
  where crew_id = target_crew_id
    and requester_id = requester
    and status = 'pending';

  direct_chat_key := case
    when requester::text < crew_owner::text
      then requester::text || ':' || crew_owner::text
    else crew_owner::text || ':' || requester::text
  end;

  select id into target_chat_id
  from public.chats
  where direct_key = direct_chat_key;

  if target_chat_id is null then
    insert into public.chats (created_by, direct_key, is_public, title)
    values (requester, direct_chat_key, false, null)
    returning id into target_chat_id;
  end if;

  insert into public.chat_members (chat_id, user_id)
  values
    (target_chat_id, requester),
    (target_chat_id, crew_owner)
  on conflict (chat_id, user_id) do nothing;

  if target_request_id is null then
    insert into public.crew_guest_requests (
      crew_id,
      requester_id,
      request_chat_id
    )
    values (target_crew_id, requester, target_chat_id)
    returning id into target_request_id;

    insert into public.messages (chat_id, sender_id, body)
    values (
      target_chat_id,
      requester,
      '[게스트 러너 참가 요청] ' || crew_name || ' 크루에 함께 달리기를 요청했습니다.'
    );
  end if;

  return query select target_request_id, target_chat_id;
end;
$$;

create or replace function public.block_crew_runner(
  target_crew_id uuid,
  target_user_id uuid,
  block_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  manager uuid := auth.uid();
  target_chat_id uuid;
begin
  if not exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = manager
    where crews.id = target_crew_id
      and (
        crews.owner_id = manager
        or crew_members.role = 'manager'
      )
  ) then
    raise exception 'Only crew managers can block a runner';
  end if;

  if exists (
    select 1 from public.crews
    where id = target_crew_id
      and owner_id = target_user_id
  ) then
    raise exception 'The crew owner cannot be blocked';
  end if;

  insert into public.crew_blocks (crew_id, user_id, blocked_by, reason)
  values (target_crew_id, target_user_id, manager, nullif(trim(block_reason), ''))
  on conflict (crew_id, user_id) do update
  set blocked_by = excluded.blocked_by,
      reason = excluded.reason,
      created_at = now();

  delete from public.crew_members
  where crew_id = target_crew_id
    and user_id = target_user_id;

  update public.crew_guest_passes
  set status = 'cancelled',
      ends_at = least(ends_at, now())
  where crew_id = target_crew_id
    and user_id = target_user_id
    and status = 'accepted';

  update public.crew_guest_requests
  set status = 'cancelled',
      decided_at = now(),
      reviewed_by = manager
  where crew_id = target_crew_id
    and requester_id = target_user_id
    and status = 'pending';

  delete from public.group_run_members
  using public.group_runs
  where group_run_members.group_run_id = group_runs.id
    and group_runs.crew_id = target_crew_id
    and group_run_members.user_id = target_user_id;

  select id into target_chat_id
  from public.chats
  where crew_id = target_crew_id;

  if target_chat_id is not null then
    delete from public.chat_members
    where chat_id = target_chat_id
      and user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.unblock_crew_runner(
  target_crew_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  manager uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.crews
    left join public.crew_members
      on crew_members.crew_id = crews.id
      and crew_members.user_id = manager
    where crews.id = target_crew_id
      and (
        crews.owner_id = manager
        or crew_members.role = 'manager'
      )
  ) then
    raise exception 'Only crew managers can unblock a runner';
  end if;

  delete from public.crew_blocks
  where crew_id = target_crew_id
    and user_id = target_user_id;
end;
$$;

create or replace function public.reject_blocked_group_run_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_crew_id uuid;
begin
  select crew_id
  into target_crew_id
  from public.group_runs
  where id = new.group_run_id;

  if target_crew_id is not null
    and exists (
      select 1
      from public.crew_blocks
      where crew_id = target_crew_id
        and user_id = new.user_id
    )
  then
    raise exception 'This runner is blocked from the crew';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_blocked_group_run_member_before_insert
on public.group_run_members;
create trigger reject_blocked_group_run_member_before_insert
before insert on public.group_run_members
for each row execute function public.reject_blocked_group_run_member();

grant execute on function public.block_crew_runner(uuid, uuid, text) to authenticated;
grant execute on function public.unblock_crew_runner(uuid, uuid) to authenticated;

create or replace function public.delete_my_account(handle_confirmation text)
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  account_id uuid := auth.uid();
  current_handle text;
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  select handle
  into current_handle
  from public.users
  where id = account_id
  for update;

  if current_handle is null then
    raise exception 'Account profile not found';
  end if;

  if lower(trim(handle_confirmation)) <> lower(current_handle) then
    raise exception 'Handle confirmation does not match';
  end if;

  delete from storage.objects
  where bucket_id in ('avatars', 'social-media')
    and (storage.foldername(name))[1] = account_id::text;

  delete from auth.users
  where id = account_id;
end;
$$;

revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to authenticated;

create or replace function public.transfer_crew_ownership(
  target_crew_id uuid,
  target_user_id uuid,
  leave_after_transfer boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.crews
    where id = target_crew_id
      and owner_id = current_owner
  ) then
    raise exception 'Only the current crew owner can transfer ownership';
  end if;

  if target_user_id = current_owner then
    raise exception 'Choose another crew member';
  end if;

  if not exists (
    select 1
    from public.crew_members
    where crew_id = target_crew_id
      and user_id = target_user_id
  ) then
    raise exception 'The new owner must be a current crew member';
  end if;

  if exists (
    select 1
    from public.crew_blocks
    where crew_id = target_crew_id
      and user_id = target_user_id
  ) then
    raise exception 'A blocked runner cannot become crew owner';
  end if;

  update public.crew_members
  set role = 'member'
  where crew_id = target_crew_id
    and user_id = current_owner;

  update public.crew_members
  set role = 'owner'
  where crew_id = target_crew_id
    and user_id = target_user_id;

  update public.crews
  set owner_id = target_user_id
  where id = target_crew_id;

  if leave_after_transfer then
    delete from public.crew_members
    where crew_id = target_crew_id
      and user_id = current_owner;
  end if;
end;
$$;

revoke all on function public.transfer_crew_ownership(uuid, uuid, boolean) from public;
grant execute on function public.transfer_crew_ownership(uuid, uuid, boolean) to authenticated;


-- RUNGETHER FINAL DEFINITIONS. Keep this section at the end of the file.
alter table public.crew_xp_events alter column user_id drop not null;
alter table public.crew_xp_events
  drop constraint if exists crew_xp_events_user_id_fkey;
alter table public.crew_xp_events
  add constraint crew_xp_events_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;
alter table public.crew_xp_events alter column run_id drop not null;
alter table public.crew_xp_events
  drop constraint if exists crew_xp_events_run_id_fkey;
alter table public.crew_xp_events
  add constraint crew_xp_events_run_id_fkey
  foreign key (run_id) references public.runs(id) on delete set null;

create or replace function public.limit_user_crews()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare last_left_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 50
  then raise exception 'A crew can have up to fifty primary members';
  end if;

  if exists (
    select 1 from public.crew_members
    where user_id = new.user_id and crew_id <> new.crew_id
  ) then raise exception 'A runner can belong to only one primary crew';
  end if;

  if exists (
    select 1 from public.crews
    where owner_id = new.user_id and id <> new.crew_id
  ) then raise exception 'A crew owner cannot join another primary crew';
  end if;

  if exists (
    select 1 from public.crew_blocks
    where crew_id = new.crew_id and user_id = new.user_id
  ) then raise exception 'This runner is blocked from the crew';
  end if;
  select left_at into last_left_at
  from public.crew_membership_cooldowns
  where crew_id = new.crew_id and user_id = new.user_id;
  if last_left_at is not null and last_left_at + interval '30 days' > now()
  then raise exception 'A runner must wait thirty days before rejoining this crew';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_user_crews_before_insert on public.crew_members;
create trigger limit_user_crews_before_insert
before insert on public.crew_members
for each row execute function public.limit_user_crews();

create or replace function public.sync_crew_contribution_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    delete from public.crew_membership_cooldowns
    where crew_id = new.crew_id and user_id = new.user_id;
    insert into public.crew_contributions (
      crew_id, user_id, joined_at, contribution_xp, active
    ) values (new.crew_id, new.user_id, new.joined_at, 0, true)
    on conflict do nothing;
    return new;
  end if;
  delete from public.crew_contributions
  where crew_id = old.crew_id and user_id = old.user_id;
  insert into public.crew_membership_cooldowns (crew_id, user_id, left_at)
  values (old.crew_id, old.user_id, now())
  on conflict (crew_id, user_id) do update set left_at = excluded.left_at;
  return old;
end;
$$;

drop trigger if exists sync_crew_contribution_after_membership on public.crew_members;
create trigger sync_crew_contribution_after_membership
after insert or delete on public.crew_members
for each row execute function public.sync_crew_contribution_history();

create or replace function public.award_run_experience()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  runner public.users%rowtype;
  run_date date;
  next_streak integer;
  base_xp integer;
  awarded_xp integer;
  next_xp integer;
  eligible_crew boolean := false;
begin
  select * into runner from public.users where id = new.user_id for update;
  run_date := timezone('Asia/Seoul', new.started_at)::date;
  if runner.last_run_date = run_date then
    next_streak := greatest(runner.current_streak, 1);
  elsif runner.last_run_date = run_date - 1 then
    next_streak := runner.current_streak + 1;
  else next_streak := 1;
  end if;
  base_xp := floor(greatest(new.distance_m, 0) / 100.0);
  awarded_xp := base_xp + floor(
    base_xp * greatest(least(next_streak, 10) - 1, 0) * 0.05
  );
  next_xp := runner.experience_points + awarded_xp;
  new.xp_earned := awarded_xp;
  new.streak_day := next_streak;
  if new.crew_id is not null then
    select exists (
      select 1 from public.crew_members
      where crew_id = new.crew_id and user_id = new.user_id
        and joined_at <= new.started_at
    ) or exists (
      select 1 from public.crew_guest_passes
      where crew_id = new.crew_id and user_id = new.user_id
        and status = 'accepted'
        and starts_at <= new.started_at and ends_at > new.started_at
    ) into eligible_crew;
    if not eligible_crew then new.crew_id := null; end if;
  end if;
  update public.users
  set total_distance_m = total_distance_m + greatest(new.distance_m, 0),
      experience_points = next_xp,
      level = public.level_for_experience(next_xp),
      current_streak = next_streak,
      longest_streak = greatest(longest_streak, next_streak),
      last_run_date = run_date
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists award_experience_before_run on public.runs;
create trigger award_experience_before_run
before insert on public.runs
for each row execute function public.award_run_experience();

create or replace function public.award_crew_run_experience()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare contribution_id uuid; guest_pass_id uuid; contribution_source text;
begin
  if new.crew_id is null then return new; end if;
  select id into contribution_id
  from public.crew_contributions
  where crew_id = new.crew_id and user_id = new.user_id and active
    and joined_at <= new.started_at
  order by joined_at desc limit 1;
  if contribution_id is not null then
    update public.crew_contributions
    set contribution_xp = contribution_xp + new.xp_earned
    where id = contribution_id;
    contribution_source := 'member';
  else
    select id into guest_pass_id
    from public.crew_guest_passes
    where crew_id = new.crew_id and user_id = new.user_id
      and status = 'accepted'
      and starts_at <= new.started_at and ends_at > new.started_at
    order by ends_at desc limit 1;
    if guest_pass_id is not null then
      update public.crew_guest_passes
      set contribution_xp = contribution_xp + new.xp_earned
      where id = guest_pass_id;
      contribution_source := 'guest';
    end if;
  end if;
  if contribution_source is not null then
    insert into public.crew_xp_events (
      crew_id, user_id, run_id, xp, source, earned_at
    ) values (
      new.crew_id, new.user_id, new.id, new.xp_earned,
      contribution_source, new.started_at
    ) on conflict (run_id) do nothing;
    update public.crews
    set experience_points = experience_points + new.xp_earned
    where id = new.crew_id;
  end if;
  return new;
end;
$$;

drop trigger if exists award_crew_experience_after_run on public.runs;
create trigger award_crew_experience_after_run
after insert on public.runs
for each row execute function public.award_crew_run_experience();

create or replace function public.request_crew_guest_access(target_crew_id uuid)
returns table(request_id uuid, chat_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  requester uuid := auth.uid();
  crew_owner uuid;
  crew_name text;
  direct_chat_key text;
  target_chat_id uuid;
  target_request_id uuid;
begin
  if requester is null then raise exception 'Authentication required'; end if;
  if exists (
    select 1 from public.crew_blocks
    where crew_id = target_crew_id and user_id = requester
  ) then raise exception 'This runner is blocked from the crew';
  end if;
  select owner_id, name into crew_owner, crew_name
  from public.crews where id = target_crew_id and guest_recruiting;
  if crew_owner is null then raise exception 'Guest runner recruitment is closed'; end if;
  if requester = crew_owner or exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id and user_id = requester
  ) then raise exception 'Crew members cannot request guest access';
  end if;
  select id into target_request_id
  from public.crew_guest_requests
  where crew_id = target_crew_id and requester_id = requester
    and status = 'pending';
  direct_chat_key := case when requester::text < crew_owner::text
    then requester::text || ':' || crew_owner::text
    else crew_owner::text || ':' || requester::text end;
  select id into target_chat_id from public.chats where direct_key = direct_chat_key;
  if target_chat_id is null then
    insert into public.chats (created_by, direct_key, is_public, title)
    values (requester, direct_chat_key, false, null)
    returning id into target_chat_id;
  end if;
  insert into public.chat_members (chat_id, user_id)
  values (target_chat_id, requester), (target_chat_id, crew_owner)
  on conflict (chat_id, user_id) do nothing;
  if target_request_id is null then
    insert into public.crew_guest_requests (crew_id, requester_id, request_chat_id)
    values (target_crew_id, requester, target_chat_id)
    returning id into target_request_id;
    insert into public.messages (chat_id, sender_id, body)
    values (
      target_chat_id, requester,
      '[게스트 러너 참가 요청] ' || crew_name || ' 크루에 함께 달리기를 요청했습니다.'
    );
  end if;
  return query select target_request_id, target_chat_id;
end;
$$;

create or replace function public.finalize_crew_monthly_season(target_month date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  season_start date;
  next_month date;
  season_start_at timestamptz;
  next_month_at timestamptz;
begin
  season_start := coalesce(
    date_trunc('month', target_month)::date,
    (date_trunc('month', timezone('Asia/Seoul', now())) - interval '1 month')::date
  );
  next_month := (season_start + interval '1 month')::date;
  season_start_at := season_start::timestamp at time zone 'Asia/Seoul';
  next_month_at := next_month::timestamp at time zone 'Asia/Seoul';
  insert into public.crew_monthly_benefits (
    crew_id, season_month, rank, season_xp, benefit_code, valid_from, valid_until
  )
  select crew_id, season_start, rank, season_xp,
    case rank when 1 then 'gold_featured'
      when 2 then 'silver_featured' else 'bronze_featured' end,
    next_month, (next_month + interval '1 month - 1 day')::date
  from (
    select crew_id, sum(xp)::integer season_xp,
      row_number() over (order by sum(xp) desc, crew_id) rank
    from public.crew_xp_events
    where earned_at >= season_start_at and earned_at < next_month_at
    group by crew_id
  ) ranked
  where rank <= 3
  on conflict (crew_id, season_month) do update
  set rank = excluded.rank, season_xp = excluded.season_xp,
      benefit_code = excluded.benefit_code,
      valid_from = excluded.valid_from, valid_until = excluded.valid_until;
end;
$$;

drop function if exists public.delete_my_account(text);

create or replace function public.delete_my_account(
  handle_confirmation text,
  crew_transfers jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public, auth, storage
as $$
declare
  account_id uuid := auth.uid();
  current_handle text;
  owned_crew record;
  transfer_value text;
  transfer_target uuid;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  select handle into current_handle
  from public.users where id = account_id for update;
  if current_handle is null then raise exception 'Account profile not found'; end if;
  if lower(trim(handle_confirmation)) <> lower(current_handle)
  then raise exception 'Handle confirmation does not match';
  end if;

  for owned_crew in
    select id
    from public.crews
    where owner_id = account_id
    for update
  loop
    transfer_value := crew_transfers ->> owned_crew.id::text;

    if transfer_value is null or transfer_value = '__delete__' then
      delete from public.crews where id = owned_crew.id;
    else
      begin
        transfer_target := transfer_value::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid crew ownership transfer target';
      end;

      if not exists (
        select 1
        from public.crew_members
        where crew_id = owned_crew.id
          and user_id = transfer_target
      ) then
        raise exception 'The new owner must be a current crew member';
      end if;

      if exists (
        select 1
        from public.crew_blocks
        where crew_id = owned_crew.id
          and user_id = transfer_target
      ) then
        raise exception 'A blocked runner cannot become crew owner';
      end if;

      update public.crew_members
      set role = 'owner'
      where crew_id = owned_crew.id
        and user_id = transfer_target;

      update public.crews
      set owner_id = transfer_target
      where id = owned_crew.id;
    end if;
  end loop;

  delete from storage.objects
  where bucket_id in ('avatars', 'social-media')
    and (storage.foldername(name))[1] = account_id::text;
  delete from auth.users where id = account_id;
end;
$$;

revoke all on function public.delete_my_account(text, jsonb) from public;
grant execute on function public.delete_my_account(text, jsonb) to authenticated;
grant execute on function public.finalize_crew_monthly_season(date) to authenticated;
grant execute on function public.request_crew_guest_access(uuid) to authenticated;

create unique index if not exists crews_one_owned_per_user
on public.crews (owner_id);

create or replace function public.prevent_multiple_crew_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));

  if exists (
    select 1
    from public.crew_members
    where user_id = new.owner_id
  ) then
    raise exception 'A runner who belongs to a crew cannot create another crew';
  end if;

  if exists (
    select 1
    from public.crews
    where owner_id = new.owner_id
      and id <> new.id
  ) then
    raise exception 'A runner can create only one crew';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_multiple_crew_creation_before_insert
on public.crews;
create trigger prevent_multiple_crew_creation_before_insert
before insert on public.crews
for each row execute function public.prevent_multiple_crew_creation();

-- Running-first mobile app settings and verified GPS completion pipeline.
alter table public.users
  add column if not exists theme_mode text not null default 'system',
  add column if not exists default_home text not null default 'running',
  add column if not exists weight_kg numeric,
  add column if not exists voice_enabled boolean not null default true,
  add column if not exists voice_mix_mode text not null default 'duck',
  add column if not exists voice_distance_interval_m integer not null default 1000,
  add column if not exists voice_time_interval_min integer not null default 0,
  add column if not exists voice_read_distance boolean not null default true,
  add column if not exists voice_read_split_pace boolean not null default true,
  add column if not exists voice_read_total_time boolean not null default true,
  add column if not exists voice_read_goal_progress boolean not null default true,
  add column if not exists voice_volume numeric not null default 1,
  add column if not exists voice_rate numeric not null default 1;

do $$ begin
  alter table public.users add constraint users_theme_mode_check
    check (theme_mode in ('system', 'light', 'dark'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_default_home_check
    check (default_home in ('running', 'feed'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_weight_kg_check
    check (weight_kg is null or weight_kg between 25 and 300);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_voice_mix_mode_check
    check (voice_mix_mode in ('duck', 'mix'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_voice_distance_interval_check
    check (voice_distance_interval_m in (500, 1000, 2000));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_voice_time_interval_check
    check (voice_time_interval_min in (0, 5, 10, 15));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_voice_volume_check
    check (voice_volume between 0 and 1);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.users add constraint users_voice_rate_check
    check (voice_rate between 0.5 and 1.5);
exception when duplicate_object then null;
end $$;

alter table public.runs
  add column if not exists goal_type text not null default 'open',
  add column if not exists goal_value numeric,
  add column if not exists moving_duration_s integer not null default 0,
  add column if not exists paused_duration_s integer not null default 0,
  add column if not exists gps_quality numeric,
  add column if not exists device_platform text,
  add column if not exists record_source text not null default 'legacy',
  add column if not exists verified boolean not null default false,
  add column if not exists route_visible boolean not null default true,
  add column if not exists completion_key uuid;

do $$ begin
  alter table public.runs add constraint runs_goal_type_check
    check (goal_type in ('open', 'distance', 'time'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.runs add constraint runs_record_source_check
    check (record_source in ('gps', 'manual', 'legacy'));
exception when duplicate_object then null;
end $$;
create unique index if not exists runs_completion_key_unique
  on public.runs (completion_key) where completion_key is not null;

alter table public.run_tracks
  add column if not exists accuracy_m numeric,
  add column if not exists heading_deg numeric,
  add column if not exists is_mocked boolean not null default false;

create table if not exists public.run_splits (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  split_index integer not null,
  distance_m numeric not null,
  duration_s integer not null,
  pace_s integer,
  created_at timestamptz not null default now(),
  unique (run_id, split_index)
);

create table if not exists public.run_share_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  aspect_ratio text not null default '4:5',
  background_type text not null default 'map',
  background_url text,
  layers jsonb not null default '[]'::jsonb,
  rendered_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.run_share_projects add constraint run_share_aspect_ratio_check
    check (aspect_ratio in ('9:16', '4:5', '1:1'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.run_share_projects add constraint run_share_background_type_check
    check (background_type in ('camera', 'gallery', 'map', 'solid'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.run_share_projects add constraint run_share_status_check
    check (status in ('draft', 'completed'));
exception when duplicate_object then null;
end $$;

alter table public.run_splits enable row level security;
alter table public.run_share_projects enable row level security;

drop policy if exists "Run splits follow run visibility" on public.run_splits;
create policy "Run splits follow run visibility"
on public.run_splits for select
using (
  exists (
    select 1 from public.runs
    where runs.id = run_splits.run_id
      and (
        runs.user_id = auth.uid()
        or runs.visibility = 'public'
        or (
          runs.visibility = 'friends'
          and exists (
            select 1 from public.follows
            where follows.follower_id = auth.uid()
              and follows.following_id = runs.user_id
              and follows.status = 'accepted'
          )
        )
      )
  )
);

drop policy if exists "Users manage own run share projects" on public.run_share_projects;
create policy "Users manage own run share projects"
on public.run_share_projects for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.award_run_experience()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  runner public.users%rowtype;
  run_date date;
  next_streak integer;
  base_xp integer;
  awarded_xp integer;
  next_xp integer;
  eligible_crew boolean := false;
begin
  select * into runner from public.users where id = new.user_id for update;

  if not coalesce(new.verified, false) or new.record_source <> 'gps' then
    new.xp_earned := 0;
    new.streak_day := 0;
    new.crew_id := null;
    return new;
  end if;

  run_date := timezone('Asia/Seoul', new.started_at)::date;
  if runner.last_run_date = run_date then
    next_streak := greatest(runner.current_streak, 1);
  elsif runner.last_run_date = run_date - 1 then
    next_streak := runner.current_streak + 1;
  else
    next_streak := 1;
  end if;

  base_xp := floor(greatest(new.distance_m, 0) / 100.0);
  awarded_xp := base_xp + floor(
    base_xp * greatest(least(next_streak, 10) - 1, 0) * 0.05
  );
  next_xp := runner.experience_points + awarded_xp;
  new.xp_earned := awarded_xp;
  new.streak_day := next_streak;

  if new.crew_id is not null then
    select exists (
      select 1 from public.crew_members
      where crew_id = new.crew_id and user_id = new.user_id
        and joined_at <= new.started_at
    ) or exists (
      select 1 from public.crew_guest_passes
      where crew_id = new.crew_id and user_id = new.user_id
        and status = 'accepted'
        and starts_at <= new.started_at and ends_at > new.started_at
    ) into eligible_crew;
    if not eligible_crew then
      new.crew_id := null;
    end if;
  end if;

  update public.users
  set total_distance_m = total_distance_m + greatest(new.distance_m, 0),
      experience_points = next_xp,
      level = public.level_for_experience(next_xp),
      current_streak = next_streak,
      longest_streak = greatest(longest_streak, next_streak),
      last_run_date = run_date
  where id = new.user_id;
  return new;
end;
$$;

create or replace function public.award_crew_run_experience()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  contribution_id uuid;
  guest_pass_id uuid;
  contribution_source text;
begin
  if not coalesce(new.verified, false)
    or new.record_source <> 'gps'
    or new.crew_id is null
    or new.xp_earned <= 0 then
    return new;
  end if;

  select id into contribution_id
  from public.crew_contributions
  where crew_id = new.crew_id and user_id = new.user_id and active
    and joined_at <= new.started_at
  order by joined_at desc limit 1;

  if contribution_id is not null then
    update public.crew_contributions
    set contribution_xp = contribution_xp + new.xp_earned
    where id = contribution_id;
    contribution_source := 'member';
  else
    select id into guest_pass_id
    from public.crew_guest_passes
    where crew_id = new.crew_id and user_id = new.user_id
      and status = 'accepted'
      and starts_at <= new.started_at and ends_at > new.started_at
    order by ends_at desc limit 1;
    if guest_pass_id is not null then
      update public.crew_guest_passes
      set contribution_xp = contribution_xp + new.xp_earned
      where id = guest_pass_id;
      contribution_source := 'guest';
    end if;
  end if;

  if contribution_source is not null then
    insert into public.crew_xp_events (
      crew_id, user_id, run_id, xp, source, earned_at
    ) values (
      new.crew_id, new.user_id, new.id, new.xp_earned,
      contribution_source, new.started_at
    ) on conflict (run_id) do nothing;
    update public.crews
    set experience_points = experience_points + new.xp_earned
    where id = new.crew_id;
  end if;
  return new;
end;
$$;

create or replace function public.complete_gps_run(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_m numeric,
  p_duration_s integer,
  p_moving_duration_s integer,
  p_paused_duration_s integer,
  p_average_pace_s integer,
  p_title text,
  p_visibility text,
  p_crew_id uuid,
  p_goal_type text,
  p_goal_value numeric,
  p_gps_quality numeric,
  p_platform text,
  p_route_visible boolean,
  p_completion_key uuid,
  p_tracks jsonb,
  p_splits jsonb,
  p_route_image_url text default null
)
returns setof public.runs
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  completed_run public.runs%rowtype;
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  if p_completion_key is null then
    raise exception 'A completion key is required';
  end if;

  select * into completed_run
  from public.runs
  where user_id = account_id and completion_key = p_completion_key;
  if found then
    return next completed_run;
    return;
  end if;

  if p_ended_at <= p_started_at
    or p_duration_s < 1
    or p_moving_duration_s < 1
    or p_distance_m < 100
    or jsonb_typeof(p_tracks) <> 'array'
    or jsonb_array_length(p_tracks) < 2 then
    raise exception 'The GPS run is too short or incomplete';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_tracks) as point(
      latitude double precision,
      longitude double precision,
      accuracy_m numeric,
      is_mocked boolean
    )
    where point.latitude not between -90 and 90
      or point.longitude not between -180 and 180
      or coalesce(point.accuracy_m, 999) > 100
      or coalesce(point.is_mocked, false)
  ) then
    raise exception 'The GPS track contains invalid or mocked locations';
  end if;

  insert into public.runs (
    user_id, title, started_at, ended_at, distance_m, duration_s,
    moving_duration_s, paused_duration_s, average_pace_s, visibility,
    crew_id, route_image_url, goal_type, goal_value, gps_quality,
    device_platform, record_source, verified, route_visible, completion_key
  ) values (
    account_id, nullif(trim(p_title), ''), p_started_at, p_ended_at,
    round(p_distance_m), p_duration_s, p_moving_duration_s,
    greatest(p_paused_duration_s, 0), p_average_pace_s,
    coalesce(p_visibility, 'friends')::visibility, p_crew_id,
    p_route_image_url, coalesce(p_goal_type, 'open'), p_goal_value,
    p_gps_quality, p_platform, 'gps', true, coalesce(p_route_visible, true),
    p_completion_key
  )
  returning * into completed_run;

  insert into public.run_tracks (
    run_id, recorded_at, latitude, longitude, altitude_m, speed_mps,
    accuracy_m, heading_deg, is_mocked
  )
  select
    completed_run.id,
    coalesce(point.recorded_at, p_started_at),
    point.latitude,
    point.longitude,
    point.altitude_m,
    point.speed_mps,
    point.accuracy_m,
    point.heading_deg,
    coalesce(point.is_mocked, false)
  from jsonb_to_recordset(p_tracks) as point(
    recorded_at timestamptz,
    latitude double precision,
    longitude double precision,
    altitude_m numeric,
    speed_mps numeric,
    accuracy_m numeric,
    heading_deg numeric,
    is_mocked boolean
  );

  if jsonb_typeof(coalesce(p_splits, '[]'::jsonb)) = 'array' then
    insert into public.run_splits (
      run_id, split_index, distance_m, duration_s, pace_s
    )
    select
      completed_run.id,
      split.split_index,
      split.distance_m,
      split.duration_s,
      split.pace_s
    from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb)) as split(
      split_index integer,
      distance_m numeric,
      duration_s integer,
      pace_s integer
    )
    where split.split_index > 0
    on conflict (run_id, split_index) do nothing;
  end if;

  return next completed_run;
end;
$$;

revoke all on function public.complete_gps_run(
  timestamptz, timestamptz, numeric, integer, integer, integer, integer,
  text, text, uuid, text, numeric, numeric, text, boolean, uuid, jsonb,
  jsonb, text
) from public;
grant execute on function public.complete_gps_run(
  timestamptz, timestamptz, numeric, integer, integer, integer, integer,
  text, text, uuid, text, numeric, numeric, text, boolean, uuid, jsonb,
  jsonb, text
) to authenticated;

-- Temporary together-running sessions are independent from crews.
alter table public.group_runs
  add column if not exists session_code text,
  add column if not exists run_mode text not null default 'scheduled',
  add column if not exists status text not null default 'planning',
  add column if not exists synchronized_start_at timestamptz,
  add column if not exists ended_at timestamptz;

do $$ begin
  alter table public.group_runs add constraint group_runs_mode_check
    check (run_mode in ('scheduled', 'instant'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table public.group_runs add constraint group_runs_status_check
    check (status in ('planning', 'ready', 'running', 'finished', 'cancelled'));
exception when duplicate_object then null;
end $$;
create unique index if not exists group_runs_session_code_unique
  on public.group_runs (session_code) where session_code is not null;

create table if not exists public.group_run_live_locations (
  group_run_id uuid not null references public.group_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  distance_m numeric not null default 0,
  elapsed_s integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_run_id, user_id)
);

alter table public.group_run_live_locations enable row level security;

drop policy if exists "Together runners can read session locations"
on public.group_run_live_locations;
create policy "Together runners can read session locations"
on public.group_run_live_locations for select
to authenticated
using (
  exists (
    select 1 from public.group_run_members
    where group_run_members.group_run_id =
        group_run_live_locations.group_run_id
      and group_run_members.user_id = auth.uid()
  )
);

drop policy if exists "Together runners manage own session location"
on public.group_run_live_locations;
create policy "Together runners manage own session location"
on public.group_run_live_locations for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.group_run_members
    where group_run_members.group_run_id =
        group_run_live_locations.group_run_id
      and group_run_members.user_id = auth.uid()
  )
);

create or replace function public.create_together_run(
  p_title text default '지금 함께 달리기',
  p_max_members integer default 10
)
returns setof public.group_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  created_run public.group_runs%rowtype;
  generated_code text;
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  if p_max_members not between 2 and 30 then
    raise exception 'Together runs support 2 to 30 runners';
  end if;

  loop
    generated_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.group_runs where session_code = generated_code
    );
  end loop;

  insert into public.group_runs (
    host_id, title, meeting_place, starts_at, max_members,
    session_code, run_mode, status
  ) values (
    account_id,
    coalesce(nullif(trim(p_title), ''), '지금 함께 달리기'),
    '현장 합류',
    now(),
    p_max_members,
    generated_code,
    'instant',
    'ready'
  )
  returning * into created_run;

  insert into public.group_run_members (group_run_id, user_id)
  values (created_run.id, account_id)
  on conflict do nothing;

  return next created_run;
end;
$$;

create or replace function public.join_together_run(p_session_code text)
returns setof public.group_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_run public.group_runs%rowtype;
  member_count integer;
begin
  if account_id is null then
    raise exception 'Authentication required';
  end if;

  select * into target_run
  from public.group_runs
  where session_code = upper(trim(p_session_code))
    and run_mode = 'instant'
    and status = 'ready'
  for update;

  if target_run.id is null then
    raise exception 'The together-running code is invalid or closed';
  end if;

  select count(*) into member_count
  from public.group_run_members
  where group_run_id = target_run.id;

  if member_count >= target_run.max_members then
    raise exception 'The together-running session is full';
  end if;

  insert into public.group_run_members (group_run_id, user_id)
  values (target_run.id, account_id)
  on conflict do nothing;

  return next target_run;
end;
$$;

create or replace function public.start_together_run(p_group_run_id uuid)
returns setof public.group_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_run public.group_runs%rowtype;
begin
  update public.group_runs
  set status = 'running',
      synchronized_start_at = now() + interval '6 seconds'
  where id = p_group_run_id
    and host_id = account_id
    and run_mode = 'instant'
    and status = 'ready'
  returning * into target_run;

  if target_run.id is null then
    raise exception 'Only the host can start a ready together-running session';
  end if;
  return next target_run;
end;
$$;

create or replace function public.finish_together_run(p_group_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_runs
  set status = 'finished', ended_at = now()
  where id = p_group_run_id
    and host_id = auth.uid()
    and run_mode = 'instant';
end;
$$;

revoke all on function public.create_together_run(text, integer) from public;
revoke all on function public.join_together_run(text) from public;
revoke all on function public.start_together_run(uuid) from public;
revoke all on function public.finish_together_run(uuid) from public;
grant execute on function public.create_together_run(text, integer) to authenticated;
grant execute on function public.join_together_run(text) to authenticated;
grant execute on function public.start_together_run(uuid) to authenticated;
grant execute on function public.finish_together_run(uuid) to authenticated;

-- Group DM, pinned notices, and together-running recruitment cards.
alter table public.chats
  add column if not exists chat_type text not null default 'direct';

do $$ begin
  alter table public.chats add constraint chats_type_check
    check (chat_type in ('direct', 'group', 'crew'));
exception when duplicate_object then null;
end $$;

update public.chats
set chat_type = case
  when crew_id is not null then 'crew'
  when direct_key is not null then 'direct'
  else 'group'
end;

alter table public.chat_members
  add column if not exists role text not null default 'member';

do $$ begin
  alter table public.chat_members add constraint chat_members_role_check
    check (role in ('member', 'admin'));
exception when duplicate_object then null;
end $$;

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists is_pinned boolean not null default false;

do $$ begin
  alter table public.messages add constraint messages_type_check
    check (message_type in ('text', 'notice', 'run_recruitment', 'system'));
exception when duplicate_object then null;
end $$;

alter table public.group_runs
  add column if not exists course_summary text,
  add column if not exists join_policy text not null default 'first_come',
  add column if not exists recruitment_chat_id uuid
    references public.chats(id) on delete set null;

do $$ begin
  alter table public.group_runs add constraint group_runs_join_policy_check
    check (join_policy in ('first_come', 'approval'));
exception when duplicate_object then null;
end $$;

create table if not exists public.group_run_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_run_id uuid not null references public.group_runs(id) on delete cascade,
  requester_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (group_run_id, requester_id)
);

do $$ begin
  alter table public.group_run_join_requests
    add constraint group_run_join_requests_status_check
    check (status in ('pending', 'accepted', 'rejected', 'cancelled'));
exception when duplicate_object then null;
end $$;

alter table public.group_run_join_requests enable row level security;

drop policy if exists "Run applicants can read related requests"
on public.group_run_join_requests;
create policy "Run applicants can read related requests"
on public.group_run_join_requests for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1 from public.group_runs
    where group_runs.id = group_run_join_requests.group_run_id
      and group_runs.host_id = auth.uid()
  )
);

create or replace function public.enforce_group_run_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_run public.group_runs%rowtype;
  current_members integer;
begin
  select * into target_run
  from public.group_runs
  where id = new.group_run_id
  for update;

  if target_run.id is null then
    raise exception 'Together run not found';
  end if;

  if target_run.crew_id is not null and exists (
    select 1 from public.crew_blocks
    where crew_id = target_run.crew_id and user_id = new.user_id
  ) then
    raise exception 'This runner is blocked from the crew';
  end if;

  if coalesce(current_setting('rungether.invite_override', true), '') <> 'on' then
    select count(*) into current_members
    from public.group_run_members
    where group_run_id = new.group_run_id;
    if current_members >= target_run.max_members then
      raise exception 'The together run is full';
    end if;

    if target_run.join_policy = 'approval'
      and new.user_id <> target_run.host_id
      and not exists (
        select 1 from public.group_run_join_requests
        where group_run_id = new.group_run_id
          and requester_id = new.user_id
          and status = 'accepted'
      ) then
      raise exception 'This together run requires host approval';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reject_blocked_group_run_member_before_insert
on public.group_run_members;
drop trigger if exists enforce_group_run_membership_before_insert
on public.group_run_members;
create trigger enforce_group_run_membership_before_insert
before insert on public.group_run_members
for each row execute function public.enforce_group_run_membership();

create or replace function public.create_group_chat(
  p_title text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  chat_id uuid;
  member_id uuid;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'A title is required'; end if;

  insert into public.chats (title, created_by, chat_type, is_public)
  values (trim(p_title), account_id, 'group', false)
  returning id into chat_id;

  insert into public.chat_members (chat_id, user_id, role)
  values (chat_id, account_id, 'admin');

  foreach member_id in array coalesce(p_member_ids, '{}'::uuid[]) loop
    if member_id <> account_id then
      insert into public.chat_members (chat_id, user_id, role)
      values (chat_id, member_id, 'member')
      on conflict do nothing;
    end if;
  end loop;

  return chat_id;
end;
$$;

create or replace function public.send_chat_notice(
  p_chat_id uuid,
  p_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_chat public.chats%rowtype;
  created_message public.messages%rowtype;
  can_post boolean := false;
begin
  select * into target_chat from public.chats where id = p_chat_id;
  if target_chat.id is null or nullif(trim(p_body), '') is null then
    raise exception 'Chat and notice body are required';
  end if;

  if target_chat.crew_id is not null then
    select exists (
      select 1 from public.crews
      left join public.crew_members
        on crew_members.crew_id = crews.id
        and crew_members.user_id = account_id
      where crews.id = target_chat.crew_id
        and (
          crews.owner_id = account_id
          or crew_members.role = 'manager'
        )
    ) into can_post;
  else
    select exists (
      select 1 from public.chat_members
      where chat_id = p_chat_id
        and user_id = account_id
        and role = 'admin'
    ) into can_post;
  end if;

  if not can_post then raise exception 'Notice permission required'; end if;

  update public.messages
  set is_pinned = false
  where chat_id = p_chat_id and is_pinned;

  insert into public.messages (
    chat_id, sender_id, body, message_type, is_pinned
  ) values (
    p_chat_id, account_id, trim(p_body), 'notice', true
  ) returning * into created_message;
  return created_message;
end;
$$;

create or replace function public.create_chat_run_recruitment(
  p_chat_id uuid,
  p_title text,
  p_meeting_place text,
  p_course_summary text,
  p_starts_at timestamptz,
  p_max_members integer,
  p_join_policy text
)
returns setof public.group_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_chat public.chats%rowtype;
  created_run public.group_runs%rowtype;
begin
  if account_id is null then raise exception 'Authentication required'; end if;
  if p_max_members not between 2 and 100 then raise exception 'Invalid capacity'; end if;
  if p_join_policy not in ('first_come', 'approval') then
    raise exception 'Invalid join policy';
  end if;
  if p_starts_at <= now() then raise exception 'Start time must be in the future'; end if;

  select * into target_chat from public.chats where id = p_chat_id;
  if target_chat.id is null or not exists (
    select 1 from public.chat_members
    where chat_id = p_chat_id and user_id = account_id
  ) then
    raise exception 'Chat membership required';
  end if;

  insert into public.group_runs (
    host_id, title, meeting_place, starts_at, max_members, crew_id,
    course_summary, join_policy, recruitment_chat_id, run_mode, status
  ) values (
    account_id, trim(p_title), trim(p_meeting_place), p_starts_at,
    p_max_members, target_chat.crew_id, nullif(trim(p_course_summary), ''),
    p_join_policy, p_chat_id, 'scheduled', 'planning'
  ) returning * into created_run;

  insert into public.group_run_members (group_run_id, user_id)
  values (created_run.id, account_id);

  insert into public.messages (
    chat_id, sender_id, body, message_type, payload
  ) values (
    p_chat_id,
    account_id,
    created_run.title,
    'run_recruitment',
    jsonb_build_object(
      'group_run_id', created_run.id,
      'meeting_place', created_run.meeting_place,
      'course_summary', created_run.course_summary,
      'starts_at', created_run.starts_at,
      'max_members', created_run.max_members,
      'join_policy', created_run.join_policy,
      'host_id', created_run.host_id
    )
  );

  return next created_run;
end;
$$;

create or replace function public.invite_runner_to_group_run(
  p_group_run_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter uuid := auth.uid();
  target_run public.group_runs%rowtype;
  target_chat public.chats%rowtype;
  can_invite boolean := false;
begin
  if inviter is null then raise exception 'Authentication required'; end if;
  if inviter = p_target_user_id then raise exception 'Cannot invite yourself'; end if;

  select * into target_run
  from public.group_runs
  where id = p_group_run_id
    and status in ('planning', 'ready', 'running')
  for update;
  if target_run.id is null then raise exception 'Together run is closed'; end if;

  can_invite := target_run.host_id = inviter;

  if not can_invite and target_run.recruitment_chat_id is not null then
    select * into target_chat
    from public.chats
    where id = target_run.recruitment_chat_id;

    if target_chat.crew_id is not null then
      select exists (
        select 1 from public.crews
        left join public.crew_members
          on crew_members.crew_id = crews.id
          and crew_members.user_id = inviter
        where crews.id = target_chat.crew_id
          and (
            crews.owner_id = inviter
            or crew_members.role = 'manager'
          )
      ) into can_invite;
    else
      select exists (
        select 1 from public.chat_members
        where chat_id = target_chat.id
          and user_id = inviter
          and role = 'admin'
      ) into can_invite;
    end if;
  end if;

  if not can_invite then
    raise exception 'Only the host or an authorized chat manager can invite';
  end if;

  if target_run.crew_id is not null and exists (
    select 1 from public.crew_blocks
    where crew_id = target_run.crew_id
      and user_id = p_target_user_id
  ) then
    raise exception 'The runner is blocked from this crew';
  end if;

  perform set_config('rungether.invite_override', 'on', true);
  insert into public.group_run_members (group_run_id, user_id)
  values (target_run.id, p_target_user_id)
  on conflict do nothing;
  perform set_config('rungether.invite_override', 'off', true);

  if target_run.recruitment_chat_id is not null then
    insert into public.chat_members (chat_id, user_id, role)
    values (target_run.recruitment_chat_id, p_target_user_id, 'member')
    on conflict do nothing;

    insert into public.messages (
      chat_id, sender_id, body, message_type, payload
    ) values (
      target_run.recruitment_chat_id,
      inviter,
      '함께 러닝에 추가 초대했습니다.',
      'system',
      jsonb_build_object(
        'group_run_id', target_run.id,
        'invited_user_id', p_target_user_id,
        'capacity_override', true
      )
    );
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    p_target_user_id,
    'group_run_invite',
    jsonb_build_object(
      'group_run_id', target_run.id,
      'inviter_id', inviter,
      'started', target_run.status = 'running'
    )
  );
end;
$$;

create or replace function public.join_chat_run_recruitment(p_group_run_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_run public.group_runs%rowtype;
begin
  select * into target_run
  from public.group_runs
  where id = p_group_run_id and status in ('planning', 'ready')
  for update;
  if target_run.id is null then raise exception 'Recruitment is closed'; end if;

  if target_run.join_policy = 'first_come' then
    insert into public.group_run_members (group_run_id, user_id)
    values (target_run.id, account_id)
    on conflict do nothing;
    return 'joined';
  end if;

  insert into public.group_run_join_requests (
    group_run_id, requester_id, status
  ) values (
    target_run.id, account_id, 'pending'
  )
  on conflict (group_run_id, requester_id)
  do update set status = 'pending', requested_at = now(), decided_at = null;

  insert into public.messages (
    chat_id, sender_id, body, message_type, payload
  )
  select
    target_run.recruitment_chat_id,
    account_id,
    '함께 러닝 참가 승인을 요청했습니다.',
    'system',
    jsonb_build_object(
      'group_run_id', target_run.id,
      'requester_id', account_id
    )
  where target_run.recruitment_chat_id is not null;
  return 'pending';
end;
$$;

create or replace function public.decide_group_run_request(
  p_request_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid := auth.uid();
  target_request public.group_run_join_requests%rowtype;
  target_run public.group_runs%rowtype;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into target_request
  from public.group_run_join_requests
  where id = p_request_id and status = 'pending'
  for update;
  select * into target_run
  from public.group_runs
  where id = target_request.group_run_id
  for update;

  if target_run.host_id <> account_id then
    raise exception 'Only the recruitment host can decide';
  end if;

  update public.group_run_join_requests
  set status = p_decision, decided_at = now()
  where id = target_request.id;

  if p_decision = 'accepted' then
    insert into public.group_run_members (group_run_id, user_id)
    values (target_run.id, target_request.requester_id)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.create_group_chat(text, uuid[]) from public;
revoke all on function public.send_chat_notice(uuid, text) from public;
revoke all on function public.create_chat_run_recruitment(
  uuid, text, text, text, timestamptz, integer, text
) from public;
revoke all on function public.join_chat_run_recruitment(uuid) from public;
revoke all on function public.decide_group_run_request(uuid, text) from public;
revoke all on function public.invite_runner_to_group_run(uuid, uuid) from public;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
grant execute on function public.send_chat_notice(uuid, text) to authenticated;
grant execute on function public.create_chat_run_recruitment(
  uuid, text, text, text, timestamptz, integer, text
) to authenticated;
grant execute on function public.join_chat_run_recruitment(uuid) to authenticated;
grant execute on function public.decide_group_run_request(uuid, text) to authenticated;
grant execute on function public.invite_runner_to_group_run(uuid, uuid) to authenticated;

-- Crew activity region
alter table public.crews
  add column if not exists region_level1 text,
  add column if not exists region_level2 text;

create index if not exists crews_activity_region_idx
on public.crews (region_level1, region_level2);

create or replace function public.require_new_crew_activity_region()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(trim(new.region_level1), '') is null
    or nullif(trim(new.region_level2), '') is null then
    raise exception 'Crew activity region is required';
  end if;
  return new;
end;
$$;

drop trigger if exists require_new_crew_activity_region on public.crews;
create trigger require_new_crew_activity_region
before insert on public.crews
for each row execute procedure public.require_new_crew_activity_region();
