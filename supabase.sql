create table if not exists public.applications (
  application_id text primary key,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  rejection_reason text,
  review_channel_id text,
  review_message_id text,
  real_name text not null,
  age int not null,
  discord_username text not null,
  discord_id text not null,
  character_name text not null,
  character_age text not null,
  rp_experience text not null,
  why_turbo text not null,
  rdm text not null,
  vdm text not null,
  metagaming text not null,
  powergaming text not null,
  scenario_1 text not null,
  scenario_2 text not null,
  extra text,
  source text
);

alter table public.applications add column if not exists decided_at timestamptz;
alter table public.applications add column if not exists decided_by text;
alter table public.applications add column if not exists rejection_reason text;
alter table public.applications add column if not exists review_channel_id text;
alter table public.applications add column if not exists review_message_id text;

create index if not exists applications_discord_id_idx on public.applications(discord_id);
create index if not exists applications_created_at_idx on public.applications(created_at desc);

-- Pending أو Accepted واحد فقط لنفس Discord ID.
create unique index if not exists applications_one_active_per_discord
on public.applications(discord_id)
where status in ('pending','accepted');
