<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { isLocalVncApp, onLocalPowerPause, startLocalVnc, stopLocalVnc } from '../api/localVnc'

const MAX_STREAMS = 6
let streamSlots = 0

const props = defineProps({
  pc: { type: Object, required: true },
  live: { type: Boolean, default: false },
})

const wrapEl = ref(null)
const screenEl = ref(null)
const inView = ref(false)
const status = ref('idle')
let rfb = null
let proxyId = null
let gen = 0
let retryTimer = 0
let io = null
let holdingSlot = false
let offPowerPause = null
const powerPaused = ref(false)

function releaseSlot() {
  if (!holdingSlot) return
  holdingSlot = false
  streamSlots = Math.max(0, streamSlots - 1)
}

async function teardown() {
  window.clearTimeout(retryTimer)
  try {
    rfb?.disconnect()
  } catch {
    /* ignore */
  }
  rfb = null
  const id = proxyId
  proxyId = null
  releaseSlot()
  await stopLocalVnc(id)
}

function shouldRun() {
  return Boolean(
    props.live && inView.value && !document.hidden && isLocalVncApp() && !powerPaused.value,
  )
}

async function connect() {
  const my = ++gen
  await teardown()
  if (my !== gen) return
  if (!shouldRun()) {
    status.value = props.live ? 'idle' : 'off'
    return
  }
  if (streamSlots >= MAX_STREAMS) {
    status.value = 'queued'
    retryTimer = window.setTimeout(() => {
      if (shouldRun()) connect()
    }, 1800)
    return
  }
  holdingSlot = true
  streamSlots += 1
  status.value = 'connecting'
  try {
    const started = await startLocalVnc(props.pc.ip, props.pc.port)
    if (my !== gen || !shouldRun()) {
      await stopLocalVnc(started.id)
      releaseSlot()
      return
    }
    proxyId = started.id
    await nextTick()
    const target = screenEl.value
    if (!target) throw new Error('preview')
    const { default: RFB } = await import('@novnc/novnc')
    if (my !== gen) return
    target.innerHTML = ''
    rfb = new RFB(target, started.wsUrl, {
      credentials: props.pc.password ? { password: props.pc.password } : undefined,
      shared: true,
    })
    rfb.viewOnly = true
    rfb.scaleViewport = true
    rfb.clipViewport = true
    rfb.qualityLevel = 0
    rfb.compressionLevel = 9
    rfb.showDotCursor = false
    rfb.addEventListener('credentialsrequired', () => {
      rfb?.sendCredentials({ password: props.pc.password || '' })
    })
    rfb.addEventListener('connect', () => {
      if (my !== gen) return
      status.value = 'live'
    })
    rfb.addEventListener('disconnect', (ev) => {
      if (my !== gen || ev?.detail?.clean) return
      status.value = 'error'
      retryTimer = window.setTimeout(() => {
        if (shouldRun()) connect()
      }, 4000)
    })
  } catch {
    releaseSlot()
    if (my !== gen) return
    status.value = 'error'
    retryTimer = window.setTimeout(() => {
      if (shouldRun()) connect()
    }, 5000)
  }
}

function onVis() {
  if (document.hidden) teardown()
  else if (shouldRun()) connect()
}

watch(
  () => [props.live, props.pc.id, props.pc.ip, props.pc.port, props.pc.password, inView.value, powerPaused.value],
  () => {
    connect()
  },
)

onMounted(() => {
  document.addEventListener('visibilitychange', onVis)
  offPowerPause = onLocalPowerPause((on) => {
    powerPaused.value = Boolean(on)
  })
  io = new IntersectionObserver(
    (entries) => {
      inView.value = entries.some((e) => e.isIntersecting)
    },
    { rootMargin: '80px', threshold: 0.12 },
  )
  if (wrapEl.value) io.observe(wrapEl.value)
})

onUnmounted(() => {
  gen += 1
  document.removeEventListener('visibilitychange', onVis)
  offPowerPause?.()
  io?.disconnect()
  teardown()
})
</script>

<template>
  <div ref="wrapEl" class="local-preview" :data-status="status">
    <div ref="screenEl" class="local-preview__rfb"></div>
    <div v-if="status !== 'live'" class="local-preview__veil">
      <span v-if="!live">Offline</span>
      <span v-else-if="status === 'connecting' || status === 'queued'">Memuat…</span>
      <span v-else-if="status === 'error'">Tidak ada gambar</span>
      <span v-else>Monitor</span>
    </div>
  </div>
</template>
