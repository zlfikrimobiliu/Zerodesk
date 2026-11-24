use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};

struct ProxyState {
  abort: tauri::async_runtime::JoinHandle<()>,
}

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
static PROXIES: OnceLock<Mutex<HashMap<u64, ProxyState>>> = OnceLock::new();

fn proxies() -> &'static Mutex<HashMap<u64, ProxyState>> {
  PROXIES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn parse_lan_v4(host: &str) -> Result<Ipv4Addr, String> {
  let ip: Ipv4Addr = host
    .trim()
    .parse()
    .map_err(|_| "IP harus IPv4, contoh 192.168.0.55".to_string())?;
  if ip.is_loopback() || ip.is_private() || ip.is_link_local() {
    Ok(ip)
  } else {
    Err("Hanya IP LAN (bukan IP publik).".into())
  }
}

fn stop_id(map: &mut HashMap<u64, ProxyState>, id: u64) {
  if let Some(state) = map.remove(&id) {
    state.abort.abort();
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
  pub ok: bool,
  pub ms: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VncStart {
  pub id: u64,
  pub ws_url: String,
  pub port: u16,
}

#[tauri::command]
pub fn local_ipv4_list() -> Vec<String> {
  let mut out = Vec::new();
  if let Ok(addrs) = if_addrs::get_if_addrs() {
    for iface in addrs {
      if iface.is_loopback() {
        continue;
      }
      if let IpAddr::V4(v4) = iface.ip() {
        if v4.is_private() || v4.is_link_local() {
          out.push(v4.to_string());
        }
      }
    }
  }
  out.sort();
  out.dedup();
  out
}

#[tauri::command]
pub async fn local_probe_tcp(host: String, port: u16) -> ProbeResult {
  let Ok(ip) = parse_lan_v4(&host) else {
    return ProbeResult { ok: false, ms: None };
  };
  if port == 0 {
    return ProbeResult { ok: false, ms: None };
  }
  let addr = SocketAddr::from((ip, port));
  let start = Instant::now();
  match tokio::time::timeout(Duration::from_millis(700), TcpStream::connect(addr)).await {
    Ok(Ok(_)) => ProbeResult {
      ok: true,
      ms: Some(start.elapsed().as_millis() as u32),
    },
    _ => ProbeResult { ok: false, ms: None },
  }
}

#[tauri::command]
pub async fn local_vnc_start(host: String, port: u16) -> Result<VncStart, String> {
  let ip = parse_lan_v4(&host)?;
  if port == 0 {
    return Err("Port tidak valid".into());
  }
  let target = SocketAddr::from((ip, port));
  tokio::time::timeout(Duration::from_secs(2), TcpStream::connect(target))
    .await
    .map_err(|_| format!("Timeout ke TightVNC {target}"))?
    .map_err(|e| format!("Tidak bisa ke {target}: {e}"))?;

  let listener = TcpListener::bind("127.0.0.1:0")
    .await
    .map_err(|e| e.to_string())?;
  let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
  let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);

  let handle = tauri::async_runtime::spawn(async move {
    loop {
      let Ok((incoming, _)) = listener.accept().await else {
        break;
      };
      tauri::async_runtime::spawn(async move {
        if let Err(err) = bridge_ws_tcp(incoming, target).await {
          log::warn!("local vnc bridge: {err}");
        }
      });
    }
  });

  {
    let mut map = proxies().lock().map_err(|e| e.to_string())?;
    map.insert(id, ProxyState { abort: handle });
  }

  Ok(VncStart {
    id,
    ws_url: format!("ws://127.0.0.1:{local_port}"),
    port: local_port,
  })
}

#[tauri::command]
pub fn local_vnc_stop(id: u64) {
  if let Ok(mut map) = proxies().lock() {
    stop_id(&mut map, id);
  }
}

async fn bridge_ws_tcp(incoming: TcpStream, target: SocketAddr) -> Result<(), String> {
  let ws = accept_async(incoming).await.map_err(|e| e.to_string())?;
  let tcp = TcpStream::connect(target).await.map_err(|e| e.to_string())?;
  let _ = tcp.set_nodelay(true);
  let (mut ws_write, mut ws_read) = ws.split();
  let (mut tcp_read, mut tcp_write) = tcp.into_split();

  let c2s = async {
    while let Some(msg) = ws_read.next().await {
      match msg.map_err(|e| e.to_string())? {
        Message::Binary(b) => {
          tcp_write.write_all(&b).await.map_err(|e| e.to_string())?;
        }
        Message::Text(t) => {
          tcp_write
            .write_all(t.as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        }
        Message::Close(_) => break,
        Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {}
      }
    }
    Ok::<(), String>(())
  };

  let s2c = async {
    let mut buf = vec![0u8; 32 * 1024];
    loop {
      let n = tcp_read.read(&mut buf).await.map_err(|e| e.to_string())?;
      if n == 0 {
        break;
      }
      ws_write
        .send(Message::Binary(buf[..n].to_vec().into()))
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok::<(), String>(())
  };

  tokio::select! {
    r = c2s => r,
    r = s2c => r,
  }
}

fn run_windows_power(
  ip: Ipv4Addr,
  flag: &'static str,
  user: String,
  password: String,
) -> Result<String, String> {
  #[cfg(not(windows))]
  {
    let _ = (ip, flag, user, password);
    Err("Matikan/reboot remote hanya dari console Windows.".into())
  }
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let run = |program: &str, args: &[&str]| -> Result<(i32, String), String> {
      let out = std::process::Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;
      let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
      );
      Ok((out.status.code().unwrap_or(-1), text))
    };

    let target = format!(r"\\{ip}");
    let ipc = format!(r"\\{ip}\IPC$");
    let user = user.trim().to_string();
    if user.contains(['\n', '\r', '"']) || password.contains(['\n', '\r']) {
      return Err("Username/password tidak valid.".into());
    }
    let mut bound_ipc = false;
    if !user.is_empty() && !password.is_empty() {
      let user_arg = format!("/user:{user}");
      let (code, _) = run("net", &["use", ipc.as_str(), user_arg.as_str(), password.as_str()])?;
      bound_ipc = code == 0;
    }

    let (code, text) = run("shutdown", &[flag, "/m", target.as_str(), "/t", "0", "/f"])?;
    if bound_ipc {
      let _ = run("net", &["use", ipc.as_str(), "/delete", "/y"]);
    }
    if code == 0 {
      let verb = if flag == "/r" { "reboot" } else { "shutdown" };
      return Ok(format!("{verb} dikirim ke {ip}"));
    }
    let hint = if text.to_lowercase().contains("access") || code == 5 {
      " Isi akun Windows admin di form PC, dan izinkan File and Printer Sharing di firewall target."
    } else {
      ""
    };
    Err(format!(
      "Gagal {} {}: {}{}",
      if flag == "/r" { "reboot" } else { "shutdown" },
      ip,
      text.trim(),
      hint
    ))
  }
}

#[tauri::command]
pub async fn local_power(
  host: String,
  action: String,
  user: Option<String>,
  password: Option<String>,
) -> Result<String, String> {
  let ip = parse_lan_v4(&host)?;
  let flag = match action.trim() {
    "shutdown" | "off" => "/s",
    "reboot" | "restart" => "/r",
    _ => return Err("Aksi harus shutdown atau reboot.".into()),
  };
  let user = user.unwrap_or_default();
  let password = password.unwrap_or_default();
  tokio::time::timeout(
    Duration::from_secs(5),
    tauri::async_runtime::spawn_blocking(move || run_windows_power(ip, flag, user, password)),
  )
  .await
  .map_err(|_| {
    "Timeout 5 detik. Perintah RPC Windows tidak dijawab (biasanya firewall/izin admin). Shutdown lewat TightVNC dipakai sebagai jalur utama.".to_string()
  })?
  .map_err(|e| e.to_string())?
}

fn parse_mac_bytes(raw: &str) -> Result<[u8; 6], String> {
  let hex: String = raw.chars().filter(|c| c.is_ascii_hexdigit()).collect();
  if hex.len() != 12 {
    return Err("MAC harus 12 digit hex, contoh AA:BB:CC:DD:EE:FF.".into());
  }
  let mut mac = [0u8; 6];
  for i in 0..6 {
    mac[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
      .map_err(|_| "MAC tidak valid.".to_string())?;
  }
  if mac.iter().all(|&b| b == 0) || mac.iter().all(|&b| b == 0xff) {
    return Err("MAC tidak valid.".into());
  }
  Ok(mac)
}

fn format_mac(mac: [u8; 6]) -> String {
  format!(
    "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
  )
}

fn magic_packet(mac: [u8; 6]) -> [u8; 102] {
  let mut pkt = [0xffu8; 102];
  for i in 0..16 {
    let start = 6 + i * 6;
    pkt[start..start + 6].copy_from_slice(&mac);
  }
  pkt
}

fn directed_broadcast(ip: Ipv4Addr) -> Ipv4Addr {
  Ipv4Addr::new(ip.octets()[0], ip.octets()[1], ip.octets()[2], 255)
}

fn parse_arp_table(text: &str, ip: Ipv4Addr) -> Option<String> {
  let needle = ip.to_string();
  for line in text.lines() {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
      continue;
    }
    if parts[0] != needle && !parts.iter().any(|p| *p == needle) {
      continue;
    }
    for part in &parts {
      if *part == needle {
        continue;
      }
      if let Ok(mac) = parse_mac_bytes(part) {
        return Some(format_mac(mac));
      }
    }
  }
  None
}

fn lookup_arp_mac(ip: Ipv4Addr) -> Option<String> {
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = std::process::Command::new("arp")
      .args(["-a", &ip.to_string()])
      .creation_flags(CREATE_NO_WINDOW)
      .output()
      .ok()?;
    parse_arp_table(&String::from_utf8_lossy(&out.stdout), ip)
  }
  #[cfg(not(windows))]
  {
    if let Ok(text) = std::fs::read_to_string("/proc/net/arp") {
      if let Some(mac) = parse_arp_table(&text, ip) {
        return Some(mac);
      }
    }
    let out = std::process::Command::new("ip")
      .args(["neigh", "show", &ip.to_string()])
      .output()
      .ok()?;
    parse_arp_table(&String::from_utf8_lossy(&out.stdout), ip)
  }
}

#[tauri::command]
pub async fn local_arp_mac(host: String) -> Result<String, String> {
  let ip = parse_lan_v4(&host)?;
  tokio::time::timeout(
    Duration::from_secs(3),
    tauri::async_runtime::spawn_blocking(move || lookup_arp_mac(ip)),
  )
  .await
  .map_err(|_| "Timeout baca ARP.".to_string())?
  .map_err(|e| e.to_string())?
  .ok_or_else(|| {
    format!("MAC {ip} belum ada di tabel ARP. PC harus sempat online di LAN ini, atau isi MAC manual.")
  })
}

#[tauri::command]
pub async fn local_wake(mac: String, host: Option<String>) -> Result<String, String> {
  let bytes = parse_mac_bytes(&mac)?;
  let pkt = magic_packet(bytes);
  let ip = host
    .as_deref()
    .filter(|s| !s.trim().is_empty())
    .map(parse_lan_v4)
    .transpose()?;
  let mut locals: Vec<Ipv4Addr> = local_ipv4_list()
    .into_iter()
    .filter_map(|s| s.parse().ok())
    .collect();
  if locals.is_empty() {
    locals.push(Ipv4Addr::UNSPECIFIED);
  }
  let mut sent = 0u32;
  for local in locals {
    let Ok(sock) = tokio::net::UdpSocket::bind((local, 0)).await else {
      continue;
    };
    if sock.set_broadcast(true).is_err() {
      continue;
    }
    let mut dests = vec![
      SocketAddr::from((Ipv4Addr::BROADCAST, 9)),
      SocketAddr::from((Ipv4Addr::BROADCAST, 7)),
      SocketAddr::from((directed_broadcast(local), 9)),
      SocketAddr::from((directed_broadcast(local), 7)),
    ];
    if let Some(ip) = ip {
      dests.push(SocketAddr::from((directed_broadcast(ip), 9)));
      dests.push(SocketAddr::from((directed_broadcast(ip), 7)));
      dests.push(SocketAddr::from((ip, 9)));
    }
    for _ in 0..3 {
      for dest in &dests {
        if sock.send_to(&pkt, dest).await.is_ok() {
          sent += 1;
        }
      }
      tokio::time::sleep(Duration::from_millis(50)).await;
    }
  }
  if sent == 0 {
    return Err("Gagal kirim Wake-on-LAN (broadcast UDP).".into());
  }
  Ok(format!("Wake-on-LAN dikirim ke {}", format_mac(bytes)))
}
