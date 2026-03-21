-- Migration 003: código de vinculação do grupo ao WhatsApp
ALTER TABLE groups ADD COLUMN IF NOT EXISTS link_code TEXT UNIQUE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;
