//! Host-scheduler wiring for scheduled automation tasks.
//!
//! iron-core ships one adapter per platform but no factory to choose between
//! them, and each adapter is compiled only on its own target, so selecting one
//! is the consumer's job.

use std::path::PathBuf;
use std::sync::Arc;

use iron_core::scheduled_task::host::{
    HostScheduler, ProductionCommandRunner, SchedulerInstallContext,
};

/// Name of the headless runner binary that host schedulers invoke.
#[cfg(windows)]
const RUNNER_BIN: &str = "agentiron-run.exe";
#[cfg(not(windows))]
const RUNNER_BIN: &str = "agentiron-run";

/// Build the host scheduler for the current platform.
///
/// Returns `None` where AgentIron runs but iron-core ships no adapter, so
/// callers degrade to a read-only view rather than failing outright.
pub fn host_scheduler() -> Option<Arc<dyn HostScheduler>> {
    #[cfg(target_os = "windows")]
    {
        use iron_core::scheduled_task::platform::task_scheduler::TaskSchedulerHostScheduler;
        Some(Arc::new(TaskSchedulerHostScheduler::new(Box::new(
            ProductionCommandRunner,
        ))))
    }

    #[cfg(target_os = "macos")]
    {
        use iron_core::scheduled_task::platform::launchd::LaunchdHostScheduler;
        let launchagents_dir = dirs::home_dir()?.join("Library/LaunchAgents");
        Some(Arc::new(LaunchdHostScheduler::new(
            Box::new(ProductionCommandRunner),
            launchagents_dir,
        )))
    }

    #[cfg(target_os = "linux")]
    {
        use iron_core::scheduled_task::platform::cron_adapter::CronHostScheduler;
        Some(Arc::new(CronHostScheduler::new(Box::new(
            ProductionCommandRunner,
        ))))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Absolute path to the headless runner binary.
///
/// The runner ships beside the app, so it is resolved relative to the running
/// executable rather than `PATH`: a scheduled run is launched by the host
/// scheduler, which inherits neither our `PATH` nor our working directory.
pub fn runner_executable() -> Result<PathBuf, String> {
    let exe =
        std::env::current_exe().map_err(|e| format!("cannot locate current executable: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "current executable has no parent directory".to_string())?;

    let runner = dir.join(RUNNER_BIN);
    if !runner.is_file() {
        return Err(format!(
            "runner binary not found at {}. Scheduled tasks cannot be installed without it.",
            runner.display()
        ));
    }

    Ok(runner)
}

/// Build the installation context describing how host entries invoke AgentIron.
///
/// The config store path is the same one the app opens, so a scheduled run
/// reads the schedules, tasks, and credentials the UI wrote.
pub fn install_context() -> Result<SchedulerInstallContext, String> {
    let config_store_path = iron_core::config::default_config_path()
        .map_err(|e| format!("cannot resolve config store path: {e}"))?;

    Ok(SchedulerInstallContext {
        runner_executable: runner_executable()?,
        config_store_path,
    })
}
