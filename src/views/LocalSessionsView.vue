<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useLocalAudit, reloadLocalAudit } from '../stores/localAudit'
import { formatDuration, formatWhen } from '../utils/format'

const { sessions, deleteSession, clearEndedSessions } = useLocalAudit()
const pending = ref(null)
const tick = ref(0)
let timer = 0

function dur(s) {
  void tick.value
  return formatDuration(s.durationSec, s.startedAt, s.status)
}

function isActive(s) {
  return s.status === 'active'
}

function cancel() {
  pending.value = null
}

function confirm() {
  if (!pending.value) return
  if (pending.value.mode === 'all') clearEndedSessions()
  else deleteSession(pending.value.row.id)
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
      <h2 class="workspace-title">Session lokal</h2>
      <p class="workspace-desc">
        Siapa membuka TightVNC LAN ke PC mana, berapa lama. Bukan session agent publik (P2P/relay).
      </p>
    </div>

    <div class="toolbar">
      <button
        class="btn btn--sm btn--pink"
        type="button"
        :disabled="!sessions.some((s) => s.status !== 'active')"
        @click="pending = { mode: 'all' }"
      >
        Hapus yang sudah ended
      </button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Operator</th>
            <th>Kantor</th>
            <th>PC</th>
            <th>Mulai</th>
            <th>Durasi</th>
            <th>Path</th>
            <th>Status</th>
            <th class="col-action">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.id">
            <td>{{ s.id }}</td>
            <td>{{ s.operator || '—' }}</td>
            <td>{{ s.companyName }}</td>
            <td><b>{{ s.pcName }}</b></td>
            <td>{{ formatWhen(s.startedAt) }}</td>
            <td>{{ dur(s) }}</td>
            <td><span class="chip os-linux">{{ s.path }}</span></td>
            <td>{{ s.status }}</td>
            <td class="col-action">
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                title="Hapus session"
                :disabled="isActive(s)"
                @click="pending = { mode: 'one', row: s }"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2zm4 0h2v9h-2zM7 8h2v10.2c0 .4.3.8.8.8h8.4c.4 0 .8-.4.8-.8V8h2v10.2c0 1.5-1.3 2.8-2.8 2.8H9.8C8.3 21 7 19.7 7 18.2z"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="!sessions.length">
            <td colspan="9">Belum ada session lokal. Muncul saat jendela TightVNC LAN dibuka.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="pending" class="confirm-overlay" role="dialog" aria-modal="true" @click.self="cancel">
        <div class="confirm-card">
          <h3>{{ pending.mode === 'all' ? 'Hapus session lokal?' : 'Hapus baris ini?' }}</h3>
          <p v-if="pending.mode === 'all'">Session yang sudah ended dihapus dari console ini. Yang masih aktif tidak ikut.</p>
          <p v-else>
            Hapus audit <b>{{ pending.row.pcName }}</b>?
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
