import { computed, reactive } from 'vue'
import {
  deleteDevice as deleteDeviceRequest,
  deleteEvent as deleteEventRequest,
  deleteEvents as deleteEventsRequest,
  deleteSessionLog as deleteSessionLogRequest,
  deleteSessionLogs as deleteSessionLogsRequest,
  fetchDevices,
  fetchEvents,
  fetchSessions,
  fetchStats,
  isMockMode,
  patchDevice,
} from '../api/client'
import { connectPresence, disconnectPresence } from '../api/ws'

const state = reactive({
  loading: false,
  error: '',
  wsConnected: false,
  devices: [],
  events: [],
  sessions: [],
  stats: {
    total: 0,
    online: 0,
    idle: 0,
    offline: 0,
    activeSessions: 0,
    regions: 0,
  },
  lastSync: null,
  tick: Date.now(),
})

let started = false
let pollTimer = null
let tickTimer = null
let refreshing = false

export async function refreshLive() {
  if (refreshing) return
  refreshing = true
  state.error = ''
  try {
    const [stats, devices, events, sessions] = await Promise.all([
      fetchStats(),
      fetchDevices(),
      fetchEvents({ limit: 200 }),
      fetchSessions(),
    ])
    state.devices = asList(devices).map(normalizeDevice).filter(Boolean)
    state.events = asList(events)
    state.sessions = asList(sessions)
    if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
      state.stats = { ...state.stats, ...stats }
    } else {
      recomputeStats()
    }
    state.lastSync = new Date().toISOString()
  } catch (err) {
    state.error = err.message || 'Gagal sinkron ke backend.'
    throw err
  } finally {
    refreshing = false
  }
}

function asList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  return []
}

function numOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeDevice(device) {
  if (!device || typeof device !== 'object') return null
  const location = device.location || {}
  return {
    ...device,
    id: device.id || device.deviceId || device._id || '',
    userName: device.userName || device.hostname || '—',
    macAddress: device.macAddress || device.mac || '',
    ipLocal: device.ipLocal || device.localIp || device.ipLan || '',
    ipPublic: device.ipPublic || '',
    location: {
      street: location.street || '',
      district: location.district || location.subdistrict || '',
      city: location.city || '',
      province: location.province || location.state || '',
      postal: location.postal || location.postcode || '',
      country: location.country || '',
      region: location.region || '',
      lat: numOrNull(location.lat ?? location.latitude),
      lng: numOrNull(location.lng ?? location.longitude),
      accuracyM: numOrNull(location.accuracyM ?? location.accuracy),
      source: location.source || '',
      updatedAt: location.updatedAt || null,
    },
    cpuPct: device.cpuPct ?? 0,
    ramPct: device.ramPct ?? 0,
    latencyMs: device.latencyMs ?? 0,
  }
}

function recomputeStats() {
  const devices = state.devices
  const regions = new Set(
    devices.map((d) => d.location?.region).filter(Boolean),
  )
  state.stats = {
    total: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    idle: devices.filter((d) => d.status === 'idle').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    activeSessions: state.sessions.filter((s) => s.status === 'active').length,
    regions: regions.size,
  }
}

function upsertDevice(raw) {
  const device = normalizeDevice(raw)
  if (!device?.id) return
  const idx = state.devices.findIndex((d) => d.id === device.id)
  if (idx >= 0) state.devices.splice(idx, 1, { ...state.devices[idx], ...device })
  else state.devices.unshift(device)
  recomputeStats()
}

function upsertEvent(event) {
  if (!event?.id) return
  const idx = state.events.findIndex((e) => e.id === event.id)
  if (idx >= 0) state.events.splice(idx, 1, event)
  else state.events.unshift(event)
  if (state.events.length > 200) state.events.length = 200
}

function upsertSession(session) {
  if (!session?.id) return
  const idx = state.sessions.findIndex((s) => s.id === session.id)
  if (idx >= 0) state.sessions.splice(idx, 1, { ...state.sessions[idx], ...session })
  else state.sessions.unshift(session)
  recomputeStats()
}

function removeDevice(id) {
  if (!id) return
  const idx = state.devices.findIndex((d) => d.id === id)
  if (idx >= 0) state.devices.splice(idx, 1)
  recomputeStats()
}

function removeEvent(id) {
  if (!id) return
  const idx = state.events.findIndex((e) => String(e.id) === String(id))
  if (idx >= 0) state.events.splice(idx, 1)
}

function removeSession(id) {
  if (!id) return
  const idx = state.sessions.findIndex((s) => s.id === id)
  if (idx >= 0) state.sessions.splice(idx, 1)
  recomputeStats()
}

function applyHeartbeat(payload) {
  if (!payload) return
  const id = payload.deviceId || payload.id
  if (!id) return
  const current = state.devices.find((d) => d.id === id)
  if (!current) return
  upsertDevice({
    ...(current || { id }),
    status: payload.status || current?.status || 'online',
    cpuPct: payload.cpuPct ?? current?.cpuPct,
    ramPct: payload.ramPct ?? current?.ramPct,
    latencyMs: payload.latencyMs ?? current?.latencyMs,
    lastSeen: payload.lastSeen || new Date().toISOString(),
  })
}

function onMessage(type, payload) {
  switch (type) {
    case 'device.updated':
    case 'device.update':
    case 'device.created':
      upsertDevice(payload)
      break
    case 'device.deleted':
    case 'device.removed':
      removeDevice(payload?.id || payload?.deviceId)
      break
    case 'event.created':
    case 'event.updated':
      upsertEvent(payload)
      break
    case 'event.deleted':
      removeEvent(payload?.id || payload?.eventId)
      break
    case 'event.cleared':
      state.events = []
      break
    case 'session.updated':
    case 'session.created':
      upsertSession(payload)
      break
    case 'session.deleted':
      removeSession(payload?.id || payload?.sessionId)
      break
    case 'session.cleared':
      state.sessions = state.sessions.filter((s) => String(s.status || '').toLowerCase() === 'active')
      break
    case 'stats.updated':
      if (payload && typeof payload === 'object') {
        Object.assign(state.stats, payload)
      }
      break
    case 'agent.heartbeat':
      applyHeartbeat(payload)
      break
    default:
      break
  }
}

function startTimers() {
  window.clearInterval(pollTimer)
  window.clearInterval(tickTimer)
  tickTimer = window.setInterval(() => {
    state.tick = Date.now()
  }, 5000)
  pollTimer = window.setInterval(() => {
    if (!started) return
    refreshLive().catch(() => {})
  }, state.wsConnected ? 45000 : 12000)
}

export function startLive() {
  if (started) return
  started = true
  state.loading = true
  refreshLive()
    .catch(() => {})
    .finally(() => {
      state.loading = false
    })

  if (!isMockMode()) {
    connectPresence({
      onStatus(connected) {
        state.wsConnected = connected
        startTimers()
      },
      onMessage,
    })
  }

  startTimers()
}

export function stopLive() {
  started = false
  disconnectPresence()
  window.clearInterval(pollTimer)
  window.clearInterval(tickTimer)
  pollTimer = null
  tickTimer = null
  state.wsConnected = false
}

export async function renameDevice(id, name) {
  const updated = await patchDevice(id, { name })
  upsertDevice(updated)
  return updated
}

export async function deleteDevice(id) {
  const result = await deleteDeviceRequest(id)
  removeDevice(id)
  return result
}

export async function deleteEvent(id) {
  const result = await deleteEventRequest(id)
  removeEvent(id)
  return result
}

export async function deleteAllEvents() {
  const result = await deleteEventsRequest()
  state.events = []
  return result
}

export async function deleteSessionLog(id) {
  const result = await deleteSessionLogRequest(id)
  removeSession(id)
  return result
}

export async function deleteAllSessionLogs() {
  const result = await deleteSessionLogsRequest()
  state.sessions = state.sessions.filter((s) => String(s.status || '').toLowerCase() === 'active')
  recomputeStats()
  return result
}

export function useLive() {
  return {
    loading: computed(() => state.loading),
    error: computed(() => state.error),
    wsConnected: computed(() => state.wsConnected),
    devices: computed(() => state.devices),
    events: computed(() => state.events),
    sessions: computed(() => state.sessions),
    stats: computed(() => state.stats),
    lastSync: computed(() => state.lastSync),
    tick: computed(() => state.tick),
    refresh: refreshLive,
    renameDevice,
    deleteDevice,
    deleteEvent,
    deleteAllEvents,
    deleteSessionLog,
    deleteAllSessionLogs,
  }
}
