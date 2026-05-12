use iron_core::provider_credential::{
    domain::{OAuthTokenSet, ProviderSlug, StoredCredential},
    store::ProviderCredentialStore,
};
use rusqlite::Connection;
use std::path::PathBuf;
use std::time::{Duration, UNIX_EPOCH};

/// SQLite-backed credential store implementing `iron_core::provider_credential::ProviderCredentialStore`.
///
/// Stores OAuth credentials in a dedicated table separate from normal settings JSON.
/// API keys may also be stored here, but the current AgentIron slice keeps API keys
/// in provider settings for backward compatibility.
pub struct SqliteCredentialStore {
    db_path: PathBuf,
}

impl SqliteCredentialStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    fn with_conn<F, T>(&self, f: F) -> T
    where
        F: FnOnce(&Connection) -> T,
    {
        let conn = Connection::open(&self.db_path).expect("Failed to open credential DB");
        f(&conn)
    }
}

#[async_trait::async_trait]
impl ProviderCredentialStore for SqliteCredentialStore {
    async fn get(&self, slug: &ProviderSlug) -> Option<StoredCredential> {
        self.with_conn(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT credential_mode, api_key, access_token, refresh_token, expires_at, id_token \
                     FROM provider_credentials WHERE provider_slug = ?1",
                )
                .ok()?;
            let row = stmt
                .query_row([slug.as_str()], |row| {
                    let mode: String = row.get(0)?;
                    let api_key: Option<String> = row.get(1)?;
                    let access_token: Option<String> = row.get(2)?;
                    let refresh_token: Option<String> = row.get(3)?;
                    let expires_at: Option<i64> = row.get(4)?;
                    let id_token: Option<String> = row.get(5)?;
                    Ok((mode, api_key, access_token, refresh_token, expires_at, id_token))
                })
                .ok()?;

            let (mode, api_key, access_token, refresh_token, expires_at, id_token) = row;
            match mode.as_str() {
                "api_key" => api_key.map(StoredCredential::ApiKey),
                "oauth_bearer" => {
                    let access_token = access_token?;
                    let refresh_token = refresh_token.unwrap_or_default();
                    let expires_at = expires_at.map(|ts| {
                        UNIX_EPOCH + Duration::from_secs(ts as u64)
                    });
                    Some(StoredCredential::OAuthBearer(OAuthTokenSet {
                        access_token,
                        refresh_token,
                        expires_at,
                        id_token,
                    }))
                }
                _ => None,
            }
        })
    }

    async fn set(&self, slug: &ProviderSlug, credential: StoredCredential) {
        self.with_conn(|conn| {
            let (mode, api_key, access_token, refresh_token, expires_at, id_token) =
                match &credential {
                    StoredCredential::ApiKey(key) => {
                        ("api_key", Some(key.as_str()), None, None, None, None)
                    }
                    StoredCredential::OAuthBearer(tokens) => {
                        let expires_at = tokens.expires_at.map(|t| {
                            t.duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs() as i64
                        });
                        (
                            "oauth_bearer",
                            None,
                            Some(tokens.access_token.as_str()),
                            Some(tokens.refresh_token.as_str()),
                            expires_at,
                            tokens.id_token.as_deref(),
                        )
                    }
                };

            conn.execute(
                "INSERT INTO provider_credentials \
                 (provider_slug, credential_mode, api_key, access_token, refresh_token, expires_at, id_token, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now')) \
                 ON CONFLICT(provider_slug) DO UPDATE SET \
                 credential_mode = excluded.credential_mode, \
                 api_key = excluded.api_key, \
                 access_token = excluded.access_token, \
                 refresh_token = excluded.refresh_token, \
                 expires_at = excluded.expires_at, \
                 id_token = excluded.id_token, \
                 updated_at = excluded.updated_at",
                rusqlite::params![
                    slug.as_str(),
                    mode,
                    api_key,
                    access_token,
                    refresh_token,
                    expires_at,
                    id_token,
                ],
            )
            .expect("Failed to write credential to database");
        });
    }

    async fn remove(&self, slug: &ProviderSlug) {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM provider_credentials WHERE provider_slug = ?1",
                [slug.as_str()],
            ).expect("DELETE failed");
        });
    }

    async fn list_slugs(&self) -> Vec<ProviderSlug> {
        self.with_conn(|conn| {
            let mut stmt = match conn.prepare(
                "SELECT provider_slug FROM provider_credentials",
            ) {
                Ok(s) => s,
                Err(_) => return Vec::new(),
            };
            let rows = stmt.query_map([], |row| {
                let slug: String = row.get(0)?;
                Ok(ProviderSlug::new(slug))
            });
            match rows {
                Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
                Err(_) => Vec::new(),
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    

    fn temp_db() -> (SqliteCredentialStore, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let store = SqliteCredentialStore::new(db_path);
        // Create table manually for tests
        store.with_conn(|conn| {
            conn.execute(
                "CREATE TABLE provider_credentials (
                    provider_slug TEXT PRIMARY KEY,
                    credential_mode TEXT NOT NULL,
                    api_key TEXT,
                    access_token TEXT,
                    refresh_token TEXT,
                    expires_at INTEGER,
                    id_token TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )
            .unwrap();
        });
        (store, temp_dir)
    }

    #[tokio::test]
    async fn roundtrip_api_key() {
        let (store, _temp_dir) = temp_db();
        let slug = ProviderSlug::new("openai");
        let cred = StoredCredential::ApiKey("sk-test".into());
        store.set(&slug, cred.clone()).await;
        let got = store.get(&slug).await;
        assert_eq!(got, Some(cred));
    }

    #[tokio::test]
    async fn roundtrip_oauth_bearer() {
        let (store, _temp_dir) = temp_db();
        let slug = ProviderSlug::new("codex");
        // Use UNIX_EPOCH + whole seconds so nanoseconds survive SQLite roundtrip
        let expires_at = Some(UNIX_EPOCH + Duration::from_secs(1_000_000_000));
        let cred = StoredCredential::OAuthBearer(OAuthTokenSet {
            access_token: "at123".into(),
            refresh_token: "rt456".into(),
            expires_at,
            id_token: Some("id789".into()),
        });
        store.set(&slug, cred.clone()).await;
        let got = store.get(&slug).await;
        assert_eq!(got, Some(cred));
    }

    #[tokio::test]
    async fn remove_credential() {
        let (store, _temp_dir) = temp_db();
        let slug = ProviderSlug::new("kimi-code");
        store
            .set(&slug, StoredCredential::ApiKey("sk".into()))
            .await;
        assert!(store.get(&slug).await.is_some());
        store.remove(&slug).await;
        assert!(store.get(&slug).await.is_none());
    }

    #[tokio::test]
    async fn list_slugs() {
        let (store, _temp_dir) = temp_db();
        let a = ProviderSlug::new("codex");
        let b = ProviderSlug::new("kimi-code");
        store.set(&a, StoredCredential::ApiKey("sk-a".into())).await;
        store.set(&b, StoredCredential::ApiKey("sk-b".into())).await;
        let mut slugs = store.list_slugs().await;
        slugs.sort_by(|a, b| a.as_str().cmp(b.as_str()));
        assert_eq!(slugs, vec![a, b]);
    }
}
