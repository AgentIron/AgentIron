use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

mod commands;
mod core_config;
mod debug;
mod provider_box;
mod state;

use core_config::CoreConfig;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .setup(|app| {
            // Register managed state
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db_path = app_data_dir.join("agentiron.db");

            // Shared-config initialization is best-effort: if encryption or
            // the config store cannot be opened, the app still boots so the
            // frontend can display an actionable, secret-safe error rather
            // than exiting silently.
            let shared_config_error: commands::config_management::SharedConfigError =
                std::sync::Mutex::new(None);

            let core_config_result = std::thread::spawn(move || {
                let cipher = crate::core_config::resolve_config_cipher_sync();
                if cipher.is_none() {
                    return Err("Credential encryption is unavailable. \
                         Set AGENTIRON_CONFIG_ENCRYPTION_KEY or ensure your OS keyring \
                         is accessible, then restart AgentIron."
                        .to_string());
                }
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .map_err(|e| format!("Failed to create config runtime: {e}"))?;
                rt.block_on(async move {
                    let config = crate::core_config::CoreConfig::open_with_cipher(cipher)
                        .await
                        .map_err(|e| format!("Failed to open shared config store: {e}"))?;
                    let legacy_conn = rusqlite::Connection::open(&db_path)
                        .map_err(|e| format!("Failed to open legacy settings database: {e}"))?;
                    crate::commands::settings::ensure_settings_schema_inner(&legacy_conn)?;
                    crate::core_config::migrate_legacy_settings(&config.store, &legacy_conn)
                        .await?;

                    // Seed shipped default agent profiles non-destructively.
                    iron_core::profile::seed_default_profiles(
                        &config.store,
                        iron_core::profile::DefaultProfileSeedPolicy::FirstRunOnly,
                    )
                    .await
                    .map_err(|e| format!("Failed to seed default profiles: {e}"))?;

                    Ok::<_, String>(config)
                })
            })
            .join()
            .map_err(|_| "Shared config initialization panicked".to_string())?;

            match core_config_result {
                Ok(config) => {
                    let debug_enabled = crate::debug::is_debug_mode();
                    let core_config = std::sync::Arc::new(config);
                    app.manage(CoreConfig::clone(&core_config));
                    app.manage(state::AppState::new(core_config, debug_enabled));
                }
                Err(e) => {
                    *shared_config_error.lock().unwrap() = Some(e);
                }
            }

            app.manage(shared_config_error);
            commands::settings::ensure_settings_schema(app.handle())?;
            app.manage(commands::snip::SnipState::new());

            // System tray (desktop only)
            #[cfg(desktop)]
            {
                let quit = MenuItem::with_id(app, "quit", "Quit AgentIron", true, None::<&str>)?;
                let show = MenuItem::with_id(app, "show", "Show AgentIron", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .tooltip("AgentIron")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent::create_agent,
            commands::agent::disconnect_agent,
            commands::agent::change_working_directory,
            commands::agent::list_agents,
            commands::agent::register_mcp_server,
            commands::agent::get_mcp_status,
            commands::agent::set_mcp_server_enabled,
            commands::agent::reconnect_mcp_server,
            commands::agent::refresh_skill_catalog,
            commands::agent::list_available_skills,
            commands::agent::activate_skill,
            commands::agent::deactivate_skill,
            commands::agent::list_active_skills,
            commands::agent::export_handoff,
            commands::agent::import_handoff,
            commands::agent::save_handoff_bundle,
            commands::agent::load_handoff_bundle,
            commands::agent::save_handoff_to_core,
            commands::agent::load_handoff_from_core,
            commands::agent::list_saved_handoffs,
            commands::agent::delete_saved_handoff,
            commands::chat::send_message,
            commands::chat::send_message_with_images,
            commands::chat::respond_to_approval,
            commands::chat::cancel_active_prompt,
            commands::chat::compact_session,
            commands::models::update_model_registry,
            commands::oauth::start_provider_oauth,
            commands::oauth::poll_provider_oauth,
            commands::oauth::disconnect_provider_oauth,
            commands::oauth::get_provider_auth_status,
            commands::settings::load_settings_rows,
            commands::settings::save_setting_row,
            commands::config_management::list_profiles,
            commands::config_management::get_profile,
            commands::config_management::save_profile,
            commands::config_management::delete_profile,
            commands::config_management::profile_impact,
            commands::config_management::list_prompts,
            commands::config_management::get_prompt,
            commands::config_management::create_prompt,
            commands::config_management::save_prompt,
            commands::config_management::rename_prompt,
            commands::config_management::delete_prompt,
            commands::config_management::prompt_impact,
            commands::config_management::list_credentials,
            commands::config_management::set_api_key,
            commands::config_management::delete_credential,
            commands::config_management::get_shared_config_error,
            commands::config_management::seed_default_profiles,
            commands::config_management::restore_default_profiles,
            commands::snip::start_snip,
            commands::snip::capture_snip,
            commands::snip::get_snip_screenshot,
            commands::snip::complete_snip,
            commands::snip::cancel_snip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
