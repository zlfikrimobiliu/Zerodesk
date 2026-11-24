import { WS_BASE } from '../config'

const TOKEN_KEY = 'rd_token'

let socket = null
let reconnectTimer = null
let pingTimer = null
let stopped = true
let attempt = 0
let handlers = {}

function token() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

function presenceUrl() {
  const t = encodeURIComponent(token())
  return `${WS_BASE}/api/v1/ws?token=${t}`
}

function clearTimers() {
  window.clearTimeout(reconnectTimer)
  window.clearInterval(pingTimer)
  reconnectTimer = null
  pingTimer = null
}

function emitStatus(connected) {
  handlers.onStatus?.(connected)
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function dispatch(msg) {
  if (!msg || typeof msg !== 'object') return
  const type = msg.type || msg.event || ''
  const payload = msg.payload ?? msg.data ?? msg
  handlers.onMessage?.(type, payload, msg)
}

function scheduleReconnect() {
  if (stopped) return
  const wait = Math.min(15000, 800 * 2 ** Math.min(attempt, 5))
  attempt += 1
  reconnectTimer = window.setTimeout(openSocket, wait)
}

function openSocket() {
  if (stopped) return
  const t = token()
  if (!t) {
    emitStatus(false)
    return
  }

  try {
    socket = new WebSocket(presenceUrl())
  } catch {
    emitStatus(false)
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    attempt = 0
    emitStatus(true)
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  socket.onmessage = (ev) => {
    const msg = parseMessage(ev.data)
    if (!msg) return
    if (msg.type === 'pong' || msg.type === 'ping') return
    dispatch(msg)
  }

  socket.onerror = () => {}

  socket.onclose = () => {
    emitStatus(false)
    clearTimers()
    socket = null
    scheduleReconnect()
  }
}

export function connectPresence(nextHandlers = {}) {
  handlers = nextHandlers
  stopped = false
  attempt = 0
  clearTimers()
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
  openSocket()
}

export function disconnectPresence() {
  stopped = true
  handlers = {}
  clearTimers()
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
  emitStatus(false)
}

export function isPresenceOpen() {
  return socket?.readyState === WebSocket.OPEN
}
