use image::DynamicImage;
use serde::Deserialize;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Emitter;

/// Holds the captured screenshot between capture and crop.
pub struct SnipState {
    pub data: Mutex<Option<SnipData>>,
}

pub struct SnipData {
    pub image: DynamicImage,
    pub temp_path: PathBuf,
}

impl SnipState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(None),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnipRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

/// Phase 1: Minimize main window and open the snip widget.
#[cfg(desktop)]
#[tauri::command]
pub async fn start_snip(
    app: tauri::AppHandle,
) -> Result<(), String> {
    use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};

    // Close existing overlay if open
    if let Some(existing) = app.get_webview_window("snip-overlay") {
        let _ = existing.close();
    }

    // Minimize the main window so it's not in the screenshot
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.minimize();
    }

    // Small delay to let the minimize animation complete
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // Open a small floating widget window (slightly oversized to avoid scrollbars)
    WebviewWindowBuilder::new(
        &app,
        "snip-overlay",
        WebviewUrl::App("/snip".into()),
    )
    .title("Screenshot")
    .inner_size(300.0, 160.0)
    .center()
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create snip widget: {e}"))?;

    Ok(())
}

/// Phase 2: Capture the screen, then resize the overlay to fullscreen for selection.
#[cfg(desktop)]
#[tauri::command]
pub async fn capture_snip(
    app: tauri::AppHandle,
    state: tauri::State<'_, SnipState>,
) -> Result<(), String> {
    use tauri::Manager;

    // Hide the widget so it's not in the screenshot
    let overlay = app.get_webview_window("snip-overlay")
        .ok_or("Snip overlay not found")?;
    let _ = overlay.hide();

    // Wait for the OS to fully hide the window
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // Capture the primary monitor
    let monitors = xcap::Monitor::all().map_err(|e| format!("Failed to enumerate monitors: {e}"))?;
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary())
        .ok_or("No primary monitor found")?;

    let screenshot = primary
        .capture_image()
        .map_err(|e| format!("Failed to capture screen: {e}"))?;

    let dynamic_img = DynamicImage::ImageRgba8(screenshot);

    // Save to temp file
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join("agentiron_snip.png");
    dynamic_img
        .save_with_format(&temp_path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save screenshot: {e}"))?;

    // Store for later cropping
    {
        let mut lock = state.data.lock().map_err(|e| e.to_string())?;
        *lock = Some(SnipData {
            image: dynamic_img,
            temp_path: temp_path.clone(),
        });
    }

    // Get monitor info and resize overlay to fullscreen
    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No primary monitor")?;
    let size = monitor.size();
    let scale = monitor.scale_factor();

    let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(0, 0)));
    let _ = overlay.set_size(tauri::Size::Logical(tauri::LogicalSize::new(
        size.width as f64 / scale,
        size.height as f64 / scale,
    )));
    let _ = overlay.show();
    let _ = overlay.set_focus();

    // Tell the frontend to switch from widget mode to selection mode
    let _ = app.emit("snip-captured", ());

    Ok(())
}

/// Return the screenshot as base64 PNG for the overlay to display.
#[cfg(desktop)]
#[tauri::command]
pub async fn get_snip_screenshot(
    state: tauri::State<'_, SnipState>,
) -> Result<String, String> {
    let lock = state.data.lock().map_err(|e| e.to_string())?;
    let data = lock.as_ref().ok_or("No screenshot available")?;

    let bytes = std::fs::read(&data.temp_path)
        .map_err(|e| format!("Failed to read screenshot file: {e}"))?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    ))
}

/// Crop the screenshot to the selected region and emit the result.
#[cfg(desktop)]
#[tauri::command]
pub async fn complete_snip(
    app: tauri::AppHandle,
    state: tauri::State<'_, SnipState>,
    region: SnipRegion,
) -> Result<(), String> {
    use tauri::Manager;

    let cropped_base64 = {
        let mut lock = state.data.lock().map_err(|e| e.to_string())?;
        let snip_data = lock.take().ok_or("No screenshot available")?;
        let img = snip_data.image;
        let _ = std::fs::remove_file(&snip_data.temp_path);

        let px_x = (region.x * region.scale_factor).round() as u32;
        let px_y = (region.y * region.scale_factor).round() as u32;
        let px_w = (region.width * region.scale_factor).round() as u32;
        let px_h = (region.height * region.scale_factor).round() as u32;

        let img_w = img.width();
        let img_h = img.height();
        let px_x = px_x.min(img_w.saturating_sub(1));
        let px_y = px_y.min(img_h.saturating_sub(1));
        let px_w = px_w.min(img_w.saturating_sub(px_x));
        let px_h = px_h.min(img_h.saturating_sub(px_y));

        if px_w == 0 || px_h == 0 {
            return Err("Selection too small".into());
        }

        let cropped = img.crop_imm(px_x, px_y, px_w, px_h);

        let mut buf = Cursor::new(Vec::new());
        cropped
            .write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode cropped image: {e}"))?;

        base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            buf.into_inner(),
        )
    };

    let _ = app.emit(
        "snip-complete",
        serde_json::json!({
            "data": cropped_base64,
            "mimeType": "image/png",
        }),
    );

    // Close overlay and restore main window
    if let Some(window) = app.get_webview_window("snip-overlay") {
        let _ = window.close();
    }
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
    }

    Ok(())
}

/// Cancel the snip and close the overlay.
#[cfg(desktop)]
#[tauri::command]
pub async fn cancel_snip(
    app: tauri::AppHandle,
    state: tauri::State<'_, SnipState>,
) -> Result<(), String> {
    use tauri::Manager;

    if let Ok(mut lock) = state.data.lock() {
        if let Some(snip_data) = lock.take() {
            let _ = std::fs::remove_file(&snip_data.temp_path);
        }
    }

    if let Some(window) = app.get_webview_window("snip-overlay") {
        let _ = window.close();
    }
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
    }

    Ok(())
}
