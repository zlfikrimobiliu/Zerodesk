<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const nodes = [
  { code: 'MDC', name: 'DESK-MDC-01', place: 'Manado', d: 'M 8 90 C 80 90 80 28 152 28' },
  { code: 'SGP', name: 'LAP-SGP-04', place: 'Singapore', d: 'M 8 90 C 80 90 80 70 152 70' },
  { code: 'TYO', name: 'SRV-TYO-02', place: 'Tokyo', d: 'M 8 90 C 80 90 80 112 152 112' },
  { code: 'LDN', name: 'PC-LDN-11', place: 'London', d: 'M 8 90 C 80 90 80 154 152 154' },
]

const active = ref(0)
const pkt = ref({ x: 8, y: 90, show: false })
let cycleTimer = 0
let raf = 0

const current = computed(() => nodes[active.value])
const logs = computed(() => [
  `> handshake ${current.value.code} ok`,
  `> tunnel webrtc / relay`,
  `> stream ${current.value.name}`,
])

function measurePath(d) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  return el
}

function runPacket() {
  window.cancelAnimationFrame(raf)
  const path = measurePath(nodes[active.value].d)
  const len = path.getTotalLength()
  const start = performance.now()
  const dur = 1200
  pkt.value = { x: path.getPointAtLength(0).x, y: path.getPointAtLength(0).y, show: true }
  const frame = (now) => {
    const t = Math.min(1, (now - start) / dur)
    const pt = path.getPointAtLength(t * len)
    pkt.value = { x: pt.x, y: pt.y, show: true }
    if (t < 1) raf = window.requestAnimationFrame(frame)
  }
  raf = window.requestAnimationFrame(frame)
}

onMounted(() => {
  runPacket()
  cycleTimer = window.setInterval(() => {
    active.value = (active.value + 1) % nodes.length
  }, 2400)
})

watch(active, () => {
  runPacket()
})

onUnmounted(() => {
  window.clearInterval(cycleTimer)
  window.cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="ops" aria-hidden="true">
    <div class="ops__grid"></div>
    <span class="ops__sweep"></span>

    <div class="ops__board">
      <div class="ops__hub">
        <div class="ops__chassis">
          <i class="ops__br ops__br--tl"></i>
          <i class="ops__br ops__br--tr"></i>
          <i class="ops__br ops__br--bl"></i>
          <i class="ops__br ops__br--br"></i>
          <div class="ops__leds">
            <b></b><b class="alt"></b><b></b>
          </div>
          <div class="ops__screen">
            <span class="ops__scan"></span>
            <span class="ops__hub-mark">Z</span>
            <p class="ops__status">LINK · ACTIVE</p>
            <strong :key="current.code">{{ current.name }}</strong>
            <div class="ops__term">
              <span v-for="(line, i) in logs" :key="current.code + i">{{ line }}</span>
            </div>
          </div>
          <div class="ops__vents">
            <i></i><i></i><i></i><i></i>
          </div>
        </div>
        <p class="ops__hub-label">Control server</p>
      </div>

      <svg class="ops__links" viewBox="0 0 160 180" preserveAspectRatio="none">
        <path
          v-for="(n, i) in nodes"
          :key="n.code"
          :d="n.d"
          :class="{ 'is-on': i === active }"
        />
        <circle
          :cx="pkt.x"
          :cy="pkt.y"
          r="4.5"
          fill="#b9f73e"
          :opacity="pkt.show ? 1 : 0"
        />
      </svg>

      <div class="ops__fleet">
        <p class="ops__fleet-kicker">Remote nodes</p>
        <article
          v-for="(n, i) in nodes"
          :key="n.code"
          class="ops__pc"
          :class="{ 'is-on': i === active }"
        >
          <div class="ops__pc-screen">
            <span class="ops__scan ops__scan--sm"></span>
            <span class="ops__pc-dot"></span>
            <em></em>
            <em></em>
            <em></em>
          </div>
          <footer>
            <strong>{{ n.name }}</strong>
            <small>{{ n.place }}</small>
          </footer>
        </article>
      </div>
    </div>

    <p class="ops__caption">
      <i></i>
      Session
      <strong :key="current.code">{{ current.name }}</strong>
      <span>{{ current.place }}</span>
    </p>
  </div>
</template>
