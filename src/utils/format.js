export function osLabel(os) {
  if (os === 'windows') return 'Windows'
  if (os === 'macos') return 'macOS'
  if (os === 'linux') return 'Linux'
  return os
}

export function statusLabel(status) {
  if (status === 'online') return 'Online'
  if (status === 'idle') return 'Idle'
  return 'Offline'
}

export function eventTypeLabel(type) {
  if (type === 'online') return 'Online'
  if (type === 'idle') return 'Idle'
  if (type === 'offline') return 'Offline'
  if (type === 'enrolled') return 'Enroll'
  if (type === 'session_start') return 'Remote mulai'
  if (type === 'session_end') return 'Remote selesai'
  if (type === 'device_deleted') return 'Dihapus'
  if (type === 'device_updated') return 'Update'
  if (type === 'connect') return 'Konek LAN'
  if (type === 'disconnect') return 'Putus LAN'
  if (type === 'connect_fail') return 'Gagal konek'
  if (type === 'shutdown') return 'Shutdown'
  if (type === 'reboot') return 'Reboot'
  if (type === 'wake') return 'Hidupkan'
  if (type === 'add_pc') return 'Tambah PC'
  if (type === 'edit_pc') return 'Ubah PC'
  if (type === 'drop_pc') return 'Hapus PC'
  if (type === 'add_company') return 'Tambah kantor'
  if (type === 'drop_company') return 'Hapus kantor'
  return type || 'Event'
}

export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.max(0, Math.floor(diff / 1000))
  if (sec < 60) return `${sec} dtk lalu`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} mnt lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  return `${day} hari lalu`
}

export function locOf(device) {
  return device?.location || {}
}

export function hasCoords(device) {
  const loc = locOf(device)
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return true
}

export function cityOf(device) {
  const loc = locOf(device)
  if (hasCoords(device)) {
    return `${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`
  }
  return loc.district || loc.city || loc.province || loc.country || loc.region || '—'
}

export function addressOf(device) {
  const loc = locOf(device)
  const parts = [loc.street, loc.district, loc.city, loc.province, loc.postal, loc.country]
    .map((v) => (v || '').trim())
    .filter(Boolean)
  return parts.join(', ') || '—'
}

export function formatMac(mac) {
  if (!mac) return '—'
  return String(mac).toUpperCase().replace(/-/g, ':')
}

export function formatCoord(device) {
  if (!hasCoords(device)) return null
  const lat = Number(locOf(device).lat)
  const lng = Number(locOf(device).lng)
  return {
    lat: lat.toFixed(7),
    lng: lng.toFixed(7),
    latHem: lat < 0 ? 'LS' : 'LU',
    lngHem: lng < 0 ? 'BB' : 'BT',
  }
}

export function gmapsEmbed(lat, lng, zoom = 16) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return ''
  return `https://maps.google.com/maps?q=${la},${ln}&z=${zoom}&hl=id&output=embed`
}

export function gmapsLink(lat, lng, zoom = 17) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return ''
  return `https://www.google.com/maps/search/?api=1&query=${la},${ln}`
}

export function isIpEstimate(device) {
  const src = String(locOf(device).source || '').toLowerCase()
  const acc = Number(locOf(device).accuracyM) || 0
  return src === 'ip' || acc >= 5000
}

export function gmapsZoomForAccuracy(accuracyM) {
  const acc = Number(accuracyM) || 40
  if (acc >= 10000) return 10
  if (acc >= 3000) return 11
  if (acc >= 800) return 13
  if (acc <= 20) return 18
  if (acc <= 80) return 16
  return 14
}

export function osmEmbed(device) {
  if (!hasCoords(device)) return ''
  const loc = locOf(device)
  const acc = Number(loc.accuracyM) || 40
  const zoom = acc <= 20 ? 18 : acc <= 80 ? 16 : 15
  return gmapsEmbed(loc.lat, loc.lng, zoom)
}

export function osmLink(device) {
  if (!hasCoords(device)) return ''
  const loc = locOf(device)
  return gmapsLink(loc.lat, loc.lng)
}

export function formatDuration(sec, startedAt, status) {
  let value = sec
  if (value == null || Number.isNaN(Number(value))) {
    if (status === 'active' && startedAt) {
      value = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    } else {
      return '—'
    }
  }
  const m = Math.floor(value / 60)
  const s = value % 60
  return `${m}m ${s}s`
}

export function formatWhen(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
