import { invoke } from '@tauri-apps/api/core'

function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)
}

function openInDom(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (opened) return
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function openExternal(url) {
  if (!url) return
  if (isTauri()) {
    try {
      await invoke('open_external', { url })
      return
    } catch {
      // fall through to DOM open
    }
  }
  openInDom(url)
}
