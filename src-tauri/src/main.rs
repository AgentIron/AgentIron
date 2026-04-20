// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn configure_linux_graphics_workarounds() {
    let is_wayland = std::env::var_os("WAYLAND_DISPLAY").is_some()
        || matches!(std::env::var("XDG_SESSION_TYPE").as_deref(), Ok("wayland"));

    if is_wayland && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_linux_graphics_workarounds();

    agentiron_lib::run()
}
