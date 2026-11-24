<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isMockMode } from '../api/client'
import { useUiZoom } from '../composables/useUiZoom'
import { useAuth } from '../stores/auth'
import { DEV_HANDLE, DEV_URL } from '../utils/developer'
import { openExternal } from '../utils/openExternal'
import { startLive, useLive } from '../stores/live'
import AppsView from './AppsView.vue'
import ClientsView from './ClientsView.vue'
import LocalDocsView from './LocalDocsView.vue'
import LocalLogView from './LocalLogView.vue'
import LocalSessionsView from './LocalSessionsView.vue'
import LocalView from './LocalView.vue'
import LogView from './LogView.vue'
import MonitorView from './MonitorView.vue'
import PublicDocsView from './PublicDocsView.vue'
import RemoteView from './RemoteView.vue'
import ReleaseView from './ReleaseView.vue'
import SessionsView from './SessionsView.vue'
import SettingsView from './SettingsView.vue'
import kickerA from '../assets/kicker-a.png'
import kickerB from '../assets/kicker-b.png'
import kickerC from '../assets/kicker-c.png'

const router = useRouter()
const route = useRoute()
const { user, logout } = useAuth()
const { wsConnected } = useLive()
const { zoom, zoomPct, zoomIn, zoomOut, resetZoom } = useUiZoom()
const leaving = ref(false)
const leavingName = ref('')
const tab = ref(route.name && route.name !== 'login' ? route.name : 'monitor')

startLive()

const linkHint = computed(() => {
  if (isMockMode()) return 'Mock · BE off'
  return wsConnected.value ? 'Live · realtime' : 'Live · REST'
})

const userName = computed(() => user.value?.name || user.value?.username || 'Superadmin')
const userInitial = computed(() => {
  const n = String(userName.value || 'S').trim()
  return (n[0] || 'S').toUpperCase()
})

function visitDeveloper() {
  openExternal(DEV_URL)
}

const KICK_MS = 1100
const kickFrame = ref('a')
const kickHit = ref({ x: 0, y: 0, r: 0 })
let kickRaf = 0

onMounted(() => {
  const origin = performance.now()
  const tick = (now) => {
    const t = ((now - origin) % KICK_MS) / KICK_MS
    let frame = 'a'
    let x = 0
    let y = 0
    let r = 0
    if (t >= 0.22 && t < 0.30) {
      frame = 'b'
    } else if (t >= 0.30 && t < 0.48) {
      frame = 'c'
      const wave = Math.sin(((t - 0.30) / 0.18) * Math.PI)
      x = 9 * wave
      y = -6 * wave
      r = 15 * wave
    }
    kickFrame.value = frame
    kickHit.value = { x, y, r }
    kickRaf = window.requestAnimationFrame(tick)
  }
  kickRaf = window.requestAnimationFrame(tick)
})

onUnmounted(() => {
  window.cancelAnimationFrame(kickRaf)
})

function onKickKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    visitDeveloper()
  }
}

const publicTabs = [
  { name: 'monitor', label: '01 Monitor' },
  { name: 'clients', label: '02 Clients' },
  { name: 'remote', label: '03 Remote' },
  { name: 'log', label: '04 Log' },
  { name: 'sessions', label: '05 Sessions' },
  { name: 'apps', label: '06 Apps' },
  { name: 'docs', label: '07 Docs' },
]

const localTabs = [
  { name: 'local', label: '01 Kantor' },
  { name: 'local-log', label: '02 Log' },
  { name: 'local-sessions', label: '03 Sessions' },
  { name: 'local-docs', label: '04 Docs' },
]

const publicNames = publicTabs.map((t) => t.name)
const localNames = localTabs.map((t) => t.name)
const openPublic = ref(true)
const openLocal = ref(true)

watch(
  () => route.name,
  (name) => {
    if (name && name !== 'login') tab.value = name
    if (publicNames.includes(name)) openPublic.value = true
    if (localNames.includes(name)) openLocal.value = true
  },
  { immediate: true },
)

function isTabOn(name) {
  return tab.value === name
}

function isPublicOn() {
  return publicNames.includes(tab.value)
}

function isLocalOn() {
  return localNames.includes(tab.value)
}

function goTab(name) {
  tab.value = name
  router.replace({ name }).catch(() => {})
}

function onLogout() {
  if (leaving.value) return
  leavingName.value = user.value?.name || user.value?.username || 'Superadmin'
  leaving.value = true
  logout().catch(() => {})
  window.setTimeout(() => {
    window.location.href = '/login'
  }, 500)
}
</script>

<template>
  <div class="shell">
    <div
      v-if="leaving"
      class="welcome-overlay success-overlay"
      role="status"
      aria-live="polite"
    >
      <div class="welcome-grid"></div>
      <div class="welcome-card">
        <div class="success-stamp">OK</div>
        <h1>Keluar sukses</h1>
        <p class="welcome-tag">Sampai jumpa, {{ leavingName }}</p>
        <div class="welcome-bar">
          <i class="is-full"></i>
        </div>
        <p class="welcome-step">Menutup sesi...</p>
      </div>
    </div>

    <aside class="side">
      <button class="side__brand" type="button" @click="goTab('monitor')">
        <span class="brand-mark">Z</span>
        <span>ZeroDesk</span>
      </button>
      <nav class="side__nav">
        <div class="side__group">
          <button
            type="button"
            class="side__group-btn"
            :class="{ 'is-current': isPublicOn() }"
            @click="openPublic = !openPublic"
          >
            Public
          </button>
          <div v-show="openPublic" class="side__sub">
            <button
              v-for="item in publicTabs"
              :key="item.name"
              type="button"
              class="side__link"
              :class="{ active: isTabOn(item.name) }"
              @click="goTab(item.name)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <div class="side__group">
          <button
            type="button"
            class="side__group-btn"
            :class="{ 'is-current': isLocalOn() }"
            @click="openLocal = !openLocal"
          >
            Local
          </button>
          <div v-show="openLocal" class="side__sub">
            <button
              v-for="item in localTabs"
              :key="item.name"
              type="button"
              class="side__link"
              :class="{ active: isTabOn(item.name) }"
              @click="goTab(item.name)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="side__link"
          :class="{ active: isTabOn('settings') }"
          @click="goTab('settings')"
        >
          Setting
        </button>
        <button
          type="button"
          class="side__link"
          :class="{ active: isTabOn('release') }"
          @click="goTab('release')"
        >
          Rilis
        </button>
      </nav>
      <div class="side__foot">
        <p class="side__hint" :class="{ 'is-live': wsConnected }">
          <i class="side__pulse" aria-hidden="true"></i>
          {{ linkHint }}
        </p>
        <div
          class="side__kick"
          role="link"
          tabindex="0"
          :title="DEV_URL"
          @click="visitDeveloper"
          @keydown="onKickKey"
        >
          <span class="side__kick-dude" aria-hidden="true">
            <img class="side__kick-img" :class="{ 'is-on': kickFrame === 'a' }" :src="kickerA" alt="" />
            <img class="side__kick-img" :class="{ 'is-on': kickFrame === 'b' }" :src="kickerB" alt="" />
            <img class="side__kick-img" :class="{ 'is-on': kickFrame === 'c' }" :src="kickerC" alt="" />
          </span>
          <span
            class="side__kick-ico"
            aria-hidden="true"
            :style="{ transform: `translate3d(${kickHit.x}px, ${kickHit.y}px, 0) rotate(${kickHit.r}deg)` }"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
              />
            </svg>
          </span>
          <span class="side__kick-txt">
            <small>Visit GitHub</small>
            <strong>{{ DEV_HANDLE }}</strong>
          </span>
        </div>
      </div>
    </aside>

    <div class="stage">
      <header class="stage__bar">
        <div
          class="zoom-ctrl"
          :title="tab === 'remote' ? 'Zoom layar remote · Ctrl + / − · Ctrl 0 pas' : 'Ctrl + zoom in · Ctrl − zoom out · Ctrl 0 reset'"
        >
          <span class="zoom-ctrl__label">Zoom</span>
          <button class="zoom-ctrl__btn" type="button" aria-label="Perkecil" @click="zoomOut">−</button>
          <button class="zoom-ctrl__val" type="button" aria-label="Reset zoom" @click="resetZoom">{{ zoomPct }}%</button>
          <button class="zoom-ctrl__btn" type="button" aria-label="Perbesar" @click="zoomIn">+</button>
        </div>

        <div class="bar__right">
          <div class="bar__who">
            <span class="bar__avatar">{{ userInitial }}</span>
            <span class="bar__who-txt">
              <strong>{{ userName }}</strong>
              <small>Superadmin</small>
            </span>
          </div>

          <button class="bar__out" type="button" :disabled="leaving" @click="onLogout">
            Keluar
          </button>
        </div>
      </header>
      <main class="stage__body">
          <div class="stage__zoom" :class="{ 'is-remote': tab === 'remote' }" :style="{ zoom: tab === 'remote' ? 1 : zoom }">
          <MonitorView v-if="tab === 'monitor'" />
          <ClientsView v-else-if="tab === 'clients'" />
          <RemoteView v-else-if="tab === 'remote'" />
          <LocalView v-else-if="tab === 'local'" />
          <LocalLogView v-else-if="tab === 'local-log'" />
          <LocalSessionsView v-else-if="tab === 'local-sessions'" />
          <LocalDocsView v-else-if="tab === 'local-docs'" />
          <LogView v-else-if="tab === 'log'" />
          <SessionsView v-else-if="tab === 'sessions'" />
          <AppsView v-else-if="tab === 'apps'" />
          <PublicDocsView v-else-if="tab === 'docs'" />
          <SettingsView v-else-if="tab === 'settings'" />
          <ReleaseView v-else-if="tab === 'release'" />
        </div>
      </main>
    </div>
  </div>
</template>
