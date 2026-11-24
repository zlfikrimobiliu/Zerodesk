const now = Date.now()

export const mockUser = {
  id: 'usr_superadmin',
  username: 'fikri',
  name: 'Fikri',
  role: 'superadmin',
  email: 'fikri@zerologic.internal',
}

export const devices = [
  {
    id: 'dev_jkt_01',
    name: 'DESK-JKT-01',
    hostname: 'DESK-JKT-01',
    os: 'windows',
    osVersion: 'Windows 11 24H2',
    arch: 'x64',
    status: 'online',
    userName: 'Budi Santoso',
    department: 'Finance',
    location: { city: 'Jakarta', country: 'Indonesia', region: 'ap-southeast' },
    ipPublic: '103.xx.12.44',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 8_000).toISOString(),
    unattended: true,
    latencyMs: 42,
    cpuPct: 18,
    ramPct: 54,
  },
  {
    id: 'dev_sgp_04',
    name: 'LAP-SGP-04',
    hostname: 'LAP-SGP-04',
    os: 'macos',
    osVersion: 'macOS 15.1',
    arch: 'arm64',
    status: 'online',
    userName: 'Aisha Tan',
    department: 'Ops',
    location: { city: 'Singapore', country: 'Singapore', region: 'ap-southeast' },
    ipPublic: '118.xx.90.11',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 3_000).toISOString(),
    unattended: true,
    latencyMs: 28,
    cpuPct: 11,
    ramPct: 61,
  },
  {
    id: 'dev_ldn_02',
    name: 'WS-LDN-02',
    hostname: 'ws-ldn-02',
    os: 'linux',
    osVersion: 'Ubuntu 24.04',
    arch: 'x64',
    status: 'idle',
    userName: 'James Cole',
    department: 'Engineering',
    location: { city: 'London', country: 'United Kingdom', region: 'eu-west' },
    ipPublic: '51.xx.22.9',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 120_000).toISOString(),
    unattended: true,
    latencyMs: 187,
    cpuPct: 4,
    ramPct: 33,
  },
  {
    id: 'dev_tyo_09',
    name: 'LAP-TYO-09',
    hostname: 'LAP-TYO-09',
    os: 'windows',
    osVersion: 'Windows 11 23H2',
    arch: 'x64',
    status: 'offline',
    userName: 'Yuki Nakamura',
    department: 'Sales',
    location: { city: 'Tokyo', country: 'Japan', region: 'ap-northeast' },
    ipPublic: '126.xx.40.2',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 14 * 3_600_000).toISOString(),
    unattended: true,
    latencyMs: null,
    cpuPct: 0,
    ramPct: 0,
  },
  {
    id: 'dev_dxb_03',
    name: 'DESK-DXB-03',
    hostname: 'DESK-DXB-03',
    os: 'windows',
    osVersion: 'Windows 10 22H2',
    arch: 'x64',
    status: 'online',
    userName: 'Omar Haddad',
    department: 'Warehouse',
    location: { city: 'Dubai', country: 'UAE', region: 'me-central' },
    ipPublic: '94.xx.18.70',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 15_000).toISOString(),
    unattended: true,
    latencyMs: 96,
    cpuPct: 27,
    ramPct: 48,
  },
  {
    id: 'dev_nyc_11',
    name: 'MAC-NYC-11',
    hostname: 'mac-nyc-11',
    os: 'macos',
    osVersion: 'macOS 14.6',
    arch: 'arm64',
    status: 'online',
    userName: 'Maya Brooks',
    department: 'Marketing',
    location: { city: 'New York', country: 'USA', region: 'us-east' },
    ipPublic: '64.xx.201.5',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 6_000).toISOString(),
    unattended: false,
    latencyMs: 241,
    cpuPct: 22,
    ramPct: 70,
  },
  {
    id: 'dev_bdg_22',
    name: 'LAP-BDG-22',
    hostname: 'LAP-BDG-22',
    os: 'windows',
    osVersion: 'Windows 11 24H2',
    arch: 'x64',
    status: 'idle',
    userName: 'Rina Putri',
    department: 'HR',
    location: { city: 'Bandung', country: 'Indonesia', region: 'ap-southeast' },
    ipPublic: '36.xx.77.13',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 540_000).toISOString(),
    unattended: true,
    latencyMs: 55,
    cpuPct: 6,
    ramPct: 41,
  },
  {
    id: 'dev_sgp_kiosk',
    name: 'KIOSK-SG-01',
    hostname: 'kiosk-sg-01',
    os: 'linux',
    osVersion: 'Debian 12',
    arch: 'x64',
    status: 'online',
    userName: 'Kiosk Floor 3',
    department: 'Ops',
    location: { city: 'Singapore', country: 'Singapore', region: 'ap-southeast' },
    ipPublic: '118.xx.90.88',
    agentVersion: '0.1.0',
    lastSeen: new Date(now - 2_000).toISOString(),
    unattended: true,
    latencyMs: 31,
    cpuPct: 9,
    ramPct: 29,
  },
]

const identity = {
  dev_jkt_01: {
    macAddress: 'A4:C3:F0:1B:9E:22',
    ipLocal: '192.168.1.42',
    location: {
      street: 'Jl. Jend. Sudirman Kav. 52–53',
      district: 'Setiabudi',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      postal: '12190',
      country: 'Indonesia',
      region: 'ap-southeast',
      lat: -6.2087634,
      lng: 106.845599,
      accuracyM: 14,
      source: 'gps',
    },
  },
  dev_sgp_04: {
    macAddress: 'F0:18:98:4C:21:AA',
    ipLocal: '192.168.0.18',
    location: {
      street: '1 Raffles Place',
      district: 'Downtown Core',
      city: 'Singapore',
      province: 'Singapore',
      postal: '048616',
      country: 'Singapore',
      region: 'ap-southeast',
      lat: 1.2841683,
      lng: 103.8510482,
      accuracyM: 11,
      source: 'wifi',
    },
  },
  dev_ldn_02: {
    macAddress: '00:1A:2B:3C:4D:5E',
    ipLocal: '10.8.0.21',
    location: {
      street: '10 Downing Street',
      district: 'Westminster',
      city: 'London',
      province: 'England',
      postal: 'SW1A 2AA',
      country: 'United Kingdom',
      region: 'eu-west',
      lat: 51.5033635,
      lng: -0.1276248,
      accuracyM: 22,
      source: 'gps',
    },
  },
  dev_tyo_09: {
    macAddress: '3C:22:FB:88:10:09',
    ipLocal: '192.168.10.9',
    location: {
      street: '2-4-1 Marunouchi',
      district: 'Chiyoda',
      city: 'Tokyo',
      province: 'Tokyo',
      postal: '100-0005',
      country: 'Japan',
      region: 'ap-northeast',
      lat: 35.6812362,
      lng: 139.7671248,
      accuracyM: 18,
      source: 'wifi',
    },
  },
  dev_dxb_03: {
    macAddress: 'B8:27:EB:12:44:03',
    ipLocal: '192.168.50.3',
    location: {
      street: 'Sheikh Zayed Road',
      district: 'Trade Centre',
      city: 'Dubai',
      province: 'Dubai',
      postal: '',
      country: 'UAE',
      region: 'me-central',
      lat: 25.2048493,
      lng: 55.2707828,
      accuracyM: 25,
      source: 'gps',
    },
  },
  dev_nyc_11: {
    macAddress: 'AC:DE:48:00:11:22',
    ipLocal: '192.168.4.11',
    location: {
      street: '350 Fifth Avenue',
      district: 'Midtown',
      city: 'New York',
      province: 'New York',
      postal: '10118',
      country: 'USA',
      region: 'us-east',
      lat: 40.7484405,
      lng: -73.9856644,
      accuracyM: 16,
      source: 'wifi',
    },
  },
  dev_bdg_22: {
    macAddress: 'D4:6D:6D:77:22:01',
    ipLocal: '192.168.1.22',
    location: {
      street: 'Jl. Asia Afrika No. 65',
      district: 'Sumur Bandung',
      city: 'Bandung',
      province: 'Jawa Barat',
      postal: '40111',
      country: 'Indonesia',
      region: 'ap-southeast',
      lat: -6.9210124,
      lng: 107.6098123,
      accuracyM: 19,
      source: 'gps',
    },
  },
  dev_sgp_kiosk: {
    macAddress: 'E4:5F:01:2A:00:01',
    ipLocal: '192.168.30.4',
    location: {
      street: '2 Orchard Turn',
      district: 'Orchard',
      city: 'Singapore',
      province: 'Singapore',
      postal: '238801',
      country: 'Singapore',
      region: 'ap-southeast',
      lat: 1.3039465,
      lng: 103.8317882,
      accuracyM: 9,
      source: 'gps',
    },
  },
}

for (const device of devices) {
  const extra = identity[device.id]
  if (!extra) continue
  device.macAddress = extra.macAddress
  device.ipLocal = extra.ipLocal
  device.location = { ...device.location, ...extra.location }
}

export const sessions = [
  {
    id: 'ses_1008',
    deviceId: 'dev_jkt_01',
    deviceName: 'DESK-JKT-01',
    operator: 'fikri',
    startedAt: new Date(now - 3_600_000).toISOString(),
    endedAt: new Date(now - 3_240_000).toISOString(),
    durationSec: 360,
    path: 'p2p',
    region: 'ap-southeast',
    status: 'ended',
  },
  {
    id: 'ses_1009',
    deviceId: 'dev_sgp_04',
    deviceName: 'LAP-SGP-04',
    operator: 'fikri',
    startedAt: new Date(now - 8_400_000).toISOString(),
    endedAt: new Date(now - 7_920_000).toISOString(),
    durationSec: 480,
    path: 'relay',
    region: 'ap-southeast',
    status: 'ended',
  },
  {
    id: 'ses_1010',
    deviceId: 'dev_nyc_11',
    deviceName: 'MAC-NYC-11',
    operator: 'fikri',
    startedAt: new Date(now - 86_400_000).toISOString(),
    endedAt: new Date(now - 86_040_000).toISOString(),
    durationSec: 360,
    path: 'relay',
    region: 'us-east',
    status: 'ended',
  },
]

export const liveEvents = [
  { id: 1, type: 'online', text: 'LAP-SGP-04 heartbeat OK', at: new Date(now - 3_000).toISOString() },
  { id: 2, type: 'online', text: 'DESK-JKT-01 agent reconnect', at: new Date(now - 8_000).toISOString() },
  { id: 3, type: 'idle', text: 'WS-LDN-02 idle 2 menit', at: new Date(now - 120_000).toISOString() },
  { id: 4, type: 'offline', text: 'LAP-TYO-09 shutdown', at: new Date(now - 14 * 3_600_000).toISOString() },
]

let settings = {
  defaultRelayRegion: 'auto',
  unattendedDefault: true,
  requireConsent: false,
  maxSessionHours: 8,
  recordAudit: true,
  notifyOffline: true,
}

export function wait(ms = 420) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function mockLogin(username, password) {
  await wait(520)
  if (username.trim().toLowerCase() === 'fikri' && password === '4001') {
    return {
      token: 'mock.' + btoa('fikri:superadmin') + '.local',
      user: { ...mockUser },
      expiresIn: 86400,
    }
  }
  const err = new Error('Username atau password salah.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  throw err
}

export async function mockMe() {
  await wait(180)
  return { ...mockUser }
}

export async function mockLogout() {
  await wait(120)
  return { ok: true }
}

export async function mockDevices(query = {}) {
  await wait(280)
  const q = (query.q || '').toLowerCase()
  const os = query.os || 'all'
  const status = query.status || 'all'
  return devices.filter((d) => {
    const hay = `${d.name} ${d.userName} ${d.location.city} ${d.department}`.toLowerCase()
    if (q && !hay.includes(q)) return false
    if (os !== 'all' && d.os !== os) return false
    if (status !== 'all' && d.status !== status) return false
    return true
  })
}

export async function mockDevice(id) {
  await wait(200)
  const device = devices.find((d) => d.id === id)
  if (!device) {
    const err = new Error('Device tidak ditemukan.')
    err.status = 404
    err.code = 'DEVICE_NOT_FOUND'
    throw err
  }
  return { ...device }
}

export async function mockPatchDevice(id, payload) {
  await wait(220)
  const device = devices.find((d) => d.id === id)
  if (!device) {
    const err = new Error('Device tidak ditemukan.')
    err.status = 404
    err.code = 'DEVICE_NOT_FOUND'
    throw err
  }
  const name = String(payload?.name || '').trim()
  if (!name) {
    const err = new Error('Nama device wajib diisi.')
    err.status = 400
    err.code = 'NAME_REQUIRED'
    throw err
  }
  if (name.length > 64) {
    const err = new Error('Nama device maksimal 64 karakter.')
    err.status = 400
    err.code = 'NAME_TOO_LONG'
    throw err
  }
  device.name = name
  device.nameCustom = true
  return { ...device }
}

export async function mockDeleteDevice(id) {
  await wait(220)
  const idx = devices.findIndex((d) => d.id === id)
  if (idx < 0) {
    const err = new Error('Device tidak ditemukan.')
    err.status = 404
    err.code = 'DEVICE_NOT_FOUND'
    throw err
  }
  const device = devices[idx]
  devices.splice(idx, 1)
  liveEvents.unshift({
    id: Date.now(),
    type: 'device_deleted',
    text: `${device.name} dihapus oleh fikri`,
    at: new Date().toISOString(),
  })
  return { ok: true, id }
}

export async function mockDeleteEvent(id) {
  await wait(180)
  const idx = liveEvents.findIndex((e) => String(e.id) === String(id))
  if (idx < 0) {
    const err = new Error('Log tidak ditemukan.')
    err.status = 404
    err.code = 'EVENT_NOT_FOUND'
    throw err
  }
  liveEvents.splice(idx, 1)
  return { ok: true, id }
}

export async function mockDeleteEvents() {
  await wait(220)
  const deleted = liveEvents.length
  liveEvents.length = 0
  return { ok: true, deleted }
}

export async function mockDeleteSessionLog(id) {
  await wait(180)
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx < 0) {
    const err = new Error('Session log tidak ditemukan.')
    err.status = 404
    err.code = 'SESSION_NOT_FOUND'
    throw err
  }
  if (String(sessions[idx].status || '').toLowerCase() === 'active') {
    const err = new Error('Session masih aktif. Tutup dulu, baru hapus log.')
    err.status = 409
    err.code = 'SESSION_ACTIVE'
    throw err
  }
  sessions.splice(idx, 1)
  return { ok: true, id }
}

export async function mockDeleteSessionLogs() {
  await wait(220)
  const keep = sessions.filter((s) => String(s.status || '').toLowerCase() === 'active')
  const deleted = sessions.length - keep.length
  sessions.length = 0
  sessions.push(...keep)
  return { ok: true, deleted }
}

export async function mockStats() {
  await wait(200)
  return {
    total: devices.length,
    online: devices.filter((d) => d.status === 'online').length,
    idle: devices.filter((d) => d.status === 'idle').length,
    offline: devices.filter((d) => d.status === 'offline').length,
    activeSessions: 0,
    regions: 5,
  }
}

export async function mockSessions() {
  await wait(260)
  return [...sessions]
}

export async function mockEvents(query = {}) {
  await wait(160)
  const q = (query.q || '').toLowerCase()
  const type = query.type || 'all'
  let rows = [...liveEvents]
  if (type !== 'all') rows = rows.filter((e) => e.type === type)
  if (q) {
    rows = rows.filter((e) => `${e.text} ${e.deviceName || ''} ${e.operator || ''}`.toLowerCase().includes(q))
  }
  const offset = Number(query.offset) || 0
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 100))
  return rows.slice(offset, offset + limit)
}

export async function mockSettings() {
  await wait(180)
  return { ...settings }
}

export async function mockSaveSettings(payload) {
  await wait(320)
  settings = { ...settings, ...payload }
  return { ...settings }
}

export async function mockCreateSession(deviceId, extras = {}) {
  await wait(240)
  const device = devices.find((d) => d.id === deviceId)
  if (!device) {
    const err = new Error('Device tidak ditemukan.')
    err.status = 404
    throw err
  }
  if (device.status === 'offline') {
    const err = new Error('Device offline. Remote tidak bisa dimulai.')
    err.status = 409
    err.code = 'DEVICE_OFFLINE'
    throw err
  }
  return {
    id: 'ses_' + Math.floor(Math.random() * 9000 + 1000),
    deviceId: device.id,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    relayUrl: 'wss://zerologic.lokanesa.com/relay',
    preferredPath: 'p2p',
    region: device.location.region,
    quality: extras.quality || 'auto',
    access: extras.access || {
      control: true,
      clipboard: true,
      files: true,
      audio: false,
    },
  }
}

let agentCatalog = [
  {
    os: 'windows',
    arch: 'x64',
    version: '0.1.0',
    filename: 'ZerologicAgent-windows-x64.exe',
    sizeBytes: 0,
    sha256: '',
    ready: false,
  },
  {
    os: 'macos',
    arch: 'universal',
    version: '0.1.0',
    filename: 'ZerologicAgent-macos-universal.dmg',
    sizeBytes: 0,
    sha256: '',
    ready: false,
  },
  {
    os: 'linux',
    arch: 'x64',
    version: '0.1.0',
    filename: 'ZerologicAgent-linux-x64.AppImage',
    sizeBytes: 0,
    sha256: '',
    ready: false,
  },
]

export function mockAgentDownloads() {
  return agentCatalog.map((p) => ({ ...p }))
}

export async function mockUploadAgent(os, file) {
  await wait(400)
  const item = agentCatalog.find((p) => p.os === os)
  if (!item) {
    const err = new Error('OS tidak didukung.')
    err.status = 400
    err.code = 'OS_INVALID'
    throw err
  }
  item.ready = true
  item.sizeBytes = file?.size || 0
  item.version = '0.1.0'
  item.sha256 = 'mock'
  return { ...item }
}

export async function mockDownloadAgent(os) {
  await wait(280)
  const pack = mockAgentDownloads().find((p) => p.os === os)
  const blob = new Blob(['Zerologic agent mock binary'], { type: 'application/octet-stream' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = pack?.filename || `ZerologicAgent-${os}`
  a.click()
  URL.revokeObjectURL(href)
}
