-- =============================================
-- repo: kaerez/cfcap
-- file: schema.sql
-- =============================================

-- Challenges Table
CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER NOT NULL
);

-- Tokens Table
CREATE TABLE IF NOT EXISTS tokens (
    key TEXT PRIMARY KEY,
    expires INTEGER NOT NULL
);
