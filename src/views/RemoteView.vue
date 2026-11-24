<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createSession, endSession } from '../api/client'
import { connectRelay, sameIpv4Subnet } from '../api/relay'
import OsIcon from '../components/OsIcon.vue'
import { refreshLive, startLive, useLive } from '../stores/live'
import { useUiZoom } from '../composables/useUiZoom'
import { cityOf, formatMac, statusLabel } from '../utils/format'

const route = useRoute()
const { zoom } = useUiZoom()
const { devices } = useLive()
const selectedId = ref(route.params.deviceId || '')
const consoleIp = ref('')
const quality = ref('high')
const connecting = ref(false)
const session = ref(null)
const error = ref('')
const hint = ref('')
const isFullscreen = ref(false)
const viewerEl = ref(null)
const stageEl = ref(null)
const canvasEl = ref(null)
const frameEl = ref(null)
const fileInput = ref(null)
const streamStatus = ref('')
const streamPath = ref('')
const gotFrame = ref(false)
const streamLatency = ref(null)
const ptr = ref({ x: 0, y: 0, on: false })
const inputHeard = ref(false)
const monitorHint = ref('')
let relay = null
let objectUrl = ''
let paintBusy = false
let pendingFrame = null
let moveRaf = 0
let moveQueued = null
let pingTimer = 0
let clickWatch = 0
const connectWait = ref(0)
let waitTimer = 0
let sessionAbort = null

const access = ref({
  control: true,
  clipboard: true,
  files: true,
  audio: false,
  blankHost: false,
  blockInput: false,
})

const selected = computed(() => devices.value.find((d) => d.id === selectedId.value) || null)
const isThisPc = computed(() => {
  const ip = selected.value?.ipLocal
  return Boolean(ip && consoleIp.value && ip === consoleIp.value)
})
const live = computed(() => Boolean(session.value))
const pathLabel = computed(() => {
  if (!session.value) return 'menunggu session'
  const path = streamPath.value || 'relay'
  if (gotFrame.value) {
    const tag = path === 'lan' ? 'LAN langsung' : 'internet relay'
    if (streamLatency.value != null) return `${tag} · ${streamLatency.value} ms`
    return tag
  }
  if (streamStatus.value === 'live') return path === 'lan' ? 'LAN · menunggu frame' : 'relay · menunggu frame'
  return 'menghubungi...'
})

function closeRelay() {
  relay?.close()
  relay = null
  gotFrame.value = false
  streamStatus.value = ''
  streamPath.value = ''
  streamLatency.value = null
  ptr.value = { x: 0, y: 0, on: false }
  inputHeard.value = false
  monitorHint.value = ''
  pendingFrame = null
  window.clearInterval(pingTimer)
  pingTimer = 0
  window.clearTimeout(clickWatch)
  clickWatch = 0
  if (moveRaf) {
    cancelAnimationFrame(moveRaf)
    moveRaf = 0
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

async function flushPaint() {
  if (paintBusy) return
  paintBusy = true
  while (pendingFrame) {
    const job = pendingFrame
    pendingFrame = null
    try {
      const blob = new Blob([job.bytes], { type: 'image/jpeg' })
      const bmp = await createImageBitmap(blob)
      const canvas = canvasEl.value
      if (canvas) {
        if (canvas.width !== bmp.width) canvas.width = bmp.width
        if (canvas.height !== bmp.height) canvas.height = bmp.height
        canvas.getContext('2d').drawImage(bmp, 0, 0)
        gotFrame.value = true
        syncFrame()
      }
      bmp.close()
    } catch {
      /* drop frame */
    }
  }
  paintBusy = false
}

function paintJpeg(bytes, capturedAt = 0) {
  pendingFrame = { bytes, capturedAt }
  flushPaint()
}

function openRelay(ses) {
  closeRelay()
  relay = connectRelay(
    ses,
    {
      onPath(p) {
        streamPath.value = p
        if (p === 'lan') {
          hint.value = 'Jalur LAN langsung (seperti VNC). Klik dan ketik harus instan.'
        } else {
          hint.value =
            'Jalur internet lewat server. Lebih lambat dari VNC/AnyDesk P2P. BE harus drop JPEG lama + forward JSON input (BACKEND.md bagian 7).'
        }
      },
      onStatus(s) {
        streamStatus.value = s
        if (s === 'live') {
          window.clearInterval(pingTimer)
          pingTimer = window.setInterval(() => {
            relay?.send({ type: 'ping', t: Date.now() })
          }, 1000)
        }
        if (s === 'closed' && session.value) {
          hint.value = 'Koneksi putus. Coba Hubungkan lagi.'
        }
      },
      onJpeg: paintJpeg,
      onJson(msg) {
        if (msg?.type === 'pong') {
          const sent = Number(msg.t)
          if (!Number.isFinite(sent) || sent < 1e12) return
          const rtt = Math.round(Date.now() - sent)
          if (rtt >= 0 && rtt < 5000) streamLatency.value = rtt
        }
        if (msg?.type === 'input.ack') {
          inputHeard.value = true
          if (hint.value.includes('klik tidak sampai')) hint.value = ''
        }
        if (msg?.type === 'agent.hello') {
          const n = Number(msg.monitors) || 0
          if (n > 1) {
            monitorHint.value = `${n} monitor · kursor 0–1 = semua layar`
          } else {
            monitorHint.value = ''
          }
        }
        if (msg?.type === 'clipboard.text') {
          writeLocalClipboard(String(msg.text || '')).then(() => {
            hint.value = 'Teks dari remote sudah di clipboard PC ini. Ctrl+V di sini untuk tempel.'
          })
        }
      },
      onError(msg) {
        hint.value = msg
      },
    },
    { lanIp: selected.value?.ipLocal, lanPort: selected.value?.lanPort, consoleIp: consoleIp.value },
  )
}

function syncFrame() {
  const stage = stageEl.value
  const frame = frameEl.value
  const canvas = canvasEl.value
  if (!stage || !frame || !canvas || !canvas.width || !canvas.height) return
  const sw = stage.clientWidth
  const sh = stage.clientHeight
  if (sw < 8 || sh < 8) return
  const fit = Math.min(sw / canvas.width, sh / canvas.height)
  const scale = Math.max(0.15, fit * Number(zoom.value || 1))
  const w = Math.max(2, Math.round(canvas.width * scale))
  const h = Math.max(2, Math.round(canvas.height * scale))
  if (frame.dataset.fw === String(w) && frame.dataset.fh === String(h)) return
  frame.dataset.fw = String(w)
  frame.dataset.fh = String(h)
  frame.style.width = `${w}px`
  frame.style.height = `${h}px`
}

function imageBox() {
  const frame = frameEl.value
  const canvas = canvasEl.value
  if (!frame || !canvas || !canvas.width || !canvas.height) return null
  const box = frame.getBoundingClientRect()
  if (!box.width || !box.height) return null
  return {
    box,
    left: box.left,
    top: box.top,
    w: box.width,
    h: box.height,
  }
}

function normPos(event) {
  const img = imageBox()
  if (!img || img.w < 1 || img.h < 1) return { x: 0, y: 0, inside: false }
  return {
    x: Math.min(1, Math.max(0, (event.clientX - img.left) / img.w)),
    y: Math.min(1, Math.max(0, (event.clientY - img.top) / img.h)),
    inside: true,
  }
}

function updatePtr(event) {
  const img = imageBox()
  if (!img) {
    ptr.value = { x: 0, y: 0, on: false }
    return
  }
  ptr.value = {
    x: Math.min(img.w - 1, Math.max(0, event.clientX - img.left)),
    y: Math.min(img.h - 1, Math.max(0, event.clientY - img.top)),
    on: true,
  }
}

function onStageLeave(event) {
  const stage = stageEl.value
  const next = event.relatedTarget
  if (stage && next && typeof next === 'object' && 'nodeType' in next && stage.contains(next)) {
    return
  }
  ptr.value = { ...ptr.value, on: false }
}

function sendInput(payload) {
  if (!relay) return
  if (String(payload.type || '').startsWith('input.') && !access.value.control) return
  relay.send(payload)
}

function deviceLabel(d) {
  const ip = d?.ipLocal ? ` · ${d.ipLocal}` : ''
  const self = d?.ipLocal && consoleIp.value && d.ipLocal === consoleIp.value ? ' · PC ini' : ''
  return `${d.name}${ip} · ${statusLabel(d.status)}${self}`
}

function pickRemoteTarget(list, localIp) {
  const online = list.filter((d) => d.status && d.status !== 'offline')
  const pool = online.length ? online : list
  if (!pool.length) return ''
  const notSelf = pool.find((d) => d.ipLocal && localIp && d.ipLocal !== localIp)
  return (notSelf || pool[0]).id
}

async function loadConsoleIp() {
  try {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core')
      const ip = await invoke('local_ipv4')
      if (ip) consoleIp.value = ip
    }
  } catch {
    /* browser / invoke belum siap */
  }
}

let unlistenOs = null
let osGrabOn = false

async function startOsGrab() {
  if (osGrabOn) return
  osGrabOn = true
  try {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
      osGrabOn = false
      return
    }
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    await invoke('grab_os_keys')
    unlistenOs = await listen('os-key', (ev) => {
      const p = ev.payload || {}
      if (!session.value || !access.value.control) return
      sendInput({
        type: 'input.key',
        key: p.key || 'Meta',
        code: p.code || 'MetaLeft',
        down: Boolean(p.down),
        sessionId: session.value.id,
      })
    })
  } catch {
    osGrabOn = false
  }
}

async function stopOsGrab() {
  osGrabOn = false
  try {
    if (unlistenOs) {
      unlistenOs()
      unlistenOs = null
    }
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('ungrab_os_keys')
    }
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  startLive()
  await loadConsoleIp()
  if (!selectedId.value) {
    const first = pickRemoteTarget(devices.value, consoleIp.value)
    if (first) selectedId.value = first
  }
  document.addEventListener('fullscreenchange', onFsChange)
  window.addEventListener('resize', syncFrame)
  window.addEventListener('focus', onWinFocus)
  window.addEventListener('blur', onWinBlur)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  document.removeEventListener('keydown', onKey, true)
  document.removeEventListener('keyup', onKey, true)
  window.removeEventListener('resize', syncFrame)
  window.removeEventListener('focus', onWinFocus)
  window.removeEventListener('blur', onWinBlur)
  stopOsGrab()
  closeRelay()
})

watch(session, (s) => {
  document.removeEventListener('keydown', onKey, true)
  document.removeEventListener('keyup', onKey, true)
  if (s) {
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('keyup', onKey, true)
    startOsGrab()
  } else {
    stopOsGrab()
  }
})

function onWinFocus() {
  if (session.value) startOsGrab()
}

function onWinBlur() {
  stopOsGrab()
}

watch(
  () => route.params.deviceId,
  (id) => {
    if (id) selectedId.value = id
  },
)

watch(devices, (list) => {
  if (!selectedId.value) {
    const first = pickRemoteTarget(list, consoleIp.value)
    if (first) selectedId.value = first
  }
})

watch(zoom, () => {
  syncFrame()
})

function onFsChange() {
  isFullscreen.value = document.fullscreenElement === viewerEl.value
}

function sendKey(e, down) {
  sendInput({
    type: 'input.key',
    key: e.key,
    code: e.code,
    down,
    repeat: e.repeat,
    ctrlKey: e.ctrlKey || e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    metaKey: e.metaKey,
    sessionId: session.value.id,
  })
}

function onKey(e) {
  if (e.key === 'F11') {
    e.preventDefault()
    if (e.type === 'keydown') toggleFullscreen()
    return
  }
  if (!session.value || !access.value.control) return
  const tag = e.target && e.target.tagName
  if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
  if (e.isComposing) return
  if (e.key === 'Meta' || e.key === 'OS') {
    e.preventDefault()
    sendKey(e, e.type === 'keydown')
    return
  }
  const chord = (e.ctrlKey || e.metaKey) && !e.altKey
  if (chord && ['+', '=', '-', '_', '0'].includes(e.key)) return
  if (access.value.clipboard && chord && e.code === 'KeyC') {
    e.preventDefault()
    sendKey(e, e.type === 'keydown')
    if (e.type === 'keydown' && !e.repeat) copyFromRemote()
    return
  }
  if (access.value.clipboard && chord && e.code === 'KeyV') {
    e.preventDefault()
    if (e.type === 'keydown' && !e.repeat) pasteToRemote()
    else sendKey(e, e.type === 'keydown')
    return
  }
  e.preventDefault()
  sendKey(e, e.type === 'keydown')
}

function resetLink() {
  sessionAbort = null
  connecting.value = false
  error.value = ''
  hint.value = ''
  session.value = null
  closeRelay()
}

async function connect() {
  error.value = ''
  hint.value = ''
  if (!selected.value) return
  connecting.value = true
  connectWait.value = 0
  window.clearInterval(waitTimer)
  waitTimer = window.setInterval(() => {
    connectWait.value += 1
  }, 1000)
  session.value = null
  closeRelay()
  sessionAbort = new AbortController()
  try {
    session.value = await createSession(selected.value.id, {
      quality: quality.value,
      access: { ...access.value },
      signal: sessionAbort.signal,
    })
    await nextTick()
    openRelay(session.value)
    const targetIp = selected.value?.ipLocal
    if (isThisPc.value) {
      hint.value = 'Ini PC console (Fikri). Boleh di-remote — kamu akan lihat layar sendiri. Untuk mesin kantor pilih DESKTOP di dropdown.'
    } else if (targetIp && consoleIp.value && !sameIpv4Subnet(targetIp, consoleIp.value)) {
      hint.value = `Beda jaringan lokal (console ${consoleIp.value} → client ${targetIp}). Langsung internet relay, skip LAN.`
    } else if (targetIp) {
      hint.value = `Mencoba LAN ${targetIp}:${selected.value.lanPort || 17443} dulu, lalu internet kalau tidak nyambung.`
    } else {
      hint.value = 'Session hidup lewat internet relay.'
    }
    await refreshLive().catch(() => {})
  } catch (err) {
    if (err.code === 'ABORTED') return
    error.value = err.message || 'Gagal memulai session.'
  } finally {
    window.clearInterval(waitTimer)
    waitTimer = 0
    connecting.value = false
    sessionAbort = null
  }
}

function cancelConnect() {
  connecting.value = false
  window.clearInterval(waitTimer)
  waitTimer = 0
  hint.value = 'Dibatalkan.'
  sessionAbort = null
}

async function disconnect() {
  const id = session.value?.id
  if (id) {
    await endSession(id).catch(() => {})
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {})
  }
  resetLink()
}

async function toggleFullscreen() {
  const el = viewerEl.value
  if (!el) return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await el.requestFullscreen()
  } catch (err) {
    hint.value = err.message || 'Fullscreen ditolak sistem.'
  }
}

function needLive() {
  if (!live.value) {
    hint.value = 'Hubungkan dulu. Fitur ini jalan setelah layar agent masuk.'
    return false
  }
  return true
}

function sendCad() {
  if (!needLive() || !access.value.control) return
  sendInput({ type: 'input.cad', sessionId: session.value?.id })
  hint.value = 'Ctrl+Alt+Del dikirim ke agent.'
}

function sendWin() {
  if (!needLive() || !access.value.control) return
  sendInput({ type: 'input.win', sessionId: session.value?.id })
  hint.value = 'Tombol Windows dikirim ke PC remote.'
}

function pickFile() {
  if (!needLive() || !access.value.files) return
  fileInput.value?.click()
}

function onFilePicked(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  hint.value = `Kirim "${file.name}" menunggu datachannel files (agent + relay).`
}

function onPointer(event, down) {
  if (!session.value) return
  event.preventDefault()
  stageEl.value?.focus()
  updatePtr(event)
  const { x, y } = normPos(event)
  sendInput({
    type: 'input.mouse',
    x,
    y,
    button: event.button,
    down,
    sessionId: session.value.id,
  })
  if (down && !inputHeard.value) {
    window.clearTimeout(clickWatch)
    clickWatch = window.setTimeout(() => {
      if (!inputHeard.value && session.value) {
        hint.value =
          'Layar hidup tapi klik tidak sampai agent. BE harus forward JSON console→agent (input.mouse / input.key). Lihat BACKEND.md bagian 7.'
      }
    }, 1600)
  }
}

function onMove(event) {
  if (!session.value) return
  updatePtr(event)
  moveQueued = event
  if (!moveRaf) {
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0
      const ev = moveQueued
      moveQueued = null
      if (!ev) return
      const { x, y } = normPos(ev)
      sendInput({ type: 'input.move', x, y, sessionId: session.value.id })
    })
  }
}

function onWheel(event) {
  if (event.ctrlKey || event.metaKey) return
  if (!session.value) return
  event.preventDefault()
  const { x, y } = normPos(event)
  sendInput({ type: 'input.wheel', x, y, deltaY: event.deltaY, sessionId: session.value.id })
}

async function readLocalClipboard() {
  try {
    return (await navigator.clipboard.readText()) || ''
  } catch {
    return ''
  }
}

async function writeLocalClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch {
    /* WebView kadang tolak clipboard */
  }
}

function copyFromRemote() {
  window.setTimeout(() => {
    relay?.send({ type: 'clipboard.get', sessionId: session.value?.id })
  }, 160)
  hint.value = 'Menyalin dari remote…'
}

async function pasteToRemote() {
  const text = await readLocalClipboard()
  if (!text) {
    hint.value = 'Clipboard PC ini kosong.'
    return
  }
  sendInput({ type: 'clipboard.set', mime: 'text/plain', text, sessionId: session.value?.id })
  sendInput({
    type: 'input.key',
    key: 'v',
    code: 'KeyV',
    down: true,
    ctrlKey: true,
    sessionId: session.value?.id,
  })
  sendInput({
    type: 'input.key',
    key: 'v',
    code: 'KeyV',
    down: false,
    ctrlKey: true,
    sessionId: session.value?.id,
  })
  hint.value = 'Tempel ke remote.'
}

async function copyClipboard() {
  if (!needLive() || !access.value.clipboard) return
  await pasteToRemote()
}
</script>

<template>
  <div class="remote-page">
    <div class="workspace-header" :style="{ zoom: zoom }">
      <h2 class="workspace-title">Remote Session</h2>
      <p class="workspace-desc">
        Klik layar remote dulu. Ctrl+C / Ctrl+V copy-paste. Ctrl+E dan shortcut lain ikut ke remote.
        Tombol Windows fisik ditahan di PC ini selama session (atau klik WIN di bar). Ctrl + / − zoom layar. Dual monitor tampil semua layar.
      </p>
    </div>

    <div class="remote-grid">
      <aside class="panel" :style="{ zoom: zoom }">
        <h3>Target</h3>
        <div class="field" style="margin-bottom: 12px">
          <label>Device</label>
          <select v-model="selectedId" class="modern-select" :disabled="connecting || session" @change="resetLink">
            <option v-if="!devices.length" value="">Belum ada agent</option>
            <option v-for="d in devices" :key="d.id" :value="d.id">
              {{ deviceLabel(d) }}
            </option>
          </select>
        </div>

        <div v-if="selected" class="detail-grid" style="margin-bottom: 16px">
          <div class="kv"><b>OS</b><OsIcon :os="selected.os" :size="20" /></div>
          <div class="kv"><b>User</b>{{ selected.userName }}</div>
          <div class="kv"><b>MAC</b><span class="mono">{{ formatMac(selected.macAddress) }}</span></div>
          <div class="kv"><b>IP lokal</b><span class="mono">{{ selected.ipLocal || '—' }}{{ isThisPc ? ' · PC ini' : '' }}</span></div>
          <div class="kv"><b>Koordinat</b><span class="mono">{{ cityOf(selected) }}</span></div>
          <div class="kv"><b>Latency</b>{{ streamLatency != null ? streamLatency + ' ms' : '—' }}</div>
        </div>

        <p class="access-label">Quality</p>
        <div class="mode-stack" style="margin-bottom: 16px">
          <button
            v-for="q in ['auto', 'high', 'medium', 'low']"
            :key="q"
            type="button"
            class="mode-card"
            :class="{ active: quality === q }"
            :disabled="!!session"
            @click="quality = q"
          >
            <span class="mode-name">Quality {{ q }}</span>
          </button>
        </div>

        <p class="access-label">Full access</p>
        <div class="access-list">
          <label class="switch-row">
            <span>Mouse & keyboard</span>
            <span class="switch"><input v-model="access.control" type="checkbox" /><i class="slider"></i></span>
          </label>
          <label class="switch-row">
            <span>Clipboard copy-paste</span>
            <span class="switch"><input v-model="access.clipboard" type="checkbox" /><i class="slider"></i></span>
          </label>
          <label class="switch-row">
            <span>Transfer file</span>
            <span class="switch"><input v-model="access.files" type="checkbox" /><i class="slider"></i></span>
          </label>
          <label class="switch-row">
            <span>Audio remote</span>
            <span class="switch"><input v-model="access.audio" type="checkbox" /><i class="slider"></i></span>
          </label>
          <label class="switch-row">
            <span>Blank layar host</span>
            <span class="switch"><input v-model="access.blankHost" type="checkbox" /><i class="slider"></i></span>
          </label>
          <label class="switch-row">
            <span>Kunci input host</span>
            <span class="switch"><input v-model="access.blockInput" type="checkbox" /><i class="slider"></i></span>
          </label>
        </div>

        <p v-if="error" class="form-error" style="margin-bottom: 12px">{{ error }}</p>
        <p v-if="hint" class="muted" style="margin-bottom: 12px">{{ hint }}</p>

        <button
          v-if="connecting"
          class="btn btn--pink btn-block"
          type="button"
          @click="cancelConnect"
        >
          Batal ({{ connectWait }}s)
        </button>
        <button
          v-else-if="!session"
          class="btn btn--pink btn-block"
          type="button"
          :disabled="!selected || selected.status === 'offline'"
          @click="connect"
        >
          Hubungkan →
        </button>
        <button v-else class="btn btn--pink btn-block" type="button" @click="disconnect">Tutup session</button>
      </aside>

      <div ref="viewerEl" class="viewer" :class="{ 'is-fs': isFullscreen }">
        <div class="viewer__bar">
          <span>{{ selected?.name || 'Tidak ada target' }} — {{ session ? 'SESSION' : 'STANDBY' }}{{ monitorHint ? ` · ${monitorHint}` : '' }}</span>
          <div class="viewer__tools">
            <span class="viewer__path">{{ pathLabel }}</span>
            <button type="button" title="Ctrl+Alt+Del" :disabled="!live || !access.control" @click="sendCad">CAD</button>
            <button type="button" title="Kirim tombol Windows ke remote" :disabled="!live || !access.control" @click="sendWin">WIN</button>
            <button type="button" title="Kirim file ke PC" :disabled="!live || !access.files" @click="pickFile">File</button>
            <button type="button" title="Tempel clipboard PC ini ke remote (Ctrl+V)" :disabled="!live || !access.clipboard" @click="copyClipboard">Paste</button>
            <button type="button" :title="isFullscreen ? 'Keluar fullscreen (Esc / F11)' : 'Fullscreen layar (F11)'" @click="toggleFullscreen">
              {{ isFullscreen ? 'Keluar' : 'Full' }}
            </button>
          </div>
        </div>
        <input ref="fileInput" class="sr-only" type="file" @change="onFilePicked" />
        <span v-if="session" class="live-tag">SESSION</span>
        <div
          ref="stageEl"
          class="fake-desktop"
          :class="{ 'is-live': gotFrame }"
          tabindex="0"
          @mouseleave="onStageLeave"
          @mousedown="onPointer($event, true)"
          @mouseup="onPointer($event, false)"
          @mousemove="onMove"
          @wheel="onWheel"
          @contextmenu.prevent
        >
          <div
            v-show="gotFrame"
            ref="frameEl"
            class="viewer__frame"
          >
            <canvas
              ref="canvasEl"
              class="viewer__canvas"
            ></canvas>
            <div class="viewer__hit" aria-hidden="true"></div>
            <div
              v-show="gotFrame && ptr.on"
              class="viewer__ptr"
              :style="{ transform: `translate(${ptr.x}px, ${ptr.y}px)` }"
            >
              <svg viewBox="0 0 24 32" aria-hidden="true">
                <path fill="#B9F73E" stroke="#111" stroke-width="1.6" d="M1.2 1.2 L1.2 26.5 L7.2 21.2 L12.6 31 L16.4 29.2 L11 19.4 L21.8 19.4 Z" />
              </svg>
            </div>
          </div>
          <div v-if="session && !gotFrame" class="fake-window">
            <header>{{ session.id }}</header>
            <p>
              Session tercatat. Menunggu frame dari agent v0.3 lewat
              <code>wss://…/relay</code>.
              BE harus: (1) sisipkan session aktif di response heartbeat,
              (2) forward binary JPEG agent → console. Lihat BACKEND.md bagian 7.
            </p>
            <p v-if="session.relayUrl" class="muted">Relay: {{ session.relayUrl }}</p>
          </div>
        </div>
        <div v-if="!gotFrame" class="scanlines"></div>
        <div v-if="!session" class="connect-overlay" :style="{ zoom: zoom }">
          <div style="width: min(420px, 92%)">
            <h3>{{ connecting ? 'Membuat session' : 'Menunggu operator' }}</h3>
            <p>
              {{
                connecting
                  ? `POST /sessions… ${connectWait}s. Server harus 201 + id + relayUrl di bawah 1 detik.`
                  : selected?.status === 'offline'
                    ? 'Device offline. Di Task Manager harus ada 2 proses ZerologicAgent: SYSTEM (service) + user login (--desktop). UAC Not allowed/Disabled itu normal.'
                    : 'Pilih device online di kiri (bukan yang bertanda PC ini), lalu Hubungkan.'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
