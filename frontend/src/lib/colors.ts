export type UserColor = {
  color: string
  colorLight: string
}

const PALETTE: UserColor[] = [
  { color: '#30bced', colorLight: '#30bced33' },
  { color: '#6eeb83', colorLight: '#6eeb8333' },
  { color: '#ffbc42', colorLight: '#ffbc4233' },
  { color: '#ecd444', colorLight: '#ecd44433' },
  { color: '#ee6352', colorLight: '#ee635233' },
  { color: '#9ac2c9', colorLight: '#9ac2c933' },
  { color: '#8acb88', colorLight: '#8acb8833' },
  { color: '#1be7ff', colorLight: '#1be7ff33' },
]

export function userColorFromUsername(username: string): UserColor {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}
