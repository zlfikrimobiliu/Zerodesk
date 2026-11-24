import { computed, reactive } from 'vue'

const KEY = 'zl_local_audit_v1'
const MAX_EVENTS = 400
const MAX_SESSIONS = 200

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function emptyState() {
  return { events: [], sessions: [] }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw) return emptyState()
    return {
      events: Array.isArray(raw.events) ? raw.events : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    }
  } catch {
    return emptyState()
  }
}

const state = reactive(load())

function persist() {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      events: state.events.slice(0, MAX_EVENTS),
      sessions: state.sessions.slice(0, MAX_SESSIONS),
    }),
  )
}

function hydrate() {
  const next = load()
  state.events = next.events
  state.sessions = next.sessions
}

export function reloadLocalAudit() {
  hydrate()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === KEY) hydrate()
  })
}

export function useLocalAudit() {
  const events = computed(() => state.events)
  const sessions = computed(() => state.sessions)

  function addEvent({ type, text, pcName, companyName, operator }) {
    state.events.unshift({
      id: uid('lev'),
      at: new Date().toISOString(),
      type: String(type || 'event'),
      text: String(text || ''),
      pcName: String(pcName || ''),
      companyName: String(companyName || ''),
      operator: String(operator || ''),
    })
    if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS
    persist()
  }

  function deleteEvent(id) {
    state.events = state.events.filter((ev) => ev.id !== id)
    persist()
  }

  function clearEvents() {
    state.events = []
    persist()
  }

  function startSession({ pcId, pcName, companyName, operator, ip }) {
    const row = {
      id: uid('lsn'),
      pcId: String(pcId || ''),
      pcName: String(pcName || ''),
      companyName: String(companyName || ''),
      operator: String(operator || ''),
      ip: String(ip || ''),
      path: 'lan',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSec: null,
      status: 'active',
    }
    state.sessions.unshift(row)
    if (state.sessions.length > MAX_SESSIONS) state.sessions.length = MAX_SESSIONS
    persist()
    addEvent({
      type: 'connect',
      text: `TightVNC ${row.companyName} · ${row.pcName} (${row.ip})`,
      pcName: row.pcName,
      companyName: row.companyName,
      operator: row.operator,
    })
    return row.id
  }

  function endSession(id) {
    const row = state.sessions.find((s) => s.id === id)
    if (!row || row.status !== 'active') return
    const ended = new Date()
    row.endedAt = ended.toISOString()
    row.durationSec = Math.max(0, Math.floor((ended.getTime() - new Date(row.startedAt).getTime()) / 1000))
    row.status = 'ended'
    persist()
    addEvent({
      type: 'disconnect',
      text: `Selesai TightVNC ${row.companyName} · ${row.pcName}`,
      pcName: row.pcName,
      companyName: row.companyName,
      operator: row.operator,
    })
  }

  function deleteSession(id) {
    const row = state.sessions.find((s) => s.id === id)
    if (!row || row.status === 'active') return
    state.sessions = state.sessions.filter((s) => s.id !== id)
    persist()
  }

  function clearEndedSessions() {
    state.sessions = state.sessions.filter((s) => s.status === 'active')
    persist()
  }

  return {
    events,
    sessions,
    addEvent,
    deleteEvent,
    clearEvents,
    startSession,
    endSession,
    deleteSession,
    clearEndedSessions,
  }
}
