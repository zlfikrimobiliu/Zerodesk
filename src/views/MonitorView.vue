<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import OsIcon from '../components/OsIcon.vue'
import { startLive, useLive } from '../stores/live'
import { cityOf, relativeTime, statusLabel } from '../utils/format'

const router = useRouter()
const { loading, error, devices, events, stats, tick, wsConnected } = useLive()
const recent = computed(() => events.value.slice(0, 4))

onMounted(() => startLive())

function ago(iso) {
  void tick.value
  return relativeTime(iso)
}

function openRemote(id, status) {
  if (status === 'offline') return
  router.push({ name: 'remote', params: { deviceId: id } })
}
</script>

<template>
  <div class="monitor">
    <div class="monitor__top">
      <div>
        <h2 class="workspace-title">Monitoring</h2>
        <p class="workspace-desc">
          Offline = PC mati, sleep, atau heartbeat putus.
          <span class="live-flag" :class="wsConnected ? 'is-on' : 'is-off'">
            {{ wsConnected ? 'Realtime WS' : 'REST snapshot' }}
          </span>
        </p>
      </div>
      <div class="stamp-row">
        <div class="stamp stamp--lime"><b>{{ stats.online }}</b><span>online</span></div>
        <div class="stamp stamp--pink"><b>{{ stats.idle }}</b><span>idle</span></div>
        <div class="stamp"><b>{{ stats.offline }}</b><span>offline</span></div>
        <div class="stamp stamp--blue"><b>{{ stats.total }}</b><span>total</span></div>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading && !devices.length" class="muted">Memuat telemetry...</p>

    <div v-else-if="!devices.length" class="empty-panel">
      <h3>Belum ada agent</h3>
      <p class="muted">
        Control plane sudah live, tapi belum ada PC yang heartbeat.
        Enroll agent native dulu — unduh installernya di menu Clients, pilih Windows / macOS / Linux.
      </p>
    </div>

    <div v-else class="device-stack">
      <article
        v-for="d in devices"
        :key="d.id"
        class="device-row"
        @click="openRemote(d.id, d.status)"
      >
        <i class="status-dot" :class="'status-' + d.status"></i>
        <div class="device-row__main">
          <strong>{{ d.name }}</strong>
          <span class="muted">{{ d.userName }} · {{ cityOf(d) }}</span>
        </div>
        <OsIcon :os="d.os" :size="20" />
        <span class="badge">{{ statusLabel(d.status) }}</span>
        <span class="muted">{{ ago(d.lastSeen) }}</span>
        <span class="muted">{{ d.latencyMs ? d.latencyMs + ' ms' : '—' }}</span>
      </article>
    </div>

    <span class="sr-only">{{ tick }}</span>

    <section class="feed-strip">
      <div class="feed-strip__head">
        <h3>Aktivitas terbaru</h3>
        <router-link class="text-link" :to="{ name: 'log' }">Buka log →</router-link>
      </div>
      <div v-if="!recent.length" class="muted">Belum ada event. Jejak lengkap ada di menu Log.</div>
      <div v-else class="feed-strip__list feed-strip__list--teaser">
        <div v-for="ev in recent" :key="ev.id" class="event">
          {{ ev.text }}
          <time>{{ ago(ev.at) }}</time>
        </div>
      </div>
    </section>
  </div>
</template>
