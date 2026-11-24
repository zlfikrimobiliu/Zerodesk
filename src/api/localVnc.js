import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

export function isLocalVncApp() {
  return isTauri()
}

export function localWindowLabel(pcId) {
  return `local-${String(pcId).replace(/[^a-zA-Z0-9/:_-]/g, '_')}`
}

export async function listConsoleIpv4() {
  if (!isTauri()) return []
  try {
    const list = await invoke('local_ipv4_list')
    return Array.isArray(list) ? list.filter(Boolean) : []
  } catch {
    try {
      const one = await invoke('local_ipv4')
      return one ? [one] : []
    } catch {
      return []
    }
  }
}

export async function probeTcp(host, port) {
  if (!isTauri()) return { ok: false, ms: null }
  try {
    const result = await invoke('local_probe_tcp', { host: String(host), port: Number(port) || 5900 })
    return { ok: Boolean(result?.ok), ms: result?.ms ?? null }
  } catch {
    return { ok: false, ms: null }
  }
}

export async function localPower(host, action, user, password) {
  if (!isTauri()) {
    throw new Error('Shutdown/reboot hanya di aplikasi desktop Zerologic.')
  }
  return invoke('local_power', {
    host: String(host),
    action: String(action),
    user: user ? String(user) : null,
    password: password ? String(password) : null,
  })
}

export async function lookupMac(host) {
  if (!isTauri()) return ''
  try {
    const mac = await invoke('local_arp_mac', { host: String(host) })
    return String(mac || '').trim()
  } catch {
    return ''
  }
}

export async function wakeOnLan(mac, host) {
  if (!isTauri()) {
    throw new Error('Hidupkan PC hanya di aplikasi desktop Zerologic.')
  }
  return invoke('local_wake', {
    mac: String(mac || ''),
    host: host ? String(host) : null,
  })
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

const powerPauseListeners = new Set()

export function onLocalPowerPause(fn) {
  powerPauseListeners.add(fn)
  return () => powerPauseListeners.delete(fn)
}

async function withLocalPowerPause(fn) {
  powerPauseListeners.forEach((cb) => {
    try {
      cb(true)
    } catch {
      /* ignore */
    }
  })
  await sleep(700)
  try {
    return await fn()
  } finally {
    powerPauseListeners.forEach((cb) => {
      try {
        cb(false)
      } catch {
        /* ignore */
      }
    })
  }
}

function sendChord(rfb, keys) {
  for (const [sym, code] of keys) rfb.sendKey(sym, code, true)
  for (let i = keys.length - 1; i >= 0; i -= 1) rfb.sendKey(keys[i][0], keys[i][1], false)
}

async function sendAscii(rfb, text) {
  for (const ch of text) {
    const keysym = ch.charCodeAt(0)
    rfb.sendKey(keysym, null, true)
    rfb.sendKey(keysym, null, false)
    await sleep(18)
  }
}

export async function powerViaTightVnc(pc, action) {
  if (!isTauri()) {
    throw new Error('Shutdown/reboot hanya di aplikasi desktop Zerologic.')
  }
  const cmd = action === 'reboot' ? 'shutdown /r /t 0 /f' : 'shutdown /s /t 0 /f'
  return withLocalPowerPause(async () => {
    const started = await startLocalVnc(pc.ip, pc.port)
    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;left:-80px;top:-80px;width:16px;height:16px;overflow:hidden;opacity:0;pointer-events:none'
    document.body.appendChild(host)
    let rfb = null
    try {
      const { default: RFB } = await import('@novnc/novnc')
      rfb = new RFB(host, started.wsUrl, {
        credentials: pc.password ? { password: pc.password } : undefined,
        shared: true,
      })
      rfb.viewOnly = false
      rfb.scaleViewport = false
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error('Timeout konek TightVNC untuk shutdown.')),
          8000,
        )
        rfb.addEventListener('connect', () => {
          window.clearTimeout(timer)
          resolve()
        })
        rfb.addEventListener('disconnect', (ev) => {
          if (ev?.detail?.clean) return
          window.clearTimeout(timer)
          reject(new Error('TightVNC terputus sebelum perintah terkirim.'))
        })
        rfb.addEventListener('credentialsrequired', () => {
          rfb.sendCredentials({ password: pc.password || '' })
        })
      })
      await sleep(350)
      rfb.sendKey(0xffeb, 'MetaLeft', true)
      await sleep(90)
      rfb.sendKey(0x0072, 'KeyR', true)
      rfb.sendKey(0x0072, 'KeyR', false)
      await sleep(40)
      rfb.sendKey(0xffeb, 'MetaLeft', false)
      await sleep(600)
      sendChord(rfb, [
        [0xffe3, 'ControlLeft'],
        [0x0061, 'KeyA'],
      ])
      await sleep(80)
      await sendAscii(rfb, cmd)
      await sleep(80)
      rfb.sendKey(0xff0d, 'Enter', true)
      rfb.sendKey(0xff0d, 'Enter', false)
      await sleep(500)
      return action === 'reboot'
        ? `Reboot dikirim ke ${pc.name} lewat TightVNC.`
        : `Shutdown dikirim ke ${pc.name} lewat TightVNC.`
    } finally {
      try {
        rfb?.disconnect()
      } catch {
        /* ignore */
      }
      await stopLocalVnc(started.id)
      host.remove()
    }
  })
}

export async function startLocalVnc(host, port) {
  if (!isTauri()) {
    throw new Error('Local TightVNC hanya di aplikasi desktop Zerologic, bukan browser.')
  }
  return invoke('local_vnc_start', { host: String(host), port: Number(port) || 5900 })
}

export async function stopLocalVnc(id) {
  if (!isTauri() || id == null) return
  try {
    await invoke('local_vnc_stop', { id: Number(id) })
  } catch {
    /* ignore */
  }
}

export async function openLocalSessionWindow(pc, company) {
  if (!isTauri()) {
    throw new Error('Jendela baru hanya di aplikasi desktop Zerologic.')
  }
  const label = localWindowLabel(pc.id)
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    try {
      await existing.unminimize()
    } catch {
      /* ignore */
    }
    await existing.setFocus()
    return existing
  }
  const title = `${company?.name || 'Local'} · ${pc.name}`
  const webview = new WebviewWindow(label, {
    url: `/local-session/${encodeURIComponent(pc.id)}`,
    title,
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    center: true,
    focus: true,
  })
  await new Promise((resolve, reject) => {
    webview.once('tauri://created', () => resolve())
    webview.once('tauri://error', (ev) => {
      const msg = typeof ev?.payload === 'string' ? ev.payload : 'Gagal buka jendela.'
      reject(new Error(msg))
    })
  })
  return webview
}
