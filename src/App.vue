<script setup>
import { onMounted, ref } from 'vue'
import { checkConsoleUpdate, startConsoleUpdate } from './api/consoleUpdate'
import BootSplash from './components/BootSplash.vue'

const isPopout = window.location.pathname.startsWith('/local-session')
const booting = ref(!isPopout)
const update = ref(null)
const updating = ref(false)
const updateErr = ref('')
const skipped = ref(false)

onMounted(async () => {
  if (isPopout) return
  update.value = await checkConsoleUpdate()
})

async function applyUpdate() {
  if (updating.value || !update.value?.url) return
  updating.value = true
  updateErr.value = ''
  try {
    await startConsoleUpdate(update.value.url)
  } catch (err) {
    updateErr.value = err.message || 'Gagal unduh update.'
    updating.value = false
  }
}
</script>

<template>
  <BootSplash v-if="booting" @done="booting = false" />
  <div
    v-if="!isPopout && !booting && update && !skipped"
    class="welcome-overlay update-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Update ZeroDesk"
  >
    <div class="welcome-grid"></div>
    <div class="welcome-card">
      <div class="success-stamp">UP</div>
      <h1>Update ZeroDesk</h1>
      <p class="welcome-tag">{{ update.current }} → {{ update.remote }}</p>
      <p v-if="update.notes" class="update-notes">{{ update.notes }}</p>
      <p v-else class="update-notes">Versi baru sudah di server. Pasang dulu sebelum lanjut.</p>
      <p v-if="updateErr" class="form-error">{{ updateErr }}</p>
      <div class="update-actions">
        <button class="btn btn--lime" type="button" :disabled="updating" @click="applyUpdate">
          {{ updating ? 'Mengunduh...' : 'Update sekarang' }}
        </button>
        <button class="btn btn--sm" type="button" :disabled="updating" @click="skipped = true">
          Lanjut dulu
        </button>
      </div>
    </div>
  </div>
  <router-view />
</template>
