use tauri::tray::TrayIconBuilder;
use tauri::menu::{Menu, MenuItem};
use tauri::Manager;

mod commands;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(
                    "sqlite:agentiron.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "Initial schema",
                        sql: include_str!("../migrations/001_initial.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        );

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
            app.manage(state::AppState::new());
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
            commands::agent::list_agents,
            commands::agent::register_mcp_server,
            commands::agent::get_mcp_status,
            commands::agent::set_mcp_server_enabled,
            commands::agent::refresh_skill_catalog,
            commands::agent::list_available_skills,
            commands::agent::activate_skill,
            commands::agent::deactivate_skill,
            commands::agent::list_active_skills,
            commands::agent::export_handoff,
            commands::agent::import_handoff,
            commands::agent::save_handoff_bundle,
            commands::agent::load_handoff_bundle,
            commands::chat::send_message,
            commands::chat::send_message_with_images,
            commands::chat::respond_to_approval,
            commands::chat::cancel_active_prompt,
            commands::chat::compact_session,
            commands::models::update_model_registry,
            commands::snip::start_snip,
            commands::snip::capture_snip,
            commands::snip::get_snip_screenshot,
            commands::snip::complete_snip,
            commands::snip::cancel_snip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
