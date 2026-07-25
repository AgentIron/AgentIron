//! Headless runner invoked by the host scheduler.
//!
//! Host schedulers run `agentiron-run run <task-id> --config <path>`, the
//! invocation `SchedulerInstallContext::generate_invocation` produces. This
//! mirrors iron-core's own `agent-iron` binary: both are thin wrappers around
//! the same `iron_core::cli::execute_run` entry point. It is a separate binary
//! from the app so it keeps a console subsystem, which the app deliberately
//! drops on Windows — a scheduled run needs its stdout and stderr to land
//! somewhere the host scheduler can capture.
//!
//! `execute_run` expects a current_thread runtime inside a `LocalSet`.

fn main() -> std::process::ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to create Tokio runtime");

    let local = tokio::task::LocalSet::new();
    let code = local.block_on(&runtime, async { iron_core::cli::execute_run(&args).await });

    std::process::ExitCode::from(code as u8)
}
