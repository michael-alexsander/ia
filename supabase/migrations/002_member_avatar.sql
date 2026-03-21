-- Migration 002: adiciona avatar_url em members
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
