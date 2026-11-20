-- Diagnostics (scans), spray/fertilizer logbook, quality scores, farmer tasks.

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  tree_id uuid references public.field_trees (id) on delete set null,
  mode public.scan_mode not null,
  storage_path text,
  title text,
  latin_name text,
  diagnosis jsonb not null default '{}'::jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  fly_count integer check (fly_count is null or fly_count >= 0),
  spot_count integer check (spot_count is null or spot_count >= 0),
  model_version text,
  source text not null default 'demo' check (source in ('gemini', 'model', 'demo')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index scans_field_id_idx on public.scans (field_id);
create index scans_farmer_id_idx on public.scans (farmer_id);
create index scans_captured_at_idx on public.scans (captured_at desc);

create table public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  kind public.logbook_kind not null default 'spray',
  product_name text not null,
  active_substances text[] not null default '{}',
  dose text,
  licence text,
  pre_harvest_days integer check (pre_harvest_days is null or pre_harvest_days >= 0),
  protection_days integer check (protection_days is null or protection_days >= 0),
  targets text[] not null default '{}',
  eu_banned boolean not null default false,
  eu_hits text[] not null default '{}',
  applied_at timestamptz not null default now(),
  area_label text,
  label_storage_path text,
  from_label_scan boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index logbook_entries_field_id_idx on public.logbook_entries (field_id);
create index logbook_entries_farmer_id_idx on public.logbook_entries (farmer_id);
create index logbook_entries_applied_at_idx on public.logbook_entries (applied_at desc);
create index logbook_entries_eu_banned_idx on public.logbook_entries (field_id) where eu_banned;

create trigger logbook_entries_set_updated_at
before update on public.logbook_entries
for each row execute function public.set_updated_at();

create table public.quality_scores (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  breakdown jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  engine_version text not null default 'quality-0.1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index quality_scores_field_id_idx on public.quality_scores (field_id);
create index quality_scores_computed_at_idx on public.quality_scores (field_id, computed_at desc);

-- One "current" score pointer per field (latest wins via unique partial is awkward;
-- app reads order by computed_at desc limit 1).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  tree_id uuid references public.field_trees (id) on delete set null,
  title text not null,
  meta text,
  kind public.task_kind not null default 'plain',
  why text,
  urgent boolean not null default false,
  due_on date,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_farmer_open_idx on public.tasks (farmer_id, done, urgent);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create table public.risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  engine_version text not null,
  assessments jsonb not null default '{}'::jsonb,
  weather jsonb,
  assessed_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  unique (field_id, assessed_on, engine_version)
);

create index risk_snapshots_field_day_idx on public.risk_snapshots (field_id, assessed_on desc);
