-- ============================================================
-- MelhorAgencia.ai — Gestor de Tarefas AI
-- Migration 001: Schema inicial
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'small' CHECK (plan IN ('small', 'medium', 'large')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  celcoin_id    TEXT,
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEMBERS
-- ============================================================
CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  whatsapp        TEXT,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (workspace_id, user_id),
  UNIQUE (workspace_id, whatsapp)
);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  whatsapp_group  TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (group_id, member_id)
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         TEXT NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  assignee_id     UUID REFERENCES members(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES members(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  due_date        TIMESTAMPTZ,
  recurrence      TEXT DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_end  TIMESTAMPTZ,
  overdue_alerted BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (workspace_id, task_id)
);

-- ============================================================
-- TASK HISTORY
-- ============================================================
CREATE TABLE task_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT CONFIG
-- ============================================================
CREATE TABLE agent_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  report_daily            BOOLEAN DEFAULT TRUE,
  report_weekly           BOOLEAN DEFAULT TRUE,
  report_monthly          BOOLEAN DEFAULT TRUE,
  report_channel          TEXT DEFAULT 'whatsapp' CHECK (report_channel IN ('whatsapp', 'email', 'both')),
  report_morning_time     TIME DEFAULT '08:00',
  report_evening_time     TIME DEFAULT '18:00',
  reminder_1day           BOOLEAN DEFAULT TRUE,
  reminder_1hour          BOOLEAN DEFAULT FALSE,
  reminder_same_day       BOOLEAN DEFAULT TRUE,
  alert_overdue_next_day  BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVITES
-- ============================================================
CREATE TABLE invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email           TEXT,
  whatsapp        TEXT,
  token           TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  role            TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  accepted        BOOLEAN DEFAULT FALSE,
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATION CONTEXT
-- ============================================================
CREATE TABLE conversation_context (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  context         JSONB DEFAULT '[]',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (workspace_id, member_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_members_workspace       ON members(workspace_id);
CREATE INDEX idx_members_whatsapp        ON members(whatsapp);
CREATE INDEX idx_groups_workspace        ON groups(workspace_id);
CREATE INDEX idx_tasks_workspace         ON tasks(workspace_id);
CREATE INDEX idx_tasks_task_id           ON tasks(task_id);
CREATE INDEX idx_tasks_assignee          ON tasks(assignee_id);
CREATE INDEX idx_tasks_status            ON tasks(status);
CREATE INDEX idx_tasks_due_date          ON tasks(due_date);
CREATE INDEX idx_task_history_task       ON task_history(task_id);
CREATE INDEX idx_conversation_member     ON conversation_context(member_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

-- Políticas: membros autenticados só veem dados do próprio workspace
CREATE POLICY "workspace_isolation" ON workspaces
  FOR ALL USING (
    id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_isolation" ON members
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_isolation" ON groups
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_isolation" ON group_members
  FOR ALL USING (group_id IN (
    SELECT id FROM groups WHERE workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace_isolation" ON tasks
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_isolation" ON task_history
  FOR ALL USING (task_id IN (
    SELECT id FROM tasks WHERE workspace_id IN (
      SELECT workspace_id FROM members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workspace_isolation" ON agent_config
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_isolation" ON invites
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_isolation" ON conversation_context
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM members WHERE user_id = auth.uid()
  ));
