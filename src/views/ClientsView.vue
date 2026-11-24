<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AgentDownload from '../components/AgentDownload.vue'
import MapCard from '../components/MapCard.vue'
import OsIcon from '../components/OsIcon.vue'
import { startLive, useLive } from '../stores/live'
import {
  addressOf,
  cityOf,
  formatCoord,
  formatMac,
  gmapsZoomForAccuracy,
  hasCoords,
  isIpEstimate,
  relativeTime,
  statusLabel,
} from '../utils/format'

const router = useRouter()
const { loading, devices, tick, renameDevice, deleteDevice } = useLive()
const selectedId = ref(null)
const q = ref('')
const os = ref('all')
const status = ref('all')
const editingId = ref(null)
const editName = ref('')
const editSaving = ref(false)
const editError = ref('')
const pendingDelete = ref(null)
const deleteSaving = ref(false)
const deleteError = ref('')

onMounted(() => startLive())

function ago(iso) {
  void tick.value
  return relativeTime(iso)
}

const selected = computed(() => devices.value.find((d) => d.id === selectedId.value) || null)
const coord = computed(() => (selected.value ? formatCoord(selected.value) : null))
const mapZoom = computed(() => gmapsZoomForAccuracy(selected.value?.location?.accuracyM))

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return devices.value.filter((d) => {
    if (os.value !== 'all' && d.os !== os.value) return false
    if (status.value !== 'all' && d.status !== status.value) return false
    if (!needle) return true
    const hay = `${d.name} ${d.hostname} ${d.userName} ${d.macAddress} ${d.ipLocal} ${cityOf(d)} ${addressOf(d)}`.toLowerCase()
    return hay.includes(needle)
  })
})

const countLabel = computed(() => `${filtered.value.length} client`)

function selectRow(device) {
  selectedId.value = device.id
}

function goRemote(device) {
  if (device.status === 'offline') return
  router.push({ name: 'remote', params: { deviceId: device.id } })
}

async function startEdit(device) {
  selectedId.value = device.id
  editingId.value = device.id
  editName.value = device.name || ''
  editError.value = ''
  await nextTick()
  document.querySelector('.dev-edit__input')?.focus()
  document.querySelector('.dev-edit__input')?.select()
}

function cancelEdit() {
  editingId.value = null
  editName.value = ''
  editError.value = ''
  editSaving.value = false
}

async function saveEdit(device) {
  const name = editName.value.trim()
  if (!name) {
    editError.value = 'Nama tidak boleh kosong.'
    return
  }
  if (name === device.name) {
    cancelEdit()
    return
  }
  editSaving.value = true
  editError.value = ''
  try {
    await renameDevice(device.id, name)
    cancelEdit()
  } catch (err) {
    editError.value = err.message || 'Gagal simpan nama.'
    editSaving.value = false
  }
}

function askDelete(device) {
  cancelEdit()
  selectedId.value = device.id
  pendingDelete.value = device
  deleteError.value = ''
}

function cancelDelete() {
  if (deleteSaving.value) return
  pendingDelete.value = null
  deleteError.value = ''
}

async function confirmDelete() {
  const device = pendingDelete.value
  if (!device) return
  deleteSaving.value = true
  deleteError.value = ''
  try {
    await deleteDevice(device.id)
    if (selectedId.value === device.id) selectedId.value = null
    pendingDelete.value = null
  } catch (err) {
    const raw = err.message || ''
    deleteError.value =
      err.status === 404 && /page not found/i.test(raw)
        ? 'Backend belum punya endpoint hapus. Implementasikan DELETE /api/v1/devices/:id (lihat BACKEND.md).'
        : raw || 'Gagal hapus client.'
  } finally {
    deleteSaving.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Clients</h2>
      <p class="workspace-desc">Unduh agent per OS, lalu pantau identitas tiap PC: MAC, IP lokal, koordinat.</p>
    </div>

    <AgentDownload />

    <div class="toolbar">
      <input v-model="q" class="modern-input" placeholder="Cari nama / MAC / IP / koordinat" />
      <select v-model="os" class="modern-select">
        <option value="all">Semua OS</option>
        <option value="windows">Windows</option>
        <option value="macos">macOS</option>
        <option value="linux">Linux</option>
      </select>
      <select v-model="status" class="modern-select">
        <option value="all">Semua status</option>
        <option value="online">Online</option>
        <option value="idle">Idle</option>
        <option value="offline">Offline</option>
      </select>
    </div>
    <p class="muted" style="margin-bottom: 12px">{{ countLabel }}</p>
    <span class="sr-only">{{ tick }}</span>

    <div class="grid-2">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>OS</th>
              <th>MAC</th>
              <th>IP lokal</th>
              <th>Koordinat</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="d in filtered"
              :key="d.id"
              :class="{ 'is-selected': selected?.id === d.id }"
              @click="selectRow(d)"
            >
              <td :class="{ 'is-editing': editingId === d.id }">
                <div v-if="editingId === d.id" class="dev-edit" @click.stop>
                  <input
                    v-model="editName"
                    class="modern-input dev-edit__input"
                    maxlength="64"
                    :disabled="editSaving"
                    @keydown.enter.prevent="saveEdit(d)"
                    @keydown.esc.prevent="cancelEdit"
                  />
                  <button class="btn btn--sm btn--lime" type="button" :disabled="editSaving" @click="saveEdit(d)">
                    {{ editSaving ? '...' : 'Simpan' }}
                  </button>
                  <button class="btn btn--sm" type="button" :disabled="editSaving" @click="cancelEdit">Batal</button>
                  <p v-if="editError" class="dev-edit__err">{{ editError }}</p>
                </div>
                <div v-else class="dev-cell">
                  <span class="dev-cell__row">
                    <b>{{ d.name }}</b>
                    <button
                      class="icon-btn"
                      type="button"
                      title="Ubah nama device"
                      @click.stop="startEdit(d)"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M3 17.2V21h3.8l11.2-11.2-3.8-3.8L3 17.2zm17.7-10.9c.4-.4.4-1 0-1.4l-2.6-2.6c-.4-.4-1-.4-1.4 0l-2 2 3.8 3.8 2.2-1.8z"
                        />
                      </svg>
                    </button>
                    <button
                      class="icon-btn icon-btn--danger"
                      type="button"
                      title="Hapus client"
                      @click.stop="askDelete(d)"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2zm4 0h2v9h-2zM7 8h2v10.2c0 .4.3.8.8.8h8.4c.4 0 .8-.4.8-.8V8h2v10.2c0 1.5-1.3 2.8-2.8 2.8H9.8C8.3 21 7 19.7 7 18.2z"
                        />
                      </svg>
                    </button>
                  </span>
                  <div class="muted">{{ d.userName || d.hostname }}</div>
                </div>
              </td>
              <td><OsIcon :os="d.os" :size="20" /></td>
              <td class="mono">{{ formatMac(d.macAddress) }}</td>
              <td class="mono">{{ d.ipLocal || '—' }}</td>
              <td class="mono">{{ cityOf(d) }}</td>
              <td>
                <span class="badge">
                  <i class="status-dot" :class="'status-' + d.status"></i>
                  {{ statusLabel(d.status) }}
                </span>
              </td>
              <td>
                <button class="btn btn--sm btn--lime" type="button" :disabled="d.status === 'offline'" @click.stop="goRemote(d)">
                  Remote
                </button>
              </td>
            </tr>
            <tr v-if="!loading && !filtered.length">
              <td colspan="7">Belum ada client. Unduh agent di atas, install di PC target.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="panel">
        <h3>
          {{ selected ? selected.name : 'Detail client' }}
          <button
            v-if="selected && editingId !== selected.id"
            class="icon-btn"
            type="button"
            title="Ubah nama device"
            @click="startEdit(selected)"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 17.2V21h3.8l11.2-11.2-3.8-3.8L3 17.2zm17.7-10.9c.4-.4.4-1 0-1.4l-2.6-2.6c-.4-.4-1-.4-1.4 0l-2 2 3.8 3.8 2.2-1.8z"
              />
            </svg>
          </button>
        </h3>
        <p v-if="!selected" class="muted">Pilih baris untuk lihat MAC, IP, dan koordinat lengkap.</p>
        <template v-else>
          <div class="detail-grid">
            <div class="kv"><b>Hostname</b>{{ selected.hostname }}</div>
            <div class="kv"><b>User login</b>{{ selected.userName }}</div>
            <div class="kv"><b>OS</b>{{ selected.osVersion }}</div>
            <div class="kv"><b>Agent</b>{{ selected.agentVersion }}</div>
            <div class="kv"><b>MAC address</b><span class="mono">{{ formatMac(selected.macAddress) }}</span></div>
            <div class="kv"><b>IP lokal</b><span class="mono">{{ selected.ipLocal || '—' }}</span></div>
            <div class="kv"><b>IP publik</b><span class="mono">{{ selected.ipPublic || '—' }}</span></div>
            <div class="kv"><b>Last seen</b>{{ ago(selected.lastSeen) }}</div>
          </div>

          <div class="coord-box">
            <b>Lokasi</b>
            <template v-if="coord">
              <p class="coord-box__num">
                {{ coord.lat }}° {{ coord.latHem }}
                <span>·</span>
                {{ coord.lng }}° {{ coord.lngHem }}
              </p>
              <p class="muted">
                akurasi ±{{ selected.location.accuracyM || '—' }} m
                · {{ selected.location.source || 'unknown' }}
              </p>
              <p v-if="isIpEstimate(selected)" class="form-error" style="margin: 8px 0">
                Perkiraan dari IP publik, bukan GPS. Pin bisa salah puluhan km (kota ISP).
                Agent v0.2 pakai Windows Location / WiFi kalau izin lokasi dinyalakan.
              </p>
              <p>{{ addressOf(selected) }}</p>
              <MapCard
                :lat="selected.location.lat"
                :lng="selected.location.lng"
                :zoom="mapZoom"
              />
            </template>
            <p v-else class="muted">
              Koordinat belum dikirim agent. BE + agent harus kirim lat/lng, bukan hanya nama kota.
            </p>
          </div>

          <button class="btn btn--pink btn-block panel-delete" type="button" @click="askDelete(selected)">
            Hapus client
          </button>
        </template>
      </aside>
    </div>

    <Teleport to="body">
      <div
        v-if="pendingDelete"
        class="confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
        @click.self="cancelDelete"
      >
        <div class="confirm-card">
          <h3 id="delete-client-title">Hapus client?</h3>
          <p>
            <b>{{ pendingDelete.name }}</b>
            akan hilang dari daftar Monitor dan Clients.
            Agent di PC itu harus enroll ulang kalau mau muncul lagi.
          </p>
          <p v-if="deleteError" class="dev-edit__err">{{ deleteError }}</p>
          <div class="confirm-card__actions">
            <button class="btn btn--sm" type="button" :disabled="deleteSaving" @click="cancelDelete">
              Batal
            </button>
            <button class="btn btn--sm btn--pink" type="button" :disabled="deleteSaving" @click="confirmDelete">
              {{ deleteSaving ? 'Menghapus...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
