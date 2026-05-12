-- Provider OAuth credentials stored separately from settings JSON
CREATE TABLE IF NOT EXISTS provider_credentials (
    provider_slug TEXT PRIMARY KEY,
    credential_mode TEXT NOT NULL CHECK(credential_mode IN ('api_key', 'oauth_bearer')),
    api_key TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    id_token TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
