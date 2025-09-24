-- MCP connections persistence schema
-- Run manually in Supabase SQL editor
create extension if not exists pgcrypto;

create table if not exists mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  server_id text not null,
  server_name text not null,
  server_url text not null,
  status text not null check (status in ('connected', 'disconnected', 'error', 'auth-required')),
  tools jsonb not null default '[]'::jsonb,
  error_message text null,
  connected_at timestamptz null,
  last_used timestamptz null,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, server_id)
);

create index if not exists idx_mcp_connections_user on mcp_connections(user_id);
create index if not exists idx_mcp_connections_user_server on mcp_connections(user_id, server_id);
create index if not exists idx_mcp_connections_status on mcp_connections(status);

-- Basic RLS (enable and allow service role access)
alter table mcp_connections enable row level security;

create policy "service role only" on mcp_connections
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');