import { API_BASE } from '../config'

export const LAN_PORT = 17443

export function relaySocketUrl(session) {
  const token = localStorage.getItem('rd_token') || ''
  const raw = session?.relayUrl || `${API_BASE.replace(/^http/i, 'ws')}/relay`
  const url = new URL(raw)
  url.searchParams.set('sessionId', session.id)
  url.searchParams.set('role', 'console')
  url.searchParams.set('token', token)
  return url.toString()
}

export function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false
  const m = ip.trim().split('%')[0]
  if (m.startsWith('10.')) return true
  if (m.startsWith('192.168.')) return true
  if (m.startsWith('172.')) {
    const n = Number(m.split('.')[1])
    return n >= 16 && n <= 31
  }
  return false
}

export function sameIpv4Subnet(a, b) {
  if (!a || !b) return false
  const pa = String(a).trim().split('%')[0].split('.')
  const pb = String(b).trim().split('%')[0].split('.')
  if (pa.length !== 4 || pb.length !== 4) return false
  return pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2]
}

export function lanSocketUrl(session, ip, port = LAN_PORT) {
  const p = Number(port) > 0 ? Number(port) : LAN_PORT
  const url = new URL(`ws://${ip}:${p}/`)
  url.searchParams.set('sessionId', session.id)
  url.searchParams.set('role', 'console')
  return url.toString()
}

function parseFrame(buf) {
  if (buf.length > 12 && buf[0] === 90 && buf[1] === 76 && buf[2] === 48 && buf[3] === 50) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const capturedAt = Number(view.getBigUint64(4))
    return { jpeg: buf.subarray(12), capturedAt }
  }
  if (buf.length > 4 && buf[0] === 90 && buf[1] === 76 && buf[2] === 48 && buf[3] === 49) {
    return { jpeg: buf.subarray(4), capturedAt: 0 }
  }
  if (buf.length > 20) return { jpeg: buf, capturedAt: 0 }
  return null
}

function bindSocket(ws, session, handlers, path) {
  ws.binaryType = 'arraybuffer'
  const greet = () => {
    if (ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'console.hello', sessionId: session.id, role: 'console', path }))
    handlers.onPath?.(path)
    handlers.onStatus?.('live')
  }
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try {
        handlers.onJson?.(JSON.parse(ev.data))
      } catch {
        /* ignore */
      }
      return
    }
    const buf = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(ev.data)
    const frame = parseFrame(buf)
    if (frame) handlers.onJpeg?.(frame.jpeg, frame.capturedAt)
  }
  ws.onerror = () => {
    handlers.onError?.(path === 'lan' ? 'LAN WebSocket error.' : 'Relay WebSocket error.')
  }
  ws.onclose = () => {
    handlers.onStatus?.('closed')
  }
  if (ws.readyState === WebSocket.OPEN) greet()
  else ws.onopen = greet
  return {
    path,
    send(obj) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
    },
    close() {
      ws.onclose = null
      ws.close()
    },
  }
}

function openOnce(url, waitMs) {
  return new Promise((resolve) => {
    let done = false
    const ws = new WebSocket(url)
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      ws.onopen = null
      ws.onerror = null
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      resolve(null)
    }, waitMs)
    ws.onopen = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      resolve(ws)
    }
    ws.onerror = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      resolve(null)
    }
  })
}

export function connectRelay(session, handlers, extras = {}) {
  let active = {
    send() {},
    close() {},
    path: 'relay',
  }
  let cancelled = false
  let gen = 0

  const attachRelay = () => {
    if (cancelled) return
    const my = ++gen
    try {
      active.close()
    } catch {
      /* ignore */
    }
    const pub = new WebSocket(relaySocketUrl(session))
    const wrapped = {
      ...handlers,
      onStatus(s) {
        if (my !== gen) return
        handlers.onStatus?.(s)
        if (s === 'closed' && !cancelled && my === gen) {
          window.setTimeout(() => {
            if (!cancelled && my === gen) attachRelay()
          }, 900)
        }
      },
    }
    active = bindSocket(pub, session, wrapped, 'relay')
  }

  ;(async () => {
    const ip = extras.lanIp
    const port = extras.lanPort
    const consoleIp = extras.consoleIp
    const lanLikely =
      isPrivateIp(ip) && (!consoleIp || sameIpv4Subnet(ip, consoleIp))
    if (lanLikely) {
      const lan = await openOnce(lanSocketUrl(session, ip, port), 700)
      if (cancelled) {
        lan?.close()
        return
      }
      if (lan && lan.readyState === WebSocket.OPEN) {
        active = bindSocket(lan, session, handlers, 'lan')
        return
      }
    } else if (isPrivateIp(ip) && consoleIp) {
      handlers.onPath?.('relay')
    }
    if (cancelled) return
    attachRelay()
  })()

  return {
    send(obj) {
      active.send(obj)
    },
    close() {
      cancelled = true
      active.close()
    },
  }
}
