<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ServerTopo from '../components/ServerTopo.vue'
import { useAuth } from '../stores/auth'
import { DEV_URL } from '../utils/developer'
import { openExternal } from '../utils/openExternal'

const router = useRouter()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const success = ref(false)
const successName = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const user = await login(username.value, password.value)
    successName.value = user?.name || user?.username || 'Superadmin'
    success.value = true
    await new Promise((resolve) => window.setTimeout(resolve, 1800))
    await router.push({ name: 'monitor' })
  } catch (err) {
    error.value = err.message || 'Gagal masuk.'
  } finally {
    loading.value = false
  }
}

function visitDeveloper() {
  openExternal(DEV_URL)
}

function onTickerKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    visitDeveloper()
  }
}
</script>

<template>
  <div class="login-split">
    <div
      v-if="success"
      class="welcome-overlay success-overlay"
      role="status"
      aria-live="polite"
    >
      <div class="welcome-grid"></div>
      <div class="welcome-card">
        <div class="success-stamp">OK</div>
        <h1>Login sukses</h1>
        <p class="welcome-tag">Halo, {{ successName }}</p>
        <div class="welcome-bar">
          <i class="is-full"></i>
        </div>
        <p class="welcome-step">Membuka console...</p>
      </div>
    </div>

    <aside class="login-rail">
      <ServerTopo />
    </aside>

    <main class="login-stage">
      <form class="login-form" @submit.prevent="submit">
        <div class="login-brand">
          <div class="brand-mark">Z</div>
          <div class="login-brand__txt">
            <strong>ZeroDesk</strong>
            <span class="login-tag">Superadmin</span>
          </div>
        </div>
        <h2>Masuk console</h2>
        <p class="muted">Hanya akun superadmin yang bisa lanjut.</p>
        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            class="modern-input"
            autocomplete="username"
            placeholder="username"
            :disabled="loading || success"
          />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="modern-input"
            type="password"
            autocomplete="current-password"
            placeholder="password"
            :disabled="loading || success"
          />
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="btn btn--pink" :disabled="loading || success">
          {{ loading ? 'Memeriksa...' : 'Masuk →' }}
        </button>
      </form>
    </main>

    <div
      class="login-ticker"
      role="link"
      tabindex="0"
      @click="visitDeveloper"
      @keydown="onTickerKey"
    >
      <div class="login-ticker__track">
        <div v-for="copy in 2" :key="copy" class="login-ticker__copy">
          <span v-for="n in 6" :key="n" class="login-ticker__item">
            <span class="login-ticker__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.58 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
                />
              </svg>
            </span>
            Visit to developer
            <em>github.com/zlfikrimobiliu</em>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
