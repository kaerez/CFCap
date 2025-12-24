-- =============================================
-- repo: kaerez/cfcap
-- file: schema.sql
-- =============================================

DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS tokens;

-- SQLite (D1) Schema adapted from Postgres example
CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL, -- Storing JSON as TEXT in SQLite
    expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
    key TEXT PRIMARY KEY,
    expires INTEGER NOT NULL
);
