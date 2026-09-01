create table if not exists public.applications (
  application_id text primary key,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
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

create index if not exists applications_discord_id_idx on public.applications(discord_id);
create index if not exists applications_created_at_idx on public.applications(created_at desc);
