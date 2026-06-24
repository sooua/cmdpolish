// CmdPolish desktop entrypoint. All formatting/redaction logic lives in the
// frontend (offline, no backend). The Rust side hosts the window, the clipboard
// plugin, and a local SQLite database for snippet history.

mod ai;

use tauri_plugin_sql::{Migration, MigrationKind};

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
    let mut builder = tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![
            ai::ai_complete,
            ai::ai_complete_stream,
            ai::ai_prewarm,
            ai::ai_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running CmdPolish");
}
