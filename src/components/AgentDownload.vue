<script setup>
import { computed, onMounted, ref } from 'vue'
import { downloadAgent, fetchAgentDownloads } from '../api/client'
import OsIcon from './OsIcon.vue'

const PACKAGES = [
  {
    os: 'windows',
    label: 'Windows',
    filename: 'ZerologicAgent-windows-x64.exe',
    hint: 'Satu .exe untuk semua PC Windows',
  },
  {
    os: 'macos',
    label: 'macOS',
    filename: 'ZerologicAgent-macos-universal.dmg',
    hint: 'Satu .dmg untuk semua Mac',
  },
  {
    os: 'linux',
    label: 'Linux',
    filename: 'ZerologicAgent-linux-x64.AppImage',
    hint: 'Satu AppImage untuk semua Linux',
  },
]

const selectedOs = ref('windows')
const catalog = ref([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    catalog.value = await fetchAgentDownloads()
  } catch {
    catalog.value = []
  }
})

const current = computed(() => {
  const base = PACKAGES.find((p) => p.os === selectedOs.value)
  const extra = catalog.value.find((p) => p.os === selectedOs.value) || {}
  return { ...base, ...extra }
})

async function onDownload() {
  error.value = ''
  loading.value = true
  try {
    await downloadAgent(selectedOs.value, current.value.filename)
  } catch (err) {
    error.value = err.message || 'Installer belum tersedia di backend.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="dl-panel">
    <div class="dl-panel__copy">
      <h3>Unduh agent</h3>
      <p class="muted">
        Pilih OS dulu. Satu aplikasi client per OS, dipakai banyak user.
        Setelah install, device muncul di tabel ini dengan MAC, IP lokal, dan koordinat.
      </p>
    </div>
    <div class="dl-os">
      <button
        v-for="pack in PACKAGES"
        :key="pack.os"
        type="button"
        class="dl-os__btn"
        :class="{ active: selectedOs === pack.os }"
        @click="selectedOs = pack.os"
      >
        <OsIcon :os="pack.os" :size="22" />
        {{ pack.label }}
      </button>
    </div>
    <div class="dl-meta">
      <span>{{ current.filename }}</span>
      <span>{{ current.hint }}</span>
    </div>
    <p v-if="current.ready === false" class="form-error">
      Installer {{ current.label }} belum di-upload.
      Unggah dari menu <router-link class="text-link" :to="{ name: 'apps' }">Apps</router-link>.
    </p>
    <p v-if="error" class="form-error">{{ error }}</p>
    <button class="btn btn--pink" type="button" :disabled="loading" @click="onDownload">
      {{ loading ? 'Mengunduh...' : 'Unduh ' + current.label }}
    </button>
  </section>
</template>
