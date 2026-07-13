import type { OnlineStatus } from '../hooks/useOnlineStatus'

type ConnectionBannerProps = {
  status: OnlineStatus
  message: string
}

export function ConnectionBanner({ status, message }: ConnectionBannerProps) {
  if (status === 'connected') return null

  return (
    <div
      className={`connection-banner connection-banner--${status}`}
      role="status"
      aria-live="assertive"
    >
      {message}
    </div>
  )
}
