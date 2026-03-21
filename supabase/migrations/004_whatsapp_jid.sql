-- Migration 004: Separar número real do JID interno do WhatsApp
-- whatsapp     = número real (+5531991916906) — visível para usuários humanos
-- whatsapp_jid = JID/LID usado pela Evolution API — interno, só o agent usa

ALTER TABLE members ADD COLUMN IF NOT EXISTS whatsapp_jid TEXT;

-- Índice para lookup rápido pelo agent
CREATE INDEX IF NOT EXISTS idx_members_whatsapp_jid ON members(whatsapp_jid) WHERE whatsapp_jid IS NOT NULL;
