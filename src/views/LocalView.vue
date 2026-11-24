<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import LocalPcPreview from '../components/LocalPcPreview.vue'
import { isPrivateIp } from '../api/relay'
import {
  isLocalVncApp,
  listConsoleIpv4,
  openLocalSessionWindow,
  localPower,
  lookupMac,
  powerViaTightVnc,
  probeTcp,
  wakeOnLan,
} from '../api/localVnc'
import { useLocalSites } from '../stores/localSites'
import { useLocalAudit } from '../stores/localAudit'
import { useAuth } from '../stores/auth'
import { companyOnThisLan } from '../utils/lanMatch'

const {
  companies,
  companyCount,
  pcCount,
  addCompany,
  updateCompany,
  removeCompany,
  addPc,
  updatePc,
  removePc,
} = useLocalSites()
const { user } = useAuth()
const { addEvent } = useLocalAudit()

const consoleIps = ref([])
const probes = reactive({})
const probing = ref(false)
const selectedId = ref('')
const error = ref('')
const hint = ref('')
const connectingId = ref('')
const powerId = ref('')
const companyQ = ref('')
const pcQ = ref('')
const pcFilter = ref('all')
const showAddPc = ref(false)
const companyForm = reactive({ name: '', subnet: '', notes: '' })
const pcForm = reactive({ name: '', ip: '', port: 5900, password: '', mac: '', winUser: '', winPassword: '', notes: '' })
const editingCompany = ref(false)
const editingPcId = ref('')
const didAutoPick = ref(false)
const pending = ref(null)
let probeTimer = 0

const selected = computed(() => companies.value.find((c) => c.id === selectedId.value) || null)

const hereIds = computed(() => {
  const set = new Set()
  for (const company of companies.value) {
    const probed = (company.pcs || []).some((pc) => probes[pc.id]?.ok)
    if (probed || companyOnThisLan(company, consoleIps.value)) set.add(company.id)
  }
  return set
})

const hereCompany = computed(() => {
  const live = companies.value.find((c) => (c.pcs || []).some((pc) => probes[pc.id]?.ok))
  if (live) return live
  return companies.value.find((c) => hereIds.value.has(c.id)) || null
})

const reachableCount = computed(() => Object.values(probes).filter((p) => p?.ok).length)

const filteredCompanies = computed(() => {
  const needle = companyQ.value.trim().toLowerCase()
  if (!needle) return companies.value
  return companies.value.filter((c) => c.name.toLowerCase().includes(needle) || c.subnet.toLowerCase().includes(needle))
})

const filteredPcs = computed(() => {
  const pcs = selected.value?.pcs || []
  const needle = pcQ.value.trim().toLowerCase()
  return pcs.filter((pc) => {
    const online = Boolean(probes[pc.id]?.ok)
    if (pcFilter.value === 'online' && !online) return false
    if (pcFilter.value === 'offline' && online) return false
    if (!needle) return true
    return `${pc.name} ${pc.ip} ${pc.port}`.toLowerCase().includes(needle)
  })
})

function onlineCount(company) {
  return (company.pcs || []).filter((pc) => probes[pc.id]?.ok).length
}

function isOnline(pc) {
  return Boolean(probes[pc.id]?.ok)
}

async function mapPool(items, limit, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i
      i += 1
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

async function refreshNet() {
  consoleIps.value = await listConsoleIpv4()
  if (!companies.value.length) return
  probing.value = true
  try {
    const seen = new Set()
    const targets = []
    const pushPc = (pc) => {
      if (!pc || seen.has(pc.id)) return
      seen.add(pc.id)
      targets.push(pc)
    }
    for (const pc of selected.value?.pcs || []) pushPc(pc)
    for (const company of companies.value) {
      if (company.id === selectedId.value) continue
      for (const pc of (company.pcs || []).slice(0, 2)) pushPc(pc)
    }
    await mapPool(targets, 10, async (pc) => {
      probes[pc.id] = await probeTcp(pc.ip, pc.port)
      if (probes[pc.id]?.ok || !pc.mac) await rememberMac(pc)
    })
  } finally {
    probing.value = false
  }
}

function selectCompany(company) {
  selectedId.value = company.id
  editingCompany.value = false
  editingPcId.value = ''
  showAddPc.value = false
  pcQ.value = ''
  pcFilter.value = 'all'
  resetPcForm()
  error.value = ''
  hint.value = ''
  refreshNet()
}

function operatorName() {
  return user.value?.name || user.value?.username || 'Superadmin'
}

function officeName() {
  return selected.value?.name || ''
}

function companyIdOf(pc) {
  for (const company of companies.value) {
    if (company.pcs.some((row) => row.id === pc.id)) return company.id
  }
  return selectedId.value
}

async function rememberMac(pc) {
  const mac = await lookupMac(pc.ip)
  if (!mac) return mac
  const id = companyIdOf(pc)
  if (id && mac !== String(pc.mac || '').toUpperCase()) {
    updatePc(id, pc.id, { mac })
  }
  return mac
}

function resetPcForm() {
  pcForm.name = ''
  pcForm.ip = ''
  pcForm.port = 5900
  pcForm.password = ''
  pcForm.mac = ''
  pcForm.winUser = ''
  pcForm.winPassword = ''
  pcForm.notes = ''
}

function resetCompanyForm() {
  companyForm.name = ''
  companyForm.subnet = ''
  companyForm.notes = ''
}

function submitCompany() {
  error.value = ''
  const name = companyForm.name.trim()
  if (!name) {
    error.value = 'Nama perusahaan wajib.'
    return
  }
  if (editingCompany.value && selected.value) {
    updateCompany(selected.value.id, { ...companyForm, name })
    editingCompany.value = false
  } else {
    const company = addCompany({ ...companyForm, name })
    selectedId.value = company.id
    addEvent({
      type: 'add_company',
      text: `Kantor ${name} ditambah`,
      companyName: name,
      operator: operatorName(),
    })
  }
  resetCompanyForm()
}

function startEditCompany() {
  if (!selected.value) return
  editingCompany.value = true
  companyForm.name = selected.value.name
  companyForm.subnet = selected.value.subnet
  companyForm.notes = selected.value.notes
}

function dropCompany() {
  if (!selected.value) return
  pending.value = {
    kind: 'drop-company',
    title: 'Hapus kantor?',
    body: `Hapus ${selected.value.name} dan semua PC-nya dari console ini?`,
    confirm: 'Hapus',
    danger: true,
  }
}

function submitPc() {
  error.value = ''
  if (!selected.value) {
    error.value = 'Pilih perusahaan dulu.'
    return
  }
  const ip = pcForm.ip.trim()
  if (!isPrivateIp(ip) && ip !== '127.0.0.1') {
    error.value = 'IP harus LAN (10.x / 172.16-31.x / 192.168.x).'
    return
  }
  const payload = {
    name: pcForm.name.trim() || ip,
    ip,
    port: Number(pcForm.port) || 5900,
    password: pcForm.password,
    mac: pcForm.mac,
    winUser: pcForm.winUser,
    winPassword: pcForm.winPassword,
    notes: pcForm.notes,
  }
  if (editingPcId.value) {
    updatePc(selected.value.id, editingPcId.value, payload)
    addEvent({
      type: 'edit_pc',
      text: `PC ${payload.name} (${payload.ip}) diubah`,
      pcName: payload.name,
      companyName: officeName(),
      operator: operatorName(),
    })
    editingPcId.value = ''
  } else {
    addPc(selected.value.id, payload)
    addEvent({
      type: 'add_pc',
      text: `PC ${payload.name} (${payload.ip}) ditambah`,
      pcName: payload.name,
      companyName: officeName(),
      operator: operatorName(),
    })
  }
  resetPcForm()
  showAddPc.value = false
  refreshNet()
}

function startEditPc(pc) {
  editingPcId.value = pc.id
  showAddPc.value = true
  pcForm.name = pc.name
  pcForm.ip = pc.ip
  pcForm.port = pc.port
  pcForm.password = pc.password
  pcForm.mac = pc.mac || ''
  pcForm.winUser = pc.winUser || ''
  pcForm.winPassword = pc.winPassword || ''
  pcForm.notes = pc.notes
}

function cancelEditPc() {
  editingPcId.value = ''
  resetPcForm()
  showAddPc.value = false
}

function dropPc(pc) {
  if (!selected.value) return
  pending.value = {
    kind: 'drop-pc',
    pc,
    title: 'Hapus PC?',
    body: `Hapus ${pc.name} dari daftar kantor ini? Mesin tidak ikut dimatikan.`,
    confirm: 'Hapus',
    danger: true,
  }
}

async function openPcWindow(pc, company) {
  error.value = ''
  hint.value = ''
  if (!isLocalVncApp()) {
    error.value = 'Buka aplikasi desktop Zerologic (Tauri) di PC superadmin, bukan browser.'
    return
  }
  connectingId.value = pc.id
  try {
    await openLocalSessionWindow(pc, company)
    hint.value = `Jendela ${pc.name} dibuka.`
  } catch (err) {
    error.value = err.message || 'Gagal buka jendela TightVNC.'
    addEvent({
      type: 'connect_fail',
      text: `Gagal buka jendela ${pc.name}: ${error.value}`,
      pcName: pc.name,
      companyName: company?.name || officeName(),
      operator: operatorName(),
    })
  } finally {
    connectingId.value = ''
  }
}

function onPcContext(event, pc, company) {
  event.preventDefault()
  openPcWindow(pc, company)
}

function askPower(pc, action) {
  const label = action === 'reboot' ? 'Reboot' : 'Matikan'
  pending.value = {
    kind: 'power',
    pc,
    action,
    title: action === 'reboot' ? 'Reboot PC?' : 'Matikan PC?',
    body: `${label} ${pc.name} (${pc.ip}) sekarang? Pekerjaan yang belum disimpan akan hilang.`,
    confirm: label,
    danger: action !== 'reboot',
  }
}

async function askWake(pc) {
  error.value = ''
  hint.value = ''
  let mac = String(pc.mac || '').trim()
  if (!mac) {
    mac = (await rememberMac(pc)) || ''
  }
  if (!mac) {
    error.value = `MAC ${pc.name} belum tercatat. Isi di Ubah PC, atau nyalakan mesin itu sekali supaya tercatat otomatis.`
    return
  }
  pending.value = {
    kind: 'wake',
    pc,
    title: 'Hidupkan PC?',
    body: `Kirim Wake-on-LAN ke ${pc.name} (${mac})? BIOS/adapter harus mengizinkan Wake on LAN, dan PC terhubung kabel LAN (bukan hanya Wi-Fi).`,
    confirm: 'Hidupkan',
    danger: false,
  }
}

async function fetchFormMac() {
  error.value = ''
  const ip = pcForm.ip.trim()
  if (!ip) {
    error.value = 'Isi IP dulu, lalu ambil MAC dari LAN.'
    return
  }
  const mac = await lookupMac(ip)
  if (!mac) {
    error.value = 'MAC belum muncul di ARP. PC harus online di LAN ini.'
    return
  }
  pcForm.mac = mac
  hint.value = `MAC ${mac} diambil dari LAN.`
}

function cancelPending() {
  if (powerId.value) return
  pending.value = null
}

async function confirmPending() {
  const job = pending.value
  if (!job || powerId.value) return
  pending.value = null
  if (job.kind === 'drop-company') {
    const id = selected.value?.id
    if (!id) return
    addEvent({
      type: 'drop_company',
      text: `Kantor ${selected.value.name} dihapus`,
      companyName: selected.value.name,
      operator: operatorName(),
    })
    removeCompany(id)
    selectedId.value = ''
    return
  }
  if (job.kind === 'drop-pc') {
    if (!selected.value || !job.pc) return
    addEvent({
      type: 'drop_pc',
      text: `PC ${job.pc.name} dihapus dari ${selected.value.name}`,
      pcName: job.pc.name,
      companyName: selected.value.name,
      operator: operatorName(),
    })
    removePc(selected.value.id, job.pc.id)
    if (editingPcId.value === job.pc.id) cancelEditPc()
    return
  }
  if (job.kind === 'power') await runPower(job.pc, job.action)
  if (job.kind === 'wake') await runWake(job.pc)
}

async function runPower(pc, action) {
  error.value = ''
  hint.value = ''
  const label = action === 'reboot' ? 'Reboot' : 'Matikan'
  powerId.value = `${pc.id}:${action}`
  try {
    const msg = await powerViaTightVnc(pc, action)
    hint.value = msg
    addEvent({
      type: action === 'reboot' ? 'reboot' : 'shutdown',
      text: `${label} ${pc.name} (${pc.ip}) lewat TightVNC`,
      pcName: pc.name,
      companyName: officeName(),
      operator: operatorName(),
    })
  } catch (vncErr) {
    try {
      const msg = await localPower(pc.ip, action, pc.winUser, pc.winPassword)
      hint.value = msg || `${pc.name}: perintah ${label.toLowerCase()} dikirim (RPC).`
      addEvent({
        type: action === 'reboot' ? 'reboot' : 'shutdown',
        text: `${label} ${pc.name} (${pc.ip}) lewat RPC`,
        pcName: pc.name,
        companyName: officeName(),
        operator: operatorName(),
      })
    } catch (rpcErr) {
      error.value = [
        vncErr?.message,
        rpcErr?.message,
        `Gagal ${label.toLowerCase()} ${pc.name}. Pastikan user sedang login dan TightVNC tidak view-only.`,
      ]
        .filter(Boolean)
        .join(' ')
    }
  } finally {
    powerId.value = ''
  }
}

async function runWake(pc) {
  error.value = ''
  hint.value = ''
  let mac = String(pc.mac || '').trim()
  if (!mac) mac = (await rememberMac(pc)) || ''
  if (!mac) {
    error.value = `MAC ${pc.name} belum tercatat.`
    return
  }
  powerId.value = `${pc.id}:wake`
  try {
    hint.value = await wakeOnLan(mac, pc.ip)
    addEvent({
      type: 'wake',
      text: `Wake-on-LAN ${pc.name} (${pc.ip} · ${mac})`,
      pcName: pc.name,
      companyName: officeName(),
      operator: operatorName(),
    })
    for (let i = 0; i < 12; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500))
      const result = await probeTcp(pc.ip, pc.port)
      probes[pc.id] = result
      if (result.ok) {
        hint.value = `${pc.name} sudah online.`
        await rememberMac(pc)
        return
      }
      hint.value = `Menunggu ${pc.name} nyala… (${i + 1}/12)`
    }
    hint.value = `Paket WOL sudah dikirim ke ${pc.name}. Jika belum nyala, cek Wake on LAN di BIOS dan kabel LAN.`
  } catch (err) {
    error.value = err.message || `Gagal hidupkan ${pc.name}.`
  } finally {
    powerId.value = ''
  }
}

watch(
  () => hereCompany.value?.id,
  (id) => {
    if (id && !didAutoPick.value && !selectedId.value) {
      selectedId.value = id
      didAutoPick.value = true
    }
  },
)

onMounted(() => {
  refreshNet()
  probeTimer = window.setInterval(refreshNet, 8000)
  window.addEventListener('keydown', onPendingEsc)
})

onUnmounted(() => {
  window.clearInterval(probeTimer)
  window.removeEventListener('keydown', onPendingEsc)
})

function onPendingEsc(event) {
  if (event.key === 'Escape') cancelPending()
}
</script>

<template>
  <div class="local-page">
    <div class="workspace-header">
      <div>
        <h2 class="workspace-title">Local</h2>
        <p class="workspace-desc">
          Pilih perusahaan di kiri, lalu PC kantor itu tampil di kanan. Klik layar / Hubungkan / klik kanan = jendela kontrol.
        </p>
      </div>
      <div class="stamp-row">
        <div class="stamp stamp--lime">
          <b>{{ companyCount }}</b>
          <span>Kantor</span>
        </div>
        <div class="stamp">
          <b>{{ pcCount }}</b>
          <span>PC</span>
        </div>
        <div class="stamp" :class="{ 'stamp--lime': reachableCount }">
          <b>{{ reachableCount }}</b>
          <span>{{ probing ? 'Cek LAN' : 'Online' }}</span>
        </div>
      </div>
    </div>

    <p v-if="hereCompany" class="local-banner">
      Jaringan terdeteksi: <b>{{ hereCompany.name }}</b>
      <span v-if="consoleIps.length"> · console {{ consoleIps.join(', ') }}</span>
    </p>
    <p v-else-if="consoleIps.length" class="local-banner local-banner--mute">
      Console di {{ consoleIps.join(', ') }}. Klik perusahaan yang LAN-nya cocok.
    </p>
    <p v-else-if="!isLocalVncApp()" class="local-banner local-banner--mute">
      Monitor live hanya dari aplikasi desktop Zerologic.
    </p>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-else-if="hint" class="muted" style="margin-bottom: 12px">{{ hint }}</p>

    <div class="local-grid">
      <div class="local-col">
        <section class="panel">
          <h3>Perusahaan</h3>
          <input v-model="companyQ" class="modern-input" placeholder="Cari kantor" style="margin-bottom: 10px" />
          <div v-if="!filteredCompanies.length" class="muted">Tidak ada kantor.</div>
          <div class="local-site-list">
            <button
              v-for="company in filteredCompanies"
              :key="company.id"
              type="button"
              class="local-site"
              :class="{ active: selected?.id === company.id, 'is-here': hereIds.has(company.id) }"
              @click="selectCompany(company)"
            >
              <strong>{{ company.name }}</strong>
              <span>
                {{ onlineCount(company) }}/{{ company.pcs.length }} online
                {{ hereIds.has(company.id) ? ' · LAN ini' : '' }}
              </span>
            </button>
          </div>
        </section>

        <section class="panel local-composer">
          <p class="local-composer__tag">{{ editingCompany ? 'Ubah kantor' : 'Kantor baru' }}</p>
          <h3>{{ editingCompany ? 'Edit perusahaan' : 'Tambah perusahaan' }}</h3>
          <form class="local-form local-form--flush" @submit.prevent="submitCompany">
            <div class="field">
              <label>Nama</label>
              <input v-model="companyForm.name" class="modern-input" placeholder="Perusahaan A" />
            </div>
            <div class="field">
              <label>Subnet LAN (opsional)</label>
              <input v-model="companyForm.subnet" class="modern-input" placeholder="192.168.0.0/24" />
            </div>
            <div class="local-form__row">
              <button class="btn btn--sm btn--yellow" type="submit">
                {{ editingCompany ? 'Simpan' : 'Tambah kantor' }}
              </button>
              <button
                v-if="editingCompany"
                class="btn btn--sm"
                type="button"
                @click="editingCompany = false; resetCompanyForm()"
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      </div>

      <div class="local-col">
        <section class="panel">
          <div v-if="!selected" class="local-empty">
            Pilih <b>perusahaan</b> di kiri. PC hanya tampil setelah kantor dipilih.
          </div>
          <template v-else>
            <div class="local-pc-head">
              <div>
                <h3>{{ selected.name }}</h3>
                <p class="muted">
                  {{ selected.subnet ? `Subnet ${selected.subnet} · ` : '' }}{{ filteredPcs.length }}/{{ selected.pcs.length }} PC
                </p>
              </div>
              <div class="local-form__row">
                <button class="btn btn--sm btn--yellow" type="button" @click="showAddPc = !showAddPc">
                  {{ showAddPc ? 'Tutup form' : 'Tambah PC' }}
                </button>
                <button class="btn btn--sm" type="button" @click="startEditCompany">Ubah kantor</button>
                <button class="btn btn--sm btn--pink" type="button" @click="dropCompany">Hapus kantor</button>
              </div>
            </div>

            <div class="toolbar">
              <input v-model="pcQ" class="modern-input" placeholder="Cari nama / IP" />
              <select v-model="pcFilter" class="modern-select">
                <option value="all">Semua</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div v-if="!selected.pcs.length" class="local-empty">Kantor ini belum punya PC. Klik Tambah PC.</div>
            <div v-else-if="!filteredPcs.length" class="local-empty">Tidak ada PC yang cocok filter.</div>
            <div v-else class="local-wall">
              <article
                v-for="pc in filteredPcs"
                :key="pc.id"
                class="local-monitor"
                :class="{ 'is-live': isOnline(pc) }"
                @contextmenu="onPcContext($event, pc, selected)"
              >
                <div class="local-monitor__meta">
                  <strong :title="pc.name">{{ pc.name }}</strong>
                  <span class="local-status">
                    <i class="status-dot" :class="isOnline(pc) ? 'status-online' : 'status-offline'"></i>
                    {{ isOnline(pc) ? 'Online' : 'Offline' }}
                    <span v-if="isOnline(pc)" class="chip os-linux">{{ probes[pc.id].ms }} ms</span>
                  </span>
                </div>
                <div
                  class="local-monitor__screen"
                  title="Klik untuk jendela kontrol"
                  @click="openPcWindow(pc, selected)"
                >
                  <LocalPcPreview :pc="pc" :live="isOnline(pc)" />
                </div>
                <p class="muted local-monitor__addr">
                  {{ pc.ip }}:{{ pc.port }}<span v-if="pc.mac"> · {{ pc.mac }}</span>
                </p>
                <div class="local-monitor__actions">
                  <button
                    class="btn btn--sm btn--yellow is-wide"
                    type="button"
                    :disabled="connectingId === pc.id"
                    @click="openPcWindow(pc, selected)"
                  >
                    {{ connectingId === pc.id ? 'Membuka…' : 'Hubungkan' }}
                  </button>
                  <button
                    v-if="!isOnline(pc)"
                    class="btn btn--sm btn--yellow is-wide"
                    type="button"
                    :disabled="Boolean(powerId)"
                    @click="askWake(pc)"
                  >
                    {{ powerId === `${pc.id}:wake` ? 'Menyalakan…' : 'Hidupkan' }}
                  </button>
                  <template v-else>
                    <button
                      class="btn btn--sm"
                      type="button"
                      :disabled="Boolean(powerId)"
                      @click="askPower(pc, 'reboot')"
                    >
                      {{ powerId === `${pc.id}:reboot` ? 'Reboot…' : 'Reboot' }}
                    </button>
                    <button
                      class="btn btn--sm btn--pink"
                      type="button"
                      :disabled="Boolean(powerId)"
                      @click="askPower(pc, 'shutdown')"
                    >
                      {{ powerId === `${pc.id}:shutdown` ? 'Shutdown…' : 'Shutdown' }}
                    </button>
                  </template>
                  <button class="btn btn--sm" type="button" @click="startEditPc(pc)">Ubah</button>
                  <button class="btn btn--sm btn--pink" type="button" @click="dropPc(pc)">Hapus</button>
                </div>
              </article>
            </div>
          </template>
        </section>

        <section v-if="selected && showAddPc" class="panel local-composer">
          <p class="local-composer__tag">{{ editingPcId ? 'Ubah PC' : 'PC baru' }}</p>
          <h3>{{ editingPcId ? 'Edit mesin' : 'Tambah PC TightVNC' }}</h3>
          <form class="local-form local-form--flush" @submit.prevent="submitPc">
            <div class="field">
              <label>Nama PC</label>
              <input v-model="pcForm.name" class="modern-input" placeholder="Kasir-01" />
            </div>
            <div class="local-form__split">
              <div class="field">
                <label>IP lokal</label>
                <input v-model="pcForm.ip" class="modern-input" placeholder="192.168.0.41" />
              </div>
              <div class="field">
                <label>Port VNC</label>
                <input v-model.number="pcForm.port" class="modern-input" type="number" min="1" max="65535" />
              </div>
            </div>
            <div class="field">
              <label>Password TightVNC</label>
              <input v-model="pcForm.password" class="modern-input" type="password" placeholder="tersimpan di console ini saja" />
            </div>
            <div class="field">
              <label>MAC (Wake-on-LAN)</label>
              <div class="local-form__row">
                <input v-model="pcForm.mac" class="modern-input" placeholder="AA:BB:CC:DD:EE:FF" />
                <button class="btn btn--sm" type="button" @click="fetchFormMac">Ambil dari LAN</button>
              </div>
            </div>
            <div class="local-form__split">
              <div class="field">
                <label>User Windows (shutdown)</label>
                <input v-model="pcForm.winUser" class="modern-input" placeholder="Administrator" />
              </div>
              <div class="field">
                <label>Password Windows</label>
                <input v-model="pcForm.winPassword" class="modern-input" type="password" placeholder="opsional, untuk reboot/shutdown" />
              </div>
            </div>
            <div class="local-form__row">
              <button class="btn btn--sm btn--yellow" type="submit">
                {{ editingPcId ? 'Simpan PC' : 'Tambah PC' }}
              </button>
              <button class="btn btn--sm" type="button" @click="cancelEditPc">Batal</button>
            </div>
          </form>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="pending"
        class="confirm-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="cancelPending"
      >
        <div class="confirm-card">
          <h3>{{ pending.title }}</h3>
          <p>{{ pending.body }}</p>
          <div class="confirm-card__actions">
            <button class="btn btn--sm" type="button" :disabled="Boolean(powerId)" @click="cancelPending">
              Batal
            </button>
            <button
              class="btn btn--sm"
              :class="pending.danger ? 'btn--pink' : 'btn--yellow'"
              type="button"
              :disabled="Boolean(powerId)"
              @click="confirmPending"
            >
              {{ pending.confirm }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
