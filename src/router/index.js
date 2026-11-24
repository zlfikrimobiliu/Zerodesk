import { createRouter, createWebHistory } from 'vue-router'
import { isAuthed, useAuth } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import LocalSessionView from '../views/LocalSessionView.vue'
import ShellView from '../views/ShellView.vue'

const Empty = { name: 'Empty', render: () => null }

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/local-session/:pcId',
      name: 'local-session',
      component: LocalSessionView,
      meta: { requiresAuth: true, popout: true },
    },
    {
      path: '/',
      component: ShellView,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/monitor' },
        { path: 'monitor', name: 'monitor', component: Empty },
        { path: 'clients', name: 'clients', component: Empty },
        { path: 'remote/:deviceId?', name: 'remote', component: Empty },
        { path: 'local', name: 'local', component: Empty },
        { path: 'local-log', name: 'local-log', component: Empty },
        { path: 'local-sessions', name: 'local-sessions', component: Empty },
        { path: 'log', name: 'log', component: Empty },
        { path: 'sessions', name: 'sessions', component: Empty },
        { path: 'apps', name: 'apps', component: Empty },
        { path: 'docs', name: 'docs', component: Empty },
        { path: 'local-docs', name: 'local-docs', component: Empty },
        { path: 'settings', name: 'settings', component: Empty },
        { path: 'release', name: 'release', component: Empty },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/monitor' },
  ],
})

let bootstrapped = false

router.beforeEach(async (to) => {
  if (!bootstrapped) {
    bootstrapped = true
    await useAuth().hydrate()
  }
  if (to.meta.requiresAuth && !isAuthed()) return { name: 'login' }
  if (to.name === 'login' && isAuthed()) {
    return to.redirectedFrom?.meta?.popout ? false : { name: 'monitor' }
  }
})

export default router
