-- OAuth persistence schema (initial version)
-- Run manually in Supabase SQL editor
create extension if not exists pgcrypto;
create table if not exists oauth_clients (
  id uuid primary key default gen_random_uuid(),
  server_id text not null unique,
  client_id text not null,
  client_secret text null,
  client_metadata jsonb not null,
  created_at timestamptz default now()
);

create table if not exists oauth_pending (
  id uuid primary key default gen_random_uuid(),
  server_id text not null,
  user_id text not null,
  state text not null,
  code_verifier text not null,
  auth_url text not null,
  created_at timestamptz default now(),
  unique(server_id, user_id)
);
create index if not exists idx_oauth_pending_state on oauth_pending(state);

create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  server_id text not null,
  user_id text not null,
  access_token text not null,
  refresh_token text null,
  expires_at timestamptz null,
  scope text null,
  token_type text null,
  raw_tokens jsonb not null,
  updated_at timestamptz default now(),
  unique(server_id, user_id)
);
create index if not exists idx_oauth_tokens_user_server on oauth_tokens(user_id, server_id);

-- Basic RLS (enable and allow owner access). Adjust policies as needed.
alter table oauth_clients enable row level security;
alter table oauth_pending enable row level security;
alter table oauth_tokens enable row level security;

create policy "service role only" on oauth_clients
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role only" on oauth_pending
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role only" on oauth_tokens
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');