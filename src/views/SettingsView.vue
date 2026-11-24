<script setup>
import { onMounted, reactive, ref } from 'vue'
import { fetchSettings, isMockMode, saveSettings } from '../api/client'
import { API_BASE } from '../config'
import { useLive } from '../stores/live'

const { wsConnected } = useLive()
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const form = reactive({
  defaultRelayRegion: 'auto',
  unattendedDefault: true,
  requireConsent: false,
  maxSessionHours: 8,
  recordAudit: true,
  notifyOffline: true,
})

onMounted(async () => {
  try {
    Object.assign(form, await fetchSettings())
  } finally {
    loading.value = false
  }
})

async function submit() {
  error.value = ''
  saved.value = false
  saving.value = true
  try {
    Object.assign(form, await saveSettings({ ...form }))
    saved.value = true
  } catch (err) {
    error.value = err.message || 'Gagal simpan.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="workspace-header">
      <h2 class="workspace-title">Setting</h2>
      <p class="workspace-desc">Aturan default remote global. Perubahan ini nanti disimpan di control plane Go.</p>
    </div>

    <div class="grid-2">
      <form class="panel" @submit.prevent="submit">
        <h3>Remote policy</h3>

        <div class="field" style="margin-bottom: 16px">
          <label for="region">Relay region default</label>
          <select id="region" v-model="form.defaultRelayRegion" class="modern-select">
            <option value="auto">Auto (terdekat)</option>
            <option value="ap-southeast">Singapore</option>
            <option value="ap-northeast">Tokyo</option>
            <option value="eu-west">Frankfurt</option>
            <option value="us-east">Virginia</option>
          </select>
        </div>

        <div class="field" style="margin-bottom: 16px">
          <label for="hours">Batas session (jam)</label>
          <input id="hours" v-model.number="form.maxSessionHours" class="modern-input" type="number" min="1" max="24" />
        </div>

        <label class="switch-row">
          <span><b>Unattended default</b><br /><span class="muted">Agent boleh di-remote tanpa popup izin</span></span>
          <span class="switch">
            <input v-model="form.unattendedDefault" type="checkbox" />
            <span class="slider"></span>
          </span>
        </label>

        <label class="switch-row">
          <span><b>Require consent</b><br /><span class="muted">Client harus klik Izinkan dulu</span></span>
          <span class="switch">
            <input v-model="form.requireConsent" type="checkbox" />
            <span class="slider"></span>
          </span>
        </label>

        <label class="switch-row">
          <span><b>Audit log</b><br /><span class="muted">Catat semua session ke database</span></span>
          <span class="switch">
            <input v-model="form.recordAudit" type="checkbox" />
            <span class="slider"></span>
          </span>
        </label>

        <label class="switch-row">
          <span><b>Notify offline</b><br /><span class="muted">Tandai device yang putus heartbeat</span></span>
          <span class="switch">
            <input v-model="form.notifyOffline" type="checkbox" />
            <span class="slider"></span>
          </span>
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>
        <p v-if="saved" class="muted" style="margin: 8px 0 12px">Tersimpan.</p>
        <button class="btn btn--yellow" :disabled="saving || loading">
          {{ saving ? 'Menyimpan...' : 'Simpan setting' }}
        </button>
      </form>

      <aside class="panel">
        <h3>Koneksi backend</h3>
        <div class="kv" style="margin-bottom: 12px">
          <b>Mode FE</b>
          {{ isMockMode() ? 'Mock lokal (belum hit Go API)' : 'Live API' }}
        </div>
        <div class="kv" style="margin-bottom: 12px">
          <b>Presence</b>
          {{ wsConnected ? 'WebSocket realtime' : 'Polling REST' }}
        </div>
        <div class="kv" style="margin-bottom: 12px">
          <b>API host</b>
          {{ API_BASE }}
        </div>
        <p class="muted">
          Console sudah hit <code>{{ API_BASE }}</code>.
          Device, status, dan event realtime lewat WebSocket presence.
          Remote layar PC masih menunggu agent native.
        </p>
        <div class="about__chips" style="display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.4rem">
          <span class="chip">REST + WebSocket</span>
          <span class="chip">Go control plane</span>
          <span class="chip">PostgreSQL</span>
          <span class="chip">Redis presence</span>
        </div>
      </aside>
    </div>
  </div>
</template>
