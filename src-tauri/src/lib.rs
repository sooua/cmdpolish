// CmdPolish desktop entrypoint. All formatting/redaction logic lives in the
// frontend (offline, no backend). The Rust side hosts the window, the clipboard
// plugin, and a local SQLite database for snippet history.

mod ai;

use tauri_plugin_sql::{Migration, MigrationKind};

/// Show + focus the main window, restoring it from a minimized/hidden state.
/// Shared by the tray, the tray menu, and the single-instance handler.
#[cfg(desktop)]
fn reveal_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Toggle the main window's visibility (tray left-click / "Show / Hide" item).
#[cfg(desktop)]
fn toggle_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
            let _ = w.hide();
        } else {
            reveal_main(app);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create snippets table",
            sql: "CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT,
                language TEXT,
                input_text TEXT,
                output_text TEXT,
                created_at TEXT,
                updated_at TEXT,
                has_secrets INTEGER,
                risk_level TEXT
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add duration_ms column",
            sql: "ALTER TABLE snippets ADD COLUMN duration_ms INTEGER;",
            kind: MigrationKind::Up,
        },
    ];

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // Single-instance must be the FIRST plugin registered. A second launch
    // hands off to the running instance, which reveals its window instead of
    // spawning a duplicate process (desktop only).
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            reveal_main(app);
        }));
    }

    builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cmdpolish.db", migrations)
                .build(),
        );

    // Auto-update + relaunch (desktop only).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .setup(|app| {
            // System tray: left-click toggles the window; the menu offers an
            // explicit Show / Hide and Quit. The icon reuses the app icon.
            #[cfg(desktop)]
            {
                use tauri::{
                    menu::{Menu, MenuItem},
                    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
                };
                let show = MenuItem::with_id(app, "show", "显示 / 隐藏", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出 CmdPolish", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;

                let mut tray = TrayIconBuilder::with_id("main")
                    .tooltip("CmdPolish")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => toggle_main(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            toggle_main(tray.app_handle());
                        }
                    });
                if let Some(icon) = app.default_window_icon().cloned() {
                    tray = tray.icon(icon);
                }
                tray.build(app)?;
            }
            Ok(())
        })
        // Closing the window hides it to the tray (keeps running in background);
        // a real quit goes through the tray menu's "Quit".
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            ai::ai_complete,
            ai::ai_complete_stream,
            ai::ai_prewarm,
            ai::ai_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running CmdPolish");
}
