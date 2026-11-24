import { computed, reactive } from 'vue'
import { loginRequest, logoutRequest, meRequest } from '../api/client'
import { startLive, stopLive } from './live'

const KEY_TOKEN = 'rd_token'
const KEY_USER = 'rd_user'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY_USER) || 'null')
  } catch {
    return null
  }
}

const state = reactive({
  token: localStorage.getItem(KEY_TOKEN) || '',
  user: readUser(),
})

export function isAuthed() {
  return Boolean(state.token)
}

export function getToken() {
  return state.token
}

export function useAuth() {
  const user = computed(() => state.user)
  const authed = computed(() => Boolean(state.token))

  async function login(username, password) {
    const data = await loginRequest(username, password)
    state.token = data.token
    state.user = data.user
    localStorage.setItem(KEY_TOKEN, data.token)
    localStorage.setItem(KEY_USER, JSON.stringify(data.user))
    stopLive()
    startLive()
    return data.user
  }

  async function logout() {
    stopLive()
    try {
      await logoutRequest()
    } catch {
      /* ignore network errors on logout */
    }
    state.token = ''
    state.user = null
    localStorage.removeItem(KEY_TOKEN)
    localStorage.removeItem(KEY_USER)
  }

  async function hydrate() {
    if (!state.token) return
    try {
      const user = await meRequest()
      state.user = user
      localStorage.setItem(KEY_USER, JSON.stringify(user))
      startLive()
    } catch (err) {
      if (err.status !== 401) {
        startLive()
        return
      }
      stopLive()
      state.token = ''
      state.user = null
      localStorage.removeItem(KEY_TOKEN)
      localStorage.removeItem(KEY_USER)
    }
  }

  return { user, authed, login, logout, hydrate }
}
