import { env } from './env.js'

/**
 * @returns `PUBLIC_APP_URL` with trailing slash removed, or `null` if unset.
 */
export function getPublicAppBaseUrl(): string | null {
  if (!env.PUBLIC_APP_URL) {
    return null
  }
  return env.PUBLIC_APP_URL.replace(/\/$/, '')
}

export interface PublicSessionRow {
  id: string
  createdAt: Date
  expiresAt: Date
  /** Masked IP for display (reduces PII vs raw address). */
  ipLabel: string | null
  /** Truncated user-agent string for display. */
  clientLabel: string | null
}

type SessionRowInput = {
  id: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

function maskIpForSessionList(ip: string | null): string | null {
  if (ip == null || ip === '') {
    return null
  }
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`
    }
  }
  if (ip.includes(':')) {
    return '[IPv6 masked]'
  }
  return '—'
}

const MAX_CLIENT_LABEL_LENGTH = 120

function truncateClientLabelForSessionList(ua: string | null): string | null {
  if (ua == null || ua === '') {
    return null
  }
  const t = ua.replace(/\s+/g, ' ').trim()
  if (t.length <= MAX_CLIENT_LABEL_LENGTH) {
    return t
  }
  return `${t.slice(0, MAX_CLIENT_LABEL_LENGTH - 1)}…`
}

export function mapSessionRowsToPublicRows(rows: SessionRowInput[]): PublicSessionRow[] {
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    ipLabel: maskIpForSessionList(r.ipAddress),
    clientLabel: truncateClientLabelForSessionList(r.userAgent),
  }))
}
