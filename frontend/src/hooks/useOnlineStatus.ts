export function useOnlineStatus() {
  return {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }
}
