<script setup>
import { computed, onMounted, ref } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { uploadConsoleRelease } from '../api/client'
import { bumpPatch, fetchPublishedLatest, isNewerVersion } from '../api/consoleUpdate'

const published = ref(null)
const appVersion = ref('0.1.3')
const version = ref('0.1.3')
const notes = ref('')
const file = ref(null)
const loading = ref(true)
const busy = ref(false)
const progress = ref(0)
const error = ref('')
const message = ref('')

const expectedName = computed(() => `ZeroDesk_${version.value || 'x.y.z'}_x64-setup.exe`)

function versionFromFilename(name) {
  const m = String(name || '').match(/ZeroDesk_(\d+\.\d+\.\d+)_x64-setup\.exe$/i)
  return m ? m[1] : ''
}

const fileVersion = computed(() => versionFromFilename(file.value?.name))
const thisPcBehind = computed(
  () => published.value?.version && isNewerVersion(published.value.version, appVersion.value),
)

onMounted(async () => {
  try {
    appVersion.value = await getVersion()
  } catch {
    /* browser / tanpa Tauri */
  }
  published.value = await fetchPublishedLatest()
  version.value = published.value?.version
    ? bumpPatch(published.value.version)
    : appVersion.value
  loading.value = false
})

function onPick(event) {
  file.value = event.target.files?.[0] || null
  error.value = ''
  message.value = ''
}

function formatSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function onUpload() {
  error.value = ''
  message.value = ''
  const ver = String(version.value || '').trim()
  if (!/^\d+\.\d+\.\d+$/.test(ver)) {
    error.value = 'Versi harus x.y.z (contoh 0.1.2).'
    return
  }
  if (!file.value) {
    error.value = 'Pilih file installer .exe dulu.'
    return
  }
  if (!/\.exe$/i.test(file.value.name)) {
    error.value = 'File harus .exe (hasil npm run tauri build).'
    return
  }
  const fromName = versionFromFilename(file.value.name)
  if (fromName && fromName !== ver) {
    error.value = `Nama file ${file.value.name} versi ${fromName}, tapi form ${ver}. Samakan dulu: naikkan versi di tauri.conf.json + package.json, build ulang, baru upload.`
    return
  }
  busy.value = true
  progress.value = 0
  try {
    const updated = await uploadConsoleRelease(
      file.value,
      { version: ver, notes: notes.value },
      (pct) => {
        progress.value = pct
      },
    )
    published.value = {
      version: updated?.version || ver,
      url: updated?.url || `https://zerologic.lokanesa.com/console/${expectedName.value}`,
      notes: updated?.notes || String(notes.value || '').trim(),
      filename: updated?.filename || expectedName.value,
    }
    file.value = null
    notes.value = ''
    version.value = bumpPatch(published.value.version)
    message.value = `Terunggah ${published.value.filename}. Superadmin yang masih di bawah ${published.value.version} akan ditawari update.`
  } catch (err) {
    error.value = err.message || 'Gagal upload.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Rilis</h2>
      <p class="workspace-desc">
        Upload installer <b>ZeroDesk</b> (console superadmin), bukan agent.
        File dari <code>npm run tauri build</code> —
        <code>src-tauri/target/release/bundle/nsis/ZeroDesk_*_x64-setup.exe</code>.
        Setelah masuk server, PC superadmin yang buka app akan dapat dialog update.
      </p>
    </div>

    <p v-if="loading" class="muted">Memuat rilis di server...</p>
    <p v-if="error" class="form-error" style="margin-bottom: 16px">{{ error }}</p>
    <p v-if="message" class="muted" style="margin-bottom: 16px">{{ message }}</p>

    <div class="grid-2">
      <article class="panel">
        <h3>Di server sekarang</h3>
        <template v-if="published">
          <div class="kv" style="margin-bottom: 8px"><b>Versi</b>{{ published.version }}</div>
          <div class="kv" style="margin-bottom: 8px"><b>File</b>{{ published.filename || '—' }}</div>
          <div class="kv" style="margin-bottom: 8px"><b>URL</b><span class="mono">{{ published.url }}</span></div>
          <p v-if="published.notes" class="muted">{{ published.notes }}</p>
        </template>
        <p v-else class="muted">Belum ada rilis. <code>GET /console/latest.json</code> masih 404 — itu normal sampai upload pertama.</p>
        <div class="kv" style="margin-top: 12px"><b>EXE ini</b>{{ appVersion }}</div>
        <p v-if="thisPcBehind" class="form-error" style="margin-top: 12px">
          PC ini masih {{ appVersion }}. Upload ke server tidak memasang update di sini —
          klik <b>Update sekarang</b> di dialog, atau jalankan installer
          <code>ZeroDesk_{{ published.version }}_x64-setup.exe</code> lalu buka ZeroDesk lagi.
        </p>
      </article>

      <form class="panel" @submit.prevent="onUpload">
        <h3>Upload build baru</h3>
        <div class="field" style="margin-bottom: 12px">
          <label for="rel-ver">Versi</label>
          <input
            id="rel-ver"
            v-model="version"
            class="modern-input"
            placeholder="0.1.2"
            :disabled="busy"
          />
        </div>
        <p
          v-if="published && version && !isNewerVersion(version, published.version)"
          class="muted"
          style="margin-bottom: 12px"
        >
          Versi ini tidak lebih tinggi dari {{ published.version }}. File akan diganti, tapi superadmin yang sudah pasang tidak ditawari update.
        </p>
        <div class="field" style="margin-bottom: 12px">
          <label for="rel-notes">Catatan (opsional)</label>
          <input
            id="rel-notes"
            v-model="notes"
            class="modern-input"
            placeholder="Header GitHub, nama ZeroDesk"
            :disabled="busy"
          />
        </div>
        <p class="muted" style="margin-bottom: 8px">Nama di server: <code>{{ expectedName }}</code></p>
        <label class="apps-drop">
          <input type="file" accept=".exe" :disabled="busy" @change="onPick" />
          <span v-if="file">{{ file.name }} ({{ formatSize(file.size) }})</span>
          <span v-else>Pilih ZeroDesk_*_x64-setup.exe</span>
        </label>
        <div v-if="busy" class="apps-progress">
          <i :style="{ width: progress + '%' }"></i>
        </div>
        <button class="btn btn--lime btn-block" :disabled="busy || !file">
          {{ busy ? 'Mengunggah...' : 'Upload rilis' }}
        </button>
      </form>
    </div>
  </div>
</template>
