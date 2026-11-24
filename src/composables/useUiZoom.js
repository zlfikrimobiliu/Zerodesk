import { computed, onMounted, onUnmounted, ref } from 'vue'

const STORAGE = 'zl_ui_zoom'
const MIN = 0.7
const MAX = 1.8
const STEP = 0.1

const zoom = ref(1)
let listeners = 0

function clamp(n) {
  const snapped = Math.round(n * 10) / 10
  return Math.min(MAX, Math.max(MIN, snapped))
}

function readStored() {
  const n = Number(localStorage.getItem(STORAGE))
  return Number.isFinite(n) ? clamp(n) : 1
}

function apply(n) {
  zoom.value = clamp(n)
  localStorage.setItem(STORAGE, String(zoom.value))
  document.documentElement.style.removeProperty('zoom')
  document.body.style.removeProperty('zoom')
}

function zoomIn() {
  apply(zoom.value + STEP)
}

function zoomOut() {
  apply(zoom.value - STEP)
}

function resetZoom() {
  apply(1)
}

function onKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
    e.preventDefault()
    zoomIn()
  } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
    e.preventDefault()
    zoomOut()
  } else if (e.key === '0' || e.code === 'Numpad0') {
    e.preventDefault()
    resetZoom()
  }
}

function onWheel(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}

export function useUiZoom() {
  onMounted(() => {
    if (listeners === 0) {
      apply(readStored())
      window.addEventListener('keydown', onKey)
      window.addEventListener('wheel', onWheel, { passive: false })
    }
    listeners += 1
  })

  onUnmounted(() => {
    listeners = Math.max(0, listeners - 1)
    if (listeners === 0) {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
      document.documentElement.style.removeProperty('zoom')
      document.body.style.removeProperty('zoom')
    }
  })

  return {
    zoom,
    zoomPct: computed(() => Math.round(zoom.value * 100)),
    zoomIn,
    zoomOut,
    resetZoom,
  }
}
