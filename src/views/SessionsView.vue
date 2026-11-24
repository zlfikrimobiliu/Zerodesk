<script setup>
import { onMounted, ref } from 'vue'
import { startLive, useLive } from '../stores/live'
import { formatDuration, formatWhen } from '../utils/format'

const { loading, sessions, tick, deleteSessionLog, deleteAllSessionLogs } = useLive()
const pending = ref(null)
const saving = ref(false)
const actionError = ref('')

onMounted(() => startLive())

function dur(s) {
  void tick.value
  return formatDuration(s.durationSec, s.startedAt, s.status)
}

function isActive(s) {
  return String(s?.status || '').toLowerCase() === 'active'
}

function apiHint(err, path) {
  if (err?.status === 404 || /404 page not found/i.test(String(err?.message || err?.body || ''))) {
    return `Backend belum punya ${path}. Tambah route di Go — BACKEND.md bagian 4.`
  }
  return err?.message || 'Gagal menghapus session log.'
}

function askDelete(row) {
  actionError.value = ''
  pending.value = { mode: 'one', row }
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
    if (pending.value.mode === 'all') await deleteAllSessionLogs()
    else await deleteSessionLog(pending.value.row.id)
    pending.value = null
  } catch (err) {
    actionError.value = apiHint(
      err,
      pending.value.mode === 'all' ? 'DELETE /api/v1/sessions?ended=1' : 'DELETE /api/v1/sessions/:id',
    )
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Session publik</h2>
      <p class="workspace-desc">Audit remote agent: siapa ke PC mana, berapa lama, P2P atau relay. Bukan session TightVNC LAN.</p>
    </div>

    <div class="toolbar">
      <button
        class="btn btn--sm btn--pink"
        type="button"
        :disabled="!sessions.length"
        @click="askClear"
      >
        Hapus yang sudah ended
      </button>
    </div>

    <span class="sr-only">{{ tick }}</span>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Operator</th>
            <th>Device</th>
            <th>Mulai</th>
            <th>Durasi</th>
            <th>Path</th>
            <th>Region</th>
            <th>Status</th>
            <th class="col-action">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessions" :key="s.id">
            <td>{{ s.id }}</td>
            <td>{{ s.operator }}</td>
            <td><b>{{ s.deviceName }}</b></td>
            <td>{{ formatWhen(s.startedAt) }}</td>
            <td>{{ dur(s) }}</td>
            <td>
              <span class="chip" :class="s.path === 'p2p' ? 'os-linux' : 'os-windows'">
                {{ s.path }}
              </span>
            </td>
            <td>{{ s.region }}</td>
            <td>{{ s.status }}</td>
            <td class="col-action">
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                title="Hapus log session"
                :disabled="isActive(s)"
                @click="askDelete(s)"
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
          <tr v-if="!loading && !sessions.length">
            <td colspan="9">Belum ada session.</td>
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
          <h3>{{ pending.mode === 'all' ? 'Hapus session log?' : 'Hapus baris ini?' }}</h3>
          <p v-if="pending.mode === 'all'">
            Semua session yang sudah <b>ended</b> / failed dihapus. Session yang masih aktif tidak ikut.
          </p>
          <p v-else>
            Hapus audit <b>{{ pending.row.id }}</b>
            ({{ pending.row.deviceName }})?
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
