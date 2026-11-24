import { computed, reactive } from 'vue'

const KEY = 'zl_local_sites_v1'

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function emptyState() {
  return { companies: [] }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw || !Array.isArray(raw.companies)) return emptyState()
    return {
      companies: raw.companies.map((c) => ({
        id: c.id || uid('co'),
        name: String(c.name || '').trim() || 'Perusahaan',
        subnet: String(c.subnet || '').trim(),
        notes: String(c.notes || ''),
        pcs: Array.isArray(c.pcs)
          ? c.pcs.map((p) => ({
              id: p.id || uid('pc'),
              name: String(p.name || '').trim() || 'PC',
              ip: String(p.ip || '').trim(),
              port: Number(p.port) > 0 ? Number(p.port) : 5900,
              password: String(p.password || ''),
              mac: String(p.mac || '').trim().toUpperCase(),
              winUser: String(p.winUser || ''),
              winPassword: String(p.winPassword || ''),
              notes: String(p.notes || ''),
            }))
          : [],
      })),
    }
  } catch {
    return emptyState()
  }
}

const state = reactive(load())

function persist() {
  localStorage.setItem(KEY, JSON.stringify({ companies: state.companies }))
}

export function useLocalSites() {
  const companies = computed(() => state.companies)
  const companyCount = computed(() => state.companies.length)
  const pcCount = computed(() => state.companies.reduce((n, c) => n + c.pcs.length, 0))

  function addCompany({ name, subnet, notes }) {
    const company = {
      id: uid('co'),
      name: String(name || '').trim() || 'Perusahaan',
      subnet: String(subnet || '').trim(),
      notes: String(notes || ''),
      pcs: [],
    }
    state.companies.push(company)
    persist()
    return company
  }

  function updateCompany(id, patch) {
    const company = state.companies.find((c) => c.id === id)
    if (!company) return null
    if (patch.name != null) company.name = String(patch.name).trim() || company.name
    if (patch.subnet != null) company.subnet = String(patch.subnet).trim()
    if (patch.notes != null) company.notes = String(patch.notes)
    persist()
    return company
  }

  function removeCompany(id) {
    const i = state.companies.findIndex((c) => c.id === id)
    if (i < 0) return
    state.companies.splice(i, 1)
    persist()
  }

  function addPc(companyId, { name, ip, port, password, mac, winUser, winPassword, notes }) {
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return null
    const pc = {
      id: uid('pc'),
      name: String(name || '').trim() || 'PC',
      ip: String(ip || '').trim(),
      port: Number(port) > 0 ? Number(port) : 5900,
      password: String(password || ''),
      mac: String(mac || '').trim().toUpperCase(),
      winUser: String(winUser || '').trim(),
      winPassword: String(winPassword || ''),
      notes: String(notes || ''),
    }
    company.pcs.push(pc)
    persist()
    return pc
  }

  function updatePc(companyId, pcId, patch) {
    const company = state.companies.find((c) => c.id === companyId)
    const pc = company?.pcs.find((p) => p.id === pcId)
    if (!pc) return null
    if (patch.name != null) pc.name = String(patch.name).trim() || pc.name
    if (patch.ip != null) pc.ip = String(patch.ip).trim()
    if (patch.port != null) pc.port = Number(patch.port) > 0 ? Number(patch.port) : 5900
    if (patch.password != null) pc.password = String(patch.password)
    if (patch.mac != null) pc.mac = String(patch.mac).trim().toUpperCase()
    if (patch.winUser != null) pc.winUser = String(patch.winUser).trim()
    if (patch.winPassword != null) pc.winPassword = String(patch.winPassword)
    if (patch.notes != null) pc.notes = String(patch.notes)
    persist()
    return pc
  }

  function removePc(companyId, pcId) {
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return
    company.pcs = company.pcs.filter((p) => p.id !== pcId)
    persist()
  }

  return {
    companies,
    companyCount,
    pcCount,
    addCompany,
    updateCompany,
    removeCompany,
    addPc,
    updatePc,
    removePc,
  }
}
