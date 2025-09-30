-- OAuth Server Metadata schema
-- Run manually in Supabase SQL editor
-- This table stores OAuth server metadata (discovery information, etc.)

create table if not exists oauth_server_metadata (
  id uuid primary key default gen_random_uuid(),
  server_id text not null unique,
  metadata jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index on server_id for fast lookups
create index if not exists idx_oauth_server_metadata_server_id on oauth_server_metadata(server_id);

-- Enable RLS
alter table oauth_server_metadata enable row level security;

-- Policy for service role access
create policy "service role only" on oauth_server_metadata
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Add comment for documentation
comment on table oauth_server_metadata is 'Stores OAuth server metadata and discovery information for MCP servers';
comment on column oauth_server_metadata.server_id is 'Unique identifier for the MCP server';
comment on column oauth_server_metadata.metadata is 'JSON object containing OAuth server metadata (endpoints, supported features, etc.)';