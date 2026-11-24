import { sameIpv4Subnet } from '../api/relay'

export function parseIpv4(ip) {
  const p = String(ip || '')
    .trim()
    .split('%')[0]
    .split('.')
    .map((n) => Number(n))
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
  return p
}

function maskFromPrefix(prefix) {
  if (prefix <= 0) return 0
  if (prefix >= 32) return 0xffffffff
  return (0xffffffff << (32 - prefix)) >>> 0
}

function ipv4ToInt(parts) {
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
}

export function inCidr(ip, cidr) {
  const raw = String(cidr || '').trim()
  if (!raw) return false
  const [net, prefixRaw] = raw.split('/')
  const prefix = Number(prefixRaw)
  const ipParts = parseIpv4(ip)
  const netParts = parseIpv4(net)
  if (!ipParts || !netParts || !Number.isInteger(prefix) || prefix < 8 || prefix > 32) return false
  const mask = maskFromPrefix(prefix)
  return (ipv4ToInt(ipParts) & mask) === (ipv4ToInt(netParts) & mask)
}

export function companyOnThisLan(company, consoleIps) {
  const ips = (consoleIps || []).filter(Boolean)
  if (!ips.length) return false
  if (company.subnet && ips.some((ip) => inCidr(ip, company.subnet))) return true
  return (company.pcs || []).some((pc) => {
    if (!pc.ip) return false
    return ips.some((ip) => sameIpv4Subnet(ip, pc.ip))
  })
}
