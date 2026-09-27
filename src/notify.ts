// A gentle tap on the shoulder when a focus session ends while she's working
// in another app (on her Mac). Needs her permission once, asked for when she
// starts a session.

const supported = () => typeof window !== 'undefined' && 'Notification' in window

/** Ask once; only works from a tap/click. */
export function askToNotify() {
  if (supported() && Notification.permission === 'default') void Notification.requestPermission().catch(() => {})
}

export function notify(title: string, body: string) {
  if (!supported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'tamalucy-focus' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // some browsers only allow notifications from a service worker
  }
}
