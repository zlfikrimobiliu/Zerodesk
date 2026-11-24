<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import OsIcon from './OsIcon.vue'

const STEPS = [
  'Handshake control plane',
  'Load identity mesh',
  'Index agent catalog',
  'Siap masuk console',
]

const emit = defineEmits(['done'])

const leaving = ref(false)
const step = ref(0)
const progress = ref(0)

let stepTimer
let barTimer
let leaveTimer
let doneTimer

onMounted(() => {
  stepTimer = window.setInterval(() => {
    step.value = Math.min(STEPS.length - 1, step.value + 1)
  }, 700)
  barTimer = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 2.6)
  }, 80)
  leaveTimer = window.setTimeout(() => {
    leaving.value = true
  }, 3000)
  doneTimer = window.setTimeout(() => {
    emit('done')
  }, 3400)
})

onUnmounted(() => {
  window.clearInterval(stepTimer)
  window.clearInterval(barTimer)
  window.clearTimeout(leaveTimer)
  window.clearTimeout(doneTimer)
})
</script>

<template>
  <div
    class="welcome-overlay"
    :class="{ 'is-leaving': leaving }"
    role="dialog"
    aria-modal="true"
    aria-label="Loading ZeroDesk"
  >
    <div class="welcome-grid"></div>
    <div class="welcome-scan"></div>
    <div class="welcome-card">
      <p class="welcome-kicker">Loading</p>
      <div class="welcome-mark">
        <span class="welcome-ring"></span>
        <span class="welcome-ring welcome-ring--2"></span>
        <div class="brand-mark brand-mark--lg">Z</div>
      </div>
      <h1>ZeroDesk</h1>
      <p class="welcome-tag">Menyiapkan console superadmin</p>
      <div class="welcome-bar">
        <i :style="{ width: progress + '%' }"></i>
      </div>
      <p class="welcome-step">{{ Math.round(progress) }}% · {{ STEPS[step] }}</p>
      <ul class="welcome-log">
        <li v-for="(line, i) in STEPS" :key="line" :class="{ done: i <= step }">
          {{ line }}
        </li>
      </ul>
      <div class="welcome-os">
        <OsIcon os="windows" :size="20" />
        <OsIcon os="macos" :size="20" />
        <OsIcon os="linux" :size="20" />
      </div>
    </div>
  </div>
</template>
