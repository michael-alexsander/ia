-- Migration 005: Tabelas do backoffice admin MelhorAgencia.ai
-- Criadas para suportar: onboarding auto-detectado, health scores e NPS

-- ─── Etapas de onboarding (auto-detectadas) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces ON DELETE CASCADE,
  stage         int NOT NULL CHECK (stage BETWEEN 1 AND 5),
  completed_at  timestamptz DEFAULT now(),
  UNIQUE(workspace_id, stage)
);

-- Índice para queries por workspace
CREATE INDEX IF NOT EXISTS idx_onboarding_events_workspace
  ON onboarding_events (workspace_id);

-- ─── Health scores calculados diariamente ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces ON DELETE CASCADE,
  score         int NOT NULL,
  breakdown     jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

-- Índice para buscar último score de cada workspace
CREATE INDEX IF NOT EXISTS idx_health_scores_workspace_date
  ON health_scores (workspace_id, calculated_at DESC);

-- ─── NPS responses ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces ON DELETE CASCADE,
  score         int CHECK (score BETWEEN 0 AND 10),
  comment       text,
  sent_at       timestamptz DEFAULT now(),
  answered_at   timestamptz
);

-- Índice para queries de NPS por workspace e data
CREATE INDEX IF NOT EXISTS idx_nps_responses_workspace
  ON nps_responses (workspace_id, answered_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Estas tabelas são usadas APENAS pelo admin backoffice via service_role_key.
-- RLS ativado mas sem policies públicas — acesso somente via service_role (bypassa RLS).

ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
