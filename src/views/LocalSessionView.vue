<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isLocalVncApp, startLocalVnc, stopLocalVnc } from '../api/localVnc'
import { useAuth } from '../stores/auth'
import { useLocalAudit } from '../stores/localAudit'
import { useLocalSites } from '../stores/localSites'

const route = useRoute()
const { companies } = useLocalSites()
const { user } = useAuth()
const { addEvent, startSession, endSession } = useLocalAudit()
const error = ref('')
const status = ref('Menghubungi TightVNC…')
const isFullscreen = ref(false)
const screenEl = ref(null)
const viewerEl = ref(null)
let rfb = null
let proxyId = null
let closed = false
let sessionId = null

const pcId = computed(() => decodeURIComponent(String(route.params.pcId || '')))
const found = computed(() => {
  for (const company of companies.value) {
    const pc = company.pcs.find((p) => p.id === pcId.value)
    if (pc) return { company, pc }
  }
  return null
})

async function grabKeys(on) {
  if (!isLocalVncApp()) return
  try {
    await invoke(on ? 'grab_os_keys' : 'ungrab_os_keys')
  } catch {
    /* ignore */
  }
}

async function teardown() {
  if (closed) return
  closed = true
  if (sessionId) {
    endSession(sessionId)
    sessionId = null
  }
  try {
    rfb?.disconnect()
  } catch {
    /* ignore */
  }
  rfb = null
  await stopLocalVnc(proxyId)
  proxyId = null
  await grabKeys(false)
}

async function connect() {
  error.value = ''
  const row = found.value
  if (!row) {
    error.value = 'PC tidak ada di daftar local console ini.'
    return
  }
  if (!isLocalVncApp()) {
    error.value = 'Buka dari aplikasi desktop Zerologic.'
    return
  }
  status.value = `Menghubungi ${row.pc.ip}:${row.pc.port}…`
  try {
    const started = await startLocalVnc(row.pc.ip, row.pc.port)
    if (closed) {
      await stopLocalVnc(started.id)
      return
    }
    proxyId = started.id
    await nextTick()
    const { default: RFB } = await import('@novnc/novnc')
    const target = screenEl.value
    if (!target) throw new Error('Layar viewer belum siap.')
    target.innerHTML = ''
    rfb = new RFB(target, started.wsUrl, {
      credentials: row.pc.password ? { password: row.pc.password } : undefined,
      shared: true,
    })
    rfb.scaleViewport = true
    rfb.resizeSession = false
    rfb.addEventListener('credentialsrequired', () => {
      rfb?.sendCredentials({ password: row.pc.password || '' })
    })
    rfb.addEventListener('connect', () => {
      status.value = `LAN ${row.pc.ip}:${row.pc.port} · Ctrl+C/V clipboard`
      grabKeys(true)
      if (!sessionId) {
        sessionId = startSession({
          pcId: row.pc.id,
          pcName: row.pc.name,
          companyName: row.company.name,
          operator: user.value?.name || user.value?.username || 'Superadmin',
          ip: `${row.pc.ip}:${row.pc.port}`,
        })
      }
    })
    rfb.addEventListener('clipboard', (ev) => {
      const text = ev?.detail?.text
      if (typeof text === 'string') writeLocalClipboard(text)
    })
    rfb.addEventListener('disconnect', (ev) => {
      if (closed || ev?.detail?.clean) return
      error.value = 'TightVNC terputus.'
    })
  } catch (err) {
    error.value = err.message || 'Gagal konek TightVNC.'
    addEvent({
      type: 'connect_fail',
      text: `Gagal konek TightVNC ${row?.pc?.name || pcId.value}: ${error.value}`,
      pcName: row?.pc?.name || '',
      companyName: row?.company?.name || '',
      operator: user.value?.name || user.value?.username || 'Superadmin',
    })
  }
}

async function toggleFullscreen() {
  const el = viewerEl.value
  if (!el) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  } catch (err) {
    error.value = err.message || 'Fullscreen ditolak.'
  }
}

async function writeLocalClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch {
    /* WebView kadang tolak clipboard */
  }
}

async function readLocalClipboard() {
  try {
    return (await navigator.clipboard.readText()) || ''
  } catch {
    return ''
  }
}

function sendCtrlV() {
  if (!rfb) return
  rfb.sendKey(0xffe3, 'ControlLeft', true)
  rfb.sendKey(0x0076, 'KeyV', true)
  rfb.sendKey(0x0076, 'KeyV', false)
  rfb.sendKey(0xffe3, 'ControlLeft', false)
}

async function pasteLocalToRemote() {
  if (!rfb) return
  const text = await readLocalClipboard()
  rfb.clipboardPasteFrom(text)
  window.setTimeout(sendCtrlV, 40)
}

function onClipKey(e) {
  if (closed || !rfb) return
  const chord = (e.ctrlKey || e.metaKey) && !e.altKey
  if (!chord || e.code !== 'KeyV') return
  e.preventDefault()
  e.stopPropagation()
  if (e.type === 'keydown' && !e.repeat) pasteLocalToRemote()
}

function onFs() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

async function closeWindow() {
  await teardown()
  try {
    await WebviewWindow.getCurrent().close()
  } catch {
    window.close()
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFs)
  window.addEventListener('keydown', onClipKey, true)
  document.title = found.value
    ? `${found.value.company.name} · ${found.value.pc.name}`
    : 'Local TightVNC'
  connect()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFs)
  window.removeEventListener('keydown', onClipKey, true)
  teardown()
})
</script>

<template>
  <div class="local-pop">
    <header class="local-pop__bar">
      <strong>{{ found ? `${found.company.name} · ${found.pc.name}` : 'Local' }}</strong>
      <span class="muted">{{ status }}</span>
      <span class="local-pop__grow"></span>
      <button class="btn btn--sm" type="button" @click="pasteLocalToRemote">Paste</button>
      <button class="btn btn--sm" type="button" @click="toggleFullscreen">
        {{ isFullscreen ? 'Keluar layar penuh' : 'Layar penuh' }}
      </button>
      <button class="btn btn--sm btn--pink" type="button" @click="closeWindow">Tutup</button>
    </header>
    <p v-if="error" class="form-error">{{ error }}</p>
    <div ref="viewerEl" class="local-viewer local-pop__view">
      <div ref="screenEl" class="local-screen" tabindex="0"></div>
    </div>
  </div>
</template>
