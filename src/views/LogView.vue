<script setup>
import { computed, onMounted, ref } from 'vue'
import { startLive, useLive } from '../stores/live'
import { eventTypeLabel, formatWhen, relativeTime } from '../utils/format'

const { loading, events, tick, deleteEvent, deleteAllEvents } = useLive()
const q = ref('')
const type = ref('all')
const pending = ref(null)
const saving = ref(false)
const actionError = ref('')

onMounted(() => startLive())

function ago(iso) {
  void tick.value
  return relativeTime(iso)
}

const types = [
  { id: 'all', label: 'Semua' },
  { id: 'enrolled', label: 'Enroll' },
  { id: 'online', label: 'Online' },
  { id: 'idle', label: 'Idle' },
  { id: 'offline', label: 'Offline' },
  { id: 'session_start', label: 'Remote mulai' },
  { id: 'session_end', label: 'Remote selesai' },
  { id: 'device_deleted', label: 'Dihapus' },
]

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return events.value.filter((ev) => {
    if (type.value !== 'all' && ev.type !== type.value) return false
    if (!needle) return true
    const hay = `${ev.text} ${ev.deviceName || ''} ${ev.operator || ''} ${ev.type}`.toLowerCase()
    return hay.includes(needle)
  })
})

const countLabel = computed(() => `${filtered.value.length} log`)

function apiHint(err, path) {
  if (err?.status === 404 || /404 page not found/i.test(String(err?.message || err?.body || ''))) {
    return `Backend belum punya ${path}. Tambah route di Go — BACKEND.md bagian 3.`
  }
  return err?.message || 'Gagal menghapus log.'
}

function askDelete(ev) {
  actionError.value = ''
  pending.value = { mode: 'one', ev }
}

function askClear() {
  actionError.value = ''
  pending.value = { mode: 'all' }
}

function cancel() {
  if (saving.value) return
  pending.value = null
  actionError.value = ''
}

async function confirm() {
  if (!pending.value || saving.value) return
  saving.value = true
  actionError.value = ''
  try {
    if (pending.value.mode === 'all') await deleteAllEvents()
    else await deleteEvent(pending.value.ev.id)
    pending.value = null
  } catch (err) {
    actionError.value = apiHint(err, pending.value.mode === 'all' ? 'DELETE /api/v1/events' : 'DELETE /api/v1/events/:id')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Log publik</h2>
      <p class="workspace-desc">
        Jejak enroll, status PC, remote agent, dan hapus client. Dari control plane publik — bukan TightVNC LAN.
      </p>
    </div>

    <div class="toolbar">
      <input v-model="q" class="modern-input" placeholder="Cari teks / device / operator" />
      <select v-model="type" class="modern-select">
        <option v-for="t in types" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <button
        class="btn btn--sm btn--pink"
        type="button"
        :disabled="!events.length"
        @click="askClear"
      >
        Hapus semua
      </button>
    </div>
    <p class="muted" style="margin-bottom: 12px">{{ countLabel }}</p>
    <span class="sr-only">{{ tick }}</span>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Tipe</th>
            <th>Event</th>
            <th class="col-action">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ev in filtered" :key="ev.id">
            <td>
              <b>{{ ago(ev.at) }}</b>
              <div class="muted">{{ formatWhen(ev.at) }}</div>
            </td>
            <td>
              <span class="badge">{{ eventTypeLabel(ev.type) }}</span>
            </td>
            <td>{{ ev.text }}</td>
            <td class="col-action">
              <button class="icon-btn icon-btn--danger" type="button" title="Hapus log" @click="askDelete(ev)">
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2zm4 0h2v9h-2zM7 8h2v10.2c0 .4.3.8.8.8h8.4c.4 0 .8-.4.8-.8V8h2v10.2c0 1.5-1.3 2.8-2.8 2.8H9.8C8.3 21 7 19.7 7 18.2z"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="!loading && !filtered.length">
            <td colspan="4">Belum ada log. Event muncul saat agent enroll, offline, remote, atau client dihapus.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="pending"
        class="confirm-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="cancel"
      >
        <div class="confirm-card">
          <h3>{{ pending.mode === 'all' ? 'Hapus semua log?' : 'Hapus log ini?' }}</h3>
          <p v-if="pending.mode === 'all'">
            Semua jejak enroll, status, dan remote akan hilang dari control plane.
          </p>
          <p v-else>
            <b>{{ pending.ev.text }}</b>
            akan dihapus permanen.
          </p>
          <p v-if="actionError" class="dev-edit__err">{{ actionError }}</p>
          <div class="confirm-card__actions">
            <button class="btn btn--sm" type="button" :disabled="saving" @click="cancel">Batal</button>
            <button class="btn btn--sm btn--pink" type="button" :disabled="saving" @click="confirm">
              {{ saving ? 'Menghapus...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
