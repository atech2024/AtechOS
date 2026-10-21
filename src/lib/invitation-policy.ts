export function canRenewInvitation(status: string, expiresAt: string | null, now = Date.now()): boolean {
  if (status === 'cancelled' || status === 'canceled') return true
  if (status !== 'pending' || !expiresAt) return false
  const expiration = Date.parse(expiresAt)
  return Number.isFinite(expiration) && expiration <= now
}
