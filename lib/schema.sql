-- No Disintegrations — Tournament Platform
-- Run this entire file in the Supabase SQL Editor (supabase.com → your project → SQL Editor → New query)

-- ── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists tournaments (
  id            uuid        primary key default uuid_generate_v4(),
  name          text        not null,
  date          date        not null,
  status        text        not null default 'setup',   -- setup | active | complete
  current_round int         not null default 0,
  total_rounds  int         not null default 4,
  points_1st    int         not null default 3,
  points_2nd    int         not null default 2,
  points_3rd    int         not null default 1,
  points_4th    int         not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists players (
  id            uuid        primary key default uuid_generate_v4(),
  tournament_id uuid        not null references tournaments(id) on delete cascade,
  name          text        not null,
  color         text        not null default 'grey',    -- red | blue | yellow | green | grey
  starting_hp   int         not null default 30,
  created_at    timestamptz not null default now()
);

create table if not exists rounds (
  id            uuid        primary key default uuid_generate_v4(),
  tournament_id uuid        not null references tournaments(id) on delete cascade,
  round_number  int         not null,
  status        text        not null default 'active',  -- active | complete
  created_at    timestamptz not null default now(),
  unique(tournament_id, round_number)
);

create table if not exists pods (
  id           uuid        primary key default uuid_generate_v4(),
  round_id     uuid        not null references rounds(id) on delete cascade,
  table_number int         not null,
  status       text        not null default 'pending',  -- pending | submitted
  created_at   timestamptz not null default now()
);

create table if not exists pod_players (
  id        uuid primary key default uuid_generate_v4(),
  pod_id    uuid not null references pods(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  unique(pod_id, player_id)
);

create table if not exists results (
  id             uuid        primary key default uuid_generate_v4(),
  pod_id         uuid        not null references pods(id) on delete cascade,
  player_id      uuid        not null references players(id) on delete cascade,
  placement      int         not null,   -- 1 | 2 | 3 | 4
  final_hp       int         not null default 0,
  points_awarded int         not null default 0,
  submitted_at   timestamptz not null default now(),
  unique(pod_id, player_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_players_tournament     on players(tournament_id);
create index if not exists idx_rounds_tournament      on rounds(tournament_id);
create index if not exists idx_pods_round             on pods(round_id);
create index if not exists idx_pod_players_pod        on pod_players(pod_id);
create index if not exists idx_pod_players_player     on pod_players(player_id);
create index if not exists idx_results_pod            on results(pod_id);
create index if not exists idx_results_player         on results(player_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Disabled for MVP. Enable and configure policies before public launch.

alter table tournaments  disable row level security;
alter table players      disable row level security;
alter table rounds       disable row level security;
alter table pods         disable row level security;
alter table pod_players  disable row level security;
alter table results      disable row level security;
