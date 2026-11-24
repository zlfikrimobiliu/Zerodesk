<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLocalAudit, reloadLocalAudit } from '../stores/localAudit'
import { eventTypeLabel, formatWhen, relativeTime } from '../utils/format'

const { events, deleteEvent, clearEvents } = useLocalAudit()
const q = ref('')
const type = ref('all')
const pending = ref(null)
const tick = ref(0)
let timer = 0

const types = [
  { id: 'all', label: 'Semua' },
  { id: 'connect', label: 'Konek LAN' },
  { id: 'disconnect', label: 'Putus LAN' },
  { id: 'connect_fail', label: 'Gagal konek' },
  { id: 'shutdown', label: 'Shutdown' },
  { id: 'reboot', label: 'Reboot' },
  { id: 'wake', label: 'Hidupkan' },
  { id: 'add_pc', label: 'Tambah PC' },
  { id: 'drop_pc', label: 'Hapus PC' },
  { id: 'drop_company', label: 'Hapus kantor' },
]

const filtered = computed(() => {
  void tick.value
  const needle = q.value.trim().toLowerCase()
  return events.value.filter((ev) => {
    if (type.value !== 'all' && ev.type !== type.value) return false
    if (!needle) return true
    const hay = `${ev.text} ${ev.pcName} ${ev.companyName} ${ev.operator} ${ev.type}`.toLowerCase()
    return hay.includes(needle)
  })
})

function ago(iso) {
  void tick.value
  return relativeTime(iso)
}

function cancel() {
  pending.value = null
}

function confirm() {
  if (!pending.value) return
  if (pending.value.mode === 'all') clearEvents()
  else deleteEvent(pending.value.ev.id)
  pending.value = null
}

onMounted(() => {
  reloadLocalAudit()
  timer = window.setInterval(() => {
    tick.value += 1
  }, 1000)
})

onUnmounted(() => {
  window.clearInterval(timer)
})
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Log lokal</h2>
      <p class="workspace-desc">
        Jejak TightVNC LAN, shutdown, reboot, dan Wake-on-LAN. Tersimpan di console ini, bukan backend publik.
      </p>
    </div>

    <div class="toolbar">
      <input v-model="q" class="modern-input" placeholder="Cari PC / kantor / teks" />
      <select v-model="type" class="modern-select">
        <option v-for="t in types" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <button class="btn btn--sm btn--pink" type="button" :disabled="!events.length" @click="pending = { mode: 'all' }">
        Hapus semua
      </button>
    </div>
    <p class="muted" style="margin-bottom: 12px">{{ filtered.length }} log</p>

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
              <button class="icon-btn icon-btn--danger" type="button" title="Hapus log" @click="pending = { mode: 'one', ev }">
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2zm4 0h2v9h-2zM7 8h2v10.2c0 .4.3.8.8.8h8.4c.4 0 .8-.4.8-.8V8h2v10.2c0 1.5-1.3 2.8-2.8 2.8H9.8C8.3 21 7 19.7 7 18.2z"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="4">Belum ada log lokal. Event muncul saat Hubungkan, shutdown, reboot, atau hidupkan PC LAN.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="pending" class="confirm-overlay" role="dialog" aria-modal="true" @click.self="cancel">
        <div class="confirm-card">
          <h3>{{ pending.mode === 'all' ? 'Hapus semua log lokal?' : 'Hapus log ini?' }}</h3>
          <p v-if="pending.mode === 'all'">Jejak TightVNC LAN di console ini akan dihapus. Log publik tidak ikut.</p>
          <p v-else>
            <b>{{ pending.ev.text }}</b>
            akan dihapus dari console ini.
          </p>
          <div class="confirm-card__actions">
            <button class="btn btn--sm" type="button" @click="cancel">Batal</button>
            <button class="btn btn--sm btn--pink" type="button" @click="confirm">Hapus</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
