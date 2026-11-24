mod console_update;
mod local_vnc;
mod os_keys;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      open_external,
      post_api_json,
      local_ipv4,
      grab_os_keys,
      ungrab_os_keys,
      save_download,
      console_update::console_latest,
      console_update::install_console_update,
      local_vnc::local_ipv4_list,
      local_vnc::local_probe_tcp,
      local_vnc::local_vnc_start,
      local_vnc::local_vnc_stop,
      local_vnc::local_power,
      local_vnc::local_arp_mac,
      local_vnc::local_wake
    ])
    .setup(|app| {
      os_keys::set_app(app.handle().clone());
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn grab_os_keys() {
  os_keys::grab();
}

#[tauri::command]
fn ungrab_os_keys() {
  os_keys::ungrab();
}

#[tauri::command]
fn save_download(default_name: String, data: Vec<u8>) -> Result<String, String> {
  let path = rfd::FileDialog::new()
    .set_title("Simpan agent")
    .set_file_name(&default_name)
    .save_file()
    .ok_or_else(|| "Dibatalkan".to_string())?;
  std::fs::write(&path, data).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().into_owned())
}

fn maps_url_allowed(url: &str) -> bool {
  url.starts_with("https://www.google.com/maps")
    || url.starts_with("https://maps.google.com/")
    || url.starts_with("https://www.google.co.id/maps")
}

fn github_url_allowed(url: &str) -> bool {
  url == "https://github.com/zlfikrimobiliu" || url == "https://github.com/zlfikrimobiliu/"
}

fn external_url_allowed(url: &str) -> bool {
  maps_url_allowed(&url) || github_url_allowed(&url)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
  if !external_url_allowed(&url) {
    return Err("URL tidak diizinkan".into());
  }

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let escaped = url.replace('\'', "");
    std::process::Command::new("powershell")
      .args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-Command",
        &format!("Start-Process '{escaped}'"),
      ])
      .creation_flags(CREATE_NO_WINDOW)
      .spawn()
      .map_err(|e| e.to_string())?;
    return Ok(());
  }

  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
    return Ok(());
  }

  #[cfg(target_os = "linux")]
  {
    std::process::Command::new("xdg-open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
    return Ok(());
  }
}

fn api_url_allowed(url: &str) -> bool {
  url.starts_with("https://zerologic.lokanesa.com/api/v1/")
}

async fn post_once(url: String, token: String, body: String) -> Result<String, String> {
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(3))
    .connect_timeout(std::time::Duration::from_secs(2))
    .pool_max_idle_per_host(0)
    .http1_only()
    .build()
    .map_err(|e| e.to_string())?;
  let res = client
    .post(&url)
    .header("Authorization", format!("Bearer {token}"))
    .header("Content-Type", "application/json")
    .header("Connection", "close")
    .body(body)
    .send()
    .await
    .map_err(|e| format!("reqwest: {e}"))?;
  let status = res.status().as_u16();
  let text = res.text().await.map_err(|e| e.to_string())?;
  if (200..300).contains(&status) {
    Ok(text)
  } else {
    Err(format!("HTTP {status} {text}"))
  }
}

#[tauri::command]
fn local_ipv4() -> Option<String> {
  let sock = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
  sock.connect("8.8.8.8:80").ok()?;
  match sock.local_addr().ok()?.ip() {
    std::net::IpAddr::V4(ip) => Some(ip.to_string()),
    _ => None,
  }
}

#[tauri::command]
async fn post_api_json(url: String, token: String, body: String) -> Result<String, String> {
  if !api_url_allowed(&url) {
    return Err("URL tidak diizinkan".into());
  }
  match tokio::time::timeout(std::time::Duration::from_secs(4), post_once(url, token, body)).await {
    Ok(result) => result,
    Err(_) => Err("timeout 4s POST (tokio)".into()),
  }
}
