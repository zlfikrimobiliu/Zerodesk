export const API_HOST = 'zerologic.lokanesa.com'

export const API_BASE = (
  import.meta.env.VITE_API_URL || `https://${API_HOST}`
).replace(/\/$/, '')

export const WS_BASE = API_BASE.replace(/^http/i, 'ws')
