create extension if not exists "uuid-ossp";
create extension if not exists vector;

create table if not exists app_user (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  name text,
  mfa_enabled boolean not null default false,
  mfa_secret text,
  created_at timestamptz not null default now()
);

create table if not exists project (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists audio_file (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  project_id uuid not null references project(id) on delete cascade,
  storage_key text not null,
  original_filename text not null,
  mime_type text,
  duration_ms int,
  status text not null check (status in ('uploaded','queued','processing','done','failed')) default 'uploaded',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists transcript (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  audio_file_id uuid not null references audio_file(id) on delete cascade,
  language text not null default 'ja',
  full_text text,
  provider text,
  provider_model text,
  raw_provider_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists speaker_profile (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  display_name text not null,
  embedding_centroid vector(192),
  embedding_count int not null default 0,
  auto_label_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, display_name)
);

create table if not exists transcript_segment (
  id uuid primary key default uuid_generate_v4(),
  transcript_id uuid not null references transcript(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  start_ms int not null,
  end_ms int not null,
  speaker_temp_id text not null,
  speaker_profile_id uuid references speaker_profile(id) on delete set null,
  text text not null,
  confidence real,
  diar_confidence real,
  created_at timestamptz not null default now()
);

create table if not exists segment_embedding (
  id uuid primary key default uuid_generate_v4(),
  segment_id uuid unique not null references transcript_segment(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  embedding vector(192) not null,
  created_at timestamptz not null default now()
);

create table if not exists speaker_match (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references app_user(id) on delete cascade,
  segment_id uuid not null references transcript_segment(id) on delete cascade,
  matched_profile_id uuid references speaker_profile(id) on delete set null,
  score real not null,
  decision text not null check (decision in ('auto','suggested','unknown','user_confirmed','user_rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_audio_user on audio_file(user_id, created_at desc);
create index if not exists idx_transcript_user on transcript(user_id, created_at desc);
create index if not exists idx_segment_transcript on transcript_segment(transcript_id, start_ms);
create index if not exists idx_profile_user on speaker_profile(user_id);
create index if not exists idx_segment_embedding_user on segment_embedding(user_id);
