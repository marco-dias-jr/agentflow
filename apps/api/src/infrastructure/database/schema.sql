create table if not exists agents (
  id uuid primary key,
  name varchar(120) not null,
  description text not null default '',
  system_prompt text not null,
  model varchar(120) not null,
  enabled_tools jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists executions (
  id uuid primary key,
  agent_id uuid not null references agents(id) on delete cascade,
  provider varchar(60) not null,
  model varchar(120) not null,
  prompt text not null,
  status varchar(30) not null check (status in ('running', 'completed', 'failed')),
  response text,
  trace jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_executions_agent_id_created_at
  on executions (agent_id, created_at desc);
