import { API_BASE } from '../config'
import * as mock from './mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function restBase() {
  return import.meta.env.DEV ? '' : API_BASE
}

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

function xhrJson(method, path, body, timeoutMs = 0, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, `${restBase()}${path}`)
    if (timeoutMs) xhr.timeout = timeoutMs
    xhr.setRequestHeader('Content-Type', 'application/json')
    const token = localStorage.getItem('rd_token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    let finished = false
    const finish = (fn) => () => {
      if (finished) return
      finished = true
      fn()
    }

    xhr.onload = finish(() => {
      let data = null
      if (xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          data = { message: xhr.responseText.slice(0, 180) }
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      const err = new Error(data?.message || `Request gagal (${xhr.status})`)
      err.status = xhr.status
      err.code = data?.code
      err.body = data
      reject(err)
    })
    xhr.ontimeout = finish(() => {
      const err = new Error(`Timeout ${Math.round((timeoutMs || 0) / 1000)}s: ${path}`)
      err.code = 'TIMEOUT'
      reject(err)
    })
    xhr.onerror = finish(() => {
      const err = new Error(`Jaringan gagal ${method} ${path}`)
      err.code = 'NETWORK'
      reject(err)
    })
    xhr.onabort = finish(() => {
      const err = new Error('Request dibatalkan.')
      err.code = 'ABORTED'
      reject(err)
    })

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(body == null ? null : JSON.stringify(body))
  })
}

async function request(path, options = {}) {
  if (USE_MOCK) {
    throw new Error('API live belum di-set. Pakai mock.')
  }

  const { timeoutMs, headers: extraHeaders, signal: userSignal, ...rest } = options
  const headers = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  }
  const token = localStorage.getItem('rd_token')
  if (token) headers.Authorization = `Bearer ${token}`

  const ctrl = new AbortController()
  if (userSignal) {
    if (userSignal.aborted) ctrl.abort()
    else userSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }

  const work = (async () => {
    let res
    try {
      res = await fetch(`${restBase()}${path}`, {
        ...rest,
        headers,
        signal: ctrl.signal,
        cache: 'no-store',
      })
    } catch (e) {
      if (e?.name === 'AbortError') {
        if (userSignal?.aborted) {
          const err = new Error('Request dibatalkan.')
          err.code = 'ABORTED'
          throw err
        }
        const err = new Error(
          timeoutMs
            ? `Timeout ${Math.round(timeoutMs / 1000)}s: ${path} (koneksi/body tidak selesai)`
            : 'Request dibatalkan.',
        )
        err.code = timeoutMs ? 'TIMEOUT' : 'ABORTED'
        throw err
      }
      throw e
    }
    const text = await res.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text.slice(0, 180) }
      }
    }
    if (!res.ok) {
      const err = new Error(data?.message || `Request gagal (${res.status})`)
      err.status = res.status
      err.code = data?.code
      err.body = data
      throw err
    }
    return data
  })()

  if (!timeoutMs) return work

  let to = 0
  const timed = new Promise((_, reject) => {
    to = window.setTimeout(() => {
      const err = new Error(
        `Timeout ${Math.round(timeoutMs / 1000)}s: ${path}. Header 201 tanpa nutup body HTTP = hang. BE harus Encode + Flush + return (BACKEND.md bagian 4).`,
      )
      err.code = 'TIMEOUT'
      reject(err)
      /* jangan ctrl.abort() — WebView2 bisa deadlock semua request berikutnya */
    }, timeoutMs)
  })

  try {
    return await Promise.race([work, timed])
  } catch (err) {
    work.catch(() => {})
    throw err
  } finally {
    if (to) window.clearTimeout(to)
  }
}

export async function loginRequest(username, password) {
  if (USE_MOCK) return mock.mockLogin(username, password)
  return request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function logoutRequest() {
  if (USE_MOCK) return mock.mockLogout()
  return request('/api/v1/auth/logout', { method: 'POST', timeoutMs: 2500 })
}

function asArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.devices)) return data.devices
  if (Array.isArray(data?.events)) return data.events
  if (Array.isArray(data?.sessions)) return data.sessions
  return []
}

export async function meRequest() {
  if (USE_MOCK) return mock.mockMe()
  const data = await request('/api/v1/auth/me')
  return data?.user || data
}

export async function fetchDevices(query) {
  if (USE_MOCK) return mock.mockDevices(query)
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v && v !== 'all') params.set(k, v)
  })
  const qs = params.toString()
  return asArray(await request(`/api/v1/devices${qs ? `?${qs}` : ''}`))
}

export async function fetchDevice(id) {
  if (USE_MOCK) return mock.mockDevice(id)
  return request(`/api/v1/devices/${id}`)
}

export async function patchDevice(id, payload) {
  if (USE_MOCK) return mock.mockPatchDevice(id, payload)
  return request(`/api/v1/devices/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDevice(id) {
  if (USE_MOCK) return mock.mockDeleteDevice(id)
  return request(`/api/v1/devices/${id}`, { method: 'DELETE' })
}

export async function fetchStats() {
  if (USE_MOCK) return mock.mockStats()
  return request('/api/v1/stats')
}

export async function fetchSessions() {
  if (USE_MOCK) return mock.mockSessions()
  return asArray(await request('/api/v1/sessions'))
}

export async function fetchEvents(query) {
  if (USE_MOCK) return mock.mockEvents(query)
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== 'all') params.set(k, String(v))
  })
  const qs = params.toString()
  return asArray(await request(`/api/v1/events${qs ? `?${qs}` : ''}`))
}

export async function fetchSettings() {
  if (USE_MOCK) return mock.mockSettings()
  return request('/api/v1/settings')
}

export async function saveSettings(payload) {
  if (USE_MOCK) return mock.mockSaveSettings(payload)
  return request('/api/v1/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

function raceMs(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const err = new Error(message)
      err.code = 'TIMEOUT'
      reject(err)
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function normalizeSessionPayload(data, deviceId, bodyExtras) {
  const raw = data?.session || data?.data || data
  const id = raw?.id || raw?.sessionId || data?.id || data?.sessionId
  if (!id) {
    throw new Error('POST /sessions sukses tapi tidak ada id. BE harus kirim { id, sessionId, relayUrl }. BACKEND.md bagian 4.')
  }
  return {
    ...raw,
    id,
    deviceId: raw?.deviceId || deviceId,
    relayUrl:
      raw?.relayUrl ||
      raw?.relay_url ||
      data?.relayUrl ||
      'wss://zerologic.lokanesa.com/relay',
    quality: raw?.quality || bodyExtras.quality,
    access: raw?.access || bodyExtras.access,
  }
}

function mapSessionError(err, deviceId) {
  const msg = String(err?.message || err || '')
  if (err?.code === 'ABORTED') return err
  if (err?.code === 'TIMEOUT' || /timeout|timed out|reqwest|tokio/i.test(msg)) {
    const e = new Error(
      `POST /sessions timeout. deviceId=${deviceId}. Server 201 cepat dari luar console — coba Hubungkan lagi. ${msg.slice(0, 140)}`,
    )
    e.code = 'TIMEOUT'
    return e
  }
  if (/HTTP \d+/.test(msg)) {
    const e = new Error(msg.slice(0, 240))
    const st = msg.match(/HTTP (\d+)/)
    if (st) e.status = Number(st[1])
    return e
  }
  return err instanceof Error ? err : new Error(msg)
}

async function postSessionXhr(payload, signal) {
  return raceMs(
    xhrJson('POST', '/api/v1/sessions', payload, 4000, signal),
    4000,
    'XHR POST /sessions timeout 4s',
  )
}

async function postSessionRust(payload) {
  return raceMs(
    (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      const token = localStorage.getItem('rd_token') || ''
      const text = await invoke('post_api_json', {
        url: `${API_BASE}/api/v1/sessions`,
        token,
        body: JSON.stringify(payload),
      })
      return typeof text === 'string' ? JSON.parse(text) : text
    })(),
    4000,
    'Rust POST /sessions timeout 4s',
  )
}

export async function createSession(deviceId, extras = {}) {
  if (USE_MOCK) return mock.mockCreateSession(deviceId, extras)
  const { signal, ...bodyExtras } = extras
  const payload = {
    deviceId,
    quality: bodyExtras.quality || 'auto',
  }
  if (bodyExtras.access) payload.access = bodyExtras.access

  try {
    let data
    if (import.meta.env.DEV) {
      data = await postSessionXhr(payload, signal)
    } else if (isTauri()) {
      data = await postSessionRust(payload)
    } else {
      data = await postSessionXhr(payload, signal)
    }
    return normalizeSessionPayload(data, deviceId, bodyExtras)
  } catch (err) {
    if (isTauri() && import.meta.env.DEV) {
      try {
        return normalizeSessionPayload(await postSessionRust(payload), deviceId, bodyExtras)
      } catch (rustErr) {
        throw mapSessionError(rustErr, deviceId)
      }
    }
    throw mapSessionError(err, deviceId)
  }
}

export async function endSession(id) {
  if (USE_MOCK) return { ok: true }
  return request(`/api/v1/sessions/${id}/end`, { method: 'POST', timeoutMs: 2500 })
}

export async function deleteEvent(id) {
  if (USE_MOCK) return mock.mockDeleteEvent(id)
  return request(`/api/v1/events/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteEvents() {
  if (USE_MOCK) return mock.mockDeleteEvents()
  return request('/api/v1/events', { method: 'DELETE' })
}

export async function deleteSessionLog(id) {
  if (USE_MOCK) return mock.mockDeleteSessionLog(id)
  return request(`/api/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteSessionLogs() {
  if (USE_MOCK) return mock.mockDeleteSessionLogs()
  return request('/api/v1/sessions?ended=1', { method: 'DELETE' })
}

export function agentDownloadUrl(os) {
  return `${API_BASE}/api/v1/agents/downloads/${os}`
}

export async function fetchAgentDownloads() {
  if (USE_MOCK) return mock.mockAgentDownloads()
  try {
    const data = await request('/api/v1/agents/downloads')
    const raw = asArray(data)
    if (raw.length) return raw
    return ['windows', 'macos', 'linux']
      .map((os) => data?.[os])
      .filter(Boolean)
  } catch (err) {
    if (err.status === 404) return []
    throw err
  }
}

export async function downloadAgent(os, filename) {
  if (USE_MOCK) return mock.mockDownloadAgent(os)
  const token = localStorage.getItem('rd_token')
  const res = await fetch(agentDownloadUrl(os), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const type = res.headers.get('content-type') || ''
  if (!res.ok) {
    let message = `Installer ${os} belum tersedia.`
    if (type.includes('json')) {
      const data = await res.json().catch(() => null)
      message = data?.message || message
    }
    const err = new Error(message)
    err.status = res.status
    err.code = 'INSTALLER_NOT_READY'
    throw err
  }
  if (type.includes('json')) {
    const err = new Error('Installer belum di-upload ke backend.')
    err.status = 404
    err.code = 'INSTALLER_NOT_READY'
    throw err
  }
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const match = cd.match(/filename="?([^"]+)"?/i)
  const name = match?.[1] || filename || `ZerologicAgent-${os}`
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    const { invoke } = await import('@tauri-apps/api/core')
    const data = Array.from(new Uint8Array(await blob.arrayBuffer()))
    try {
      await invoke('save_download', { defaultName: name, data })
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (msg.includes('Dibatalkan')) return
      throw err
    }
    return
  }
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}

export async function uploadAgent(os, file, onProgress) {
  if (USE_MOCK) return mock.mockUploadAgent(os, file)
  const token = localStorage.getItem('rd_token')
  const form = new FormData()
  form.append('file', file)
  form.append('version', '0.3.7')

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', agentDownloadUrl(os))
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    }
    xhr.onload = () => {
      let data = null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = { message: (xhr.responseText || '').slice(0, 180) }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      const err = new Error(data?.message || `Upload gagal (${xhr.status})`)
      err.status = xhr.status
      err.code = data?.code
      reject(err)
    }
    xhr.onerror = () => reject(new Error('Upload gagal (jaringan).'))
    xhr.send(form)
  })
}

export function consoleReleaseUrl() {
  return `${API_BASE}/api/v1/console`
}

export async function uploadConsoleRelease(file, { version, notes }, onProgress) {
  if (USE_MOCK) {
    throw new Error('Upload rilis hanya di Live API, bukan mock.')
  }
  const token = localStorage.getItem('rd_token')
  const form = new FormData()
  form.append('file', file)
  form.append('version', String(version || '').trim())
  if (notes) form.append('notes', String(notes).trim())

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', consoleReleaseUrl())
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    }
    xhr.onload = () => {
      let data = null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = { message: (xhr.responseText || '').slice(0, 180) }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      const raw = data?.message || ''
      const err = new Error(
        xhr.status === 404
          ? 'Backend belum punya PUT /api/v1/console. Lihat BE-ZeroDesk.md bagian upload.'
          : raw || `Upload gagal (${xhr.status})`,
      )
      err.status = xhr.status
      err.code = data?.code
      reject(err)
    }
    xhr.onerror = () => reject(new Error('Upload gagal (jaringan).'))
    xhr.send(form)
  })
}

export function isMockMode() {
  return USE_MOCK
}
