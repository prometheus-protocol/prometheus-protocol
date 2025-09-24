-- Conversation history schema for multi-turn chat support
-- Run manually in Supabase SQL editor
create extension if not exists pgcrypto;

create table if not exists conversation_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  channel_id text not null,
  message_type text not null check (message_type in ('user', 'assistant', 'system')),
  content text not null,
  function_calls jsonb null, -- Store function calls if any
  function_results jsonb null, -- Store function results if any
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for efficient querying
create index if not exists idx_conversation_history_user_channel on conversation_history(user_id, channel_id);
create index if not exists idx_conversation_history_created_at on conversation_history(created_at);
create index if not exists idx_conversation_history_user_channel_created on conversation_history(user_id, channel_id, created_at desc);

-- Basic RLS (enable and allow service role access)
alter table conversation_history enable row level security;

create policy "service role only" on conversation_history
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');