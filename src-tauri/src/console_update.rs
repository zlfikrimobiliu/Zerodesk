use tauri::AppHandle;

const LATEST_URL: &str = "https://zerologic.lokanesa.com/console/latest.json";
const CONSOLE_PREFIX: &str = "https://zerologic.lokanesa.com/console/";

fn console_exe_allowed(url: &str) -> bool {
  let Some(name) = url.strip_prefix(CONSOLE_PREFIX) else {
    return false;
  };
  if name.is_empty()
    || name.contains('/')
    || name.contains('\\')
    || name.contains("..")
    || name.contains('?')
    || name.contains('#')
  {
    return false;
  }
  name.ends_with(".exe")
}

async fn http_get(url: &str, timeout_secs: u64) -> Result<(u16, Vec<u8>), String> {
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(timeout_secs))
    .connect_timeout(std::time::Duration::from_secs(8))
    .pool_max_idle_per_host(0)
    .http1_only()
    .build()
    .map_err(|e| e.to_string())?;
  let res = client
    .get(url)
    .header("Connection", "close")
    .send()
    .await
    .map_err(|e| format!("reqwest: {e}"))?;
  let status = res.status().as_u16();
  let bytes = res.bytes().await.map_err(|e| e.to_string())?;
  Ok((status, bytes.to_vec()))
}

#[tauri::command]
pub async fn console_latest() -> Result<String, String> {
  let (status, bytes) = http_get(LATEST_URL, 12).await?;
  if !(200..300).contains(&status) {
    return Err(format!("HTTP {status}"));
  }
  String::from_utf8(bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn install_console_update(app: AppHandle, url: String) -> Result<(), String> {
  if !console_exe_allowed(&url) {
    return Err("URL tidak diizinkan".into());
  }
  let (status, bytes) = http_get(&url, 180).await?;
  if !(200..300).contains(&status) {
    return Err(format!("HTTP {status}"));
  }
  if bytes.len() < 64_000 {
    return Err("File update tidak valid.".into());
  }
  let name = url.rsplit('/').next().unwrap_or("ZeroDesk-update.exe");
  let path = std::env::temp_dir().join(name);
  std::fs::write(&path, bytes).map_err(|e| e.to_string())?;

  std::process::Command::new(&path)
    .spawn()
    .map_err(|e| format!("gagal buka installer: {e}"))?;

  tokio::time::sleep(std::time::Duration::from_millis(600)).await;
  app.exit(0);
  Ok(())
}
