<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchAgentDownloads, uploadAgent } from '../api/client'
import OsIcon from '../components/OsIcon.vue'

const PACKAGES = [
  { os: 'windows', label: 'Windows', filename: 'ZerologicAgent-windows-x64.exe', accept: '.exe', arch: 'x64' },
  { os: 'macos', label: 'macOS', filename: 'ZerologicAgent-macos-universal.dmg', accept: '.dmg', arch: 'universal' },
  { os: 'linux', label: 'Linux', filename: 'ZerologicAgent-linux-x64.AppImage', accept: '.AppImage,.appimage', arch: 'x64' },
]

const catalog = ref([])
const loading = ref(true)
const error = ref('')
const busyOs = ref('')
const progress = ref({})
const message = ref({})
const picks = ref({})

onMounted(loadCatalog)

async function loadCatalog() {
  loading.value = true
  error.value = ''
  try {
    catalog.value = await fetchAgentDownloads()
  } catch (err) {
    catalog.value = []
    error.value = err.message || 'Gagal muat katalog installer.'
  } finally {
    loading.value = false
  }
}

function itemOf(os) {
  const base = PACKAGES.find((p) => p.os === os)
  const extra = catalog.value.find((p) => p.os === os) || {}
  return { ...base, ...extra }
}

function formatSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function shortHash(hash) {
  if (!hash) return '—'
  const s = String(hash)
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s
}

function onPick(os, event) {
  const file = event.target.files?.[0]
  message.value = { ...message.value, [os]: '' }
  picks.value = { ...picks.value, [os]: file || null }
}

async function onUpload(os) {
  const file = picks.value[os]
  if (!file) {
    message.value = { ...message.value, [os]: 'Pilih file dulu.' }
    return
  }
  error.value = ''
  busyOs.value = os
  progress.value = { ...progress.value, [os]: 0 }
  message.value = { ...message.value, [os]: '' }
  try {
    const updated = await uploadAgent(os, file, (pct) => {
      progress.value = { ...progress.value, [os]: pct }
    })
    const row = updated?.os
      ? updated
      : { ...itemOf(os), ready: true, sizeBytes: file.size, version: updated?.version || '0.1.0' }
    catalog.value = catalog.value.filter((p) => p.os !== os).concat(row)
    picks.value = { ...picks.value, [os]: null }
    message.value = { ...message.value, [os]: `Terunggah: ${row.filename || file.name}` }
  } catch (err) {
    const raw = err.message || ''
    message.value = {
      ...message.value,
      [os]:
        err.status === 404 && /page not found/i.test(raw)
          ? 'Backend belum punya endpoint upload. Implementasikan PUT /api/v1/agents/downloads/:os (lihat BACKEND.md).'
          : raw || 'Gagal upload.',
    }
  } finally {
    busyOs.value = ''
  }
}

const cards = computed(() => PACKAGES.map((p) => itemOf(p.os)))
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Apps</h2>
      <p class="workspace-desc">
        Upload installer agent dari sini. Setelah masuk server, tombol Unduh di Clients langsung hidup.
        Build baru Windows: pilih <code>ZerologicAgent-windows-x64.exe</code> di AGENT-REMOTESYSTEM/dist, lalu <b>Ganti Windows</b>.
        Linux: pilih <code>ZerologicAgent-linux-x64.AppImage</code> (Docker build, lihat README agent), lalu <b>Upload Linux</b>.
        Karyawan Windows jalankan exe v0.3 (UAC). Karyawan Linux: <code>chmod +x</code> lalu jalankan AppImage di sesi desktop (X11).
      </p>
    </div>

    <p v-if="error" class="form-error" style="margin-bottom: 16px">{{ error }}</p>
    <p v-if="loading" class="muted">Memuat katalog...</p>

    <div class="apps-grid">
      <article v-for="pack in cards" :key="pack.os" class="panel">
        <h3>
          <OsIcon :os="pack.os" :size="22" />
          {{ pack.label }}
        </h3>
        <div class="kv" style="margin-bottom: 8px"><b>File</b>{{ pack.filename }}</div>
        <div class="kv" style="margin-bottom: 8px">
          <b>Status</b>
          {{ pack.ready ? 'Siap diunduh' : 'Belum ada di server' }}
        </div>
        <div class="kv" style="margin-bottom: 8px"><b>Versi</b>{{ pack.version || '—' }}</div>
        <div class="kv" style="margin-bottom: 8px"><b>Ukuran</b>{{ formatSize(pack.sizeBytes) }}</div>
        <div class="kv" style="margin-bottom: 14px"><b>SHA256</b><span class="mono">{{ shortHash(pack.sha256) }}</span></div>

        <label class="apps-drop">
          <input
            type="file"
            :accept="pack.accept"
            :disabled="busyOs === pack.os"
            @change="onPick(pack.os, $event)"
          />
          <span v-if="picks[pack.os]">{{ picks[pack.os].name }} ({{ formatSize(picks[pack.os].size) }})</span>
          <span v-else>Pilih {{ pack.accept }}</span>
        </label>

        <div v-if="busyOs === pack.os" class="apps-progress">
          <i :style="{ width: (progress[pack.os] || 0) + '%' }"></i>
        </div>
        <p v-if="message[pack.os]" class="muted" style="margin: 8px 0">{{ message[pack.os] }}</p>
        <button
          class="btn btn--lime btn-block"
          type="button"
          :disabled="busyOs === pack.os || !picks[pack.os]"
          @click="onUpload(pack.os)"
        >
          {{ busyOs === pack.os ? 'Mengunggah...' : pack.ready ? 'Ganti ' + pack.label : 'Upload ' + pack.label }}
        </button>
      </article>
    </div>
  </div>
</template>
