import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

function parseVer(v) {
  return String(v || '0')
    .split('.')
    .slice(0, 3)
    .map((n) => {
      const x = Number.parseInt(n, 10)
      return Number.isFinite(x) ? x : 0
    })
    .concat([0, 0, 0])
    .slice(0, 3)
}

export function isNewerVersion(remote, current) {
  const a = parseVer(remote)
  const b = parseVer(current)
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

export async function checkConsoleUpdate() {
  if (!isTauri() || import.meta.env.DEV) return null
  let current = '0.0.0'
  try {
    current = await getVersion()
  } catch {
    return null
  }
  let text = ''
  try {
    text = await invoke('console_latest')
  } catch {
    return null
  }
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  const remote = String(data?.version || '').trim()
  const url = String(data?.url || '').trim()
  if (!remote || !url) return null
  if (!isNewerVersion(remote, current)) return null
  return {
    current,
    remote,
    url,
    notes: String(data?.notes || '').trim(),
  }
}

export async function startConsoleUpdate(url) {
  await invoke('install_console_update', { url })
}

export async function fetchPublishedLatest() {
  if (isTauri()) {
    try {
      const text = await invoke('console_latest')
      const data = JSON.parse(text)
      const version = String(data?.version || '').trim()
      const url = String(data?.url || '').trim()
      if (!version || !url) return null
      return {
        version,
        url,
        notes: String(data?.notes || '').trim(),
        filename: String(data?.filename || url.split('/').pop() || ''),
      }
    } catch {
      return null
    }
  }
  const path = import.meta.env.DEV
    ? '/console/latest.json'
    : 'https://zerologic.lokanesa.com/console/latest.json'
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const data = await res.json()
    const version = String(data?.version || '').trim()
    const url = String(data?.url || '').trim()
    if (!version || !url) return null
    return {
      version,
      url,
      notes: String(data?.notes || '').trim(),
      filename: String(data?.filename || url.split('/').pop() || ''),
    }
  } catch {
    return null
  }
}

export function bumpPatch(version) {
  const parts = parseVer(version)
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}
