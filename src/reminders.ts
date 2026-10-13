// Hands the fox's reminder plan (src/game/reminders.ts) to the phone or the
// Mac, which shows them as notifications while the app is closed. Re-sent
// whenever something it depends on changes, and when she leaves the app, so
// the plan always reflects the latest state.
import { reminderPlan } from './game/reminders.ts'
import { getGame, subscribe } from './game/store.ts'
import { dayKey } from './game/time.ts'
import { getLinks } from './links.ts'
import { isNativeApp, native, type NotifyStatus } from './native.ts'

export const remindersAvailable = () => isNativeApp

export function notifyStatus(): Promise<NotifyStatus> {
  return native.notifyStatus()
}

export function askToRemind(): Promise<NotifyStatus> {
  return native.notifyAsk()
}

let lastKey = ''

/** What the plan depends on; if none of this changed, there's nothing to re-send. */
function planKey() {
  const s = getGame()
  const { reminders } = getLinks()
  const today = dayKey(Date.now())
  return JSON.stringify([reminders, s.foxName, s.exams.map((e) => [e.id, e.name, e.date, e.kind]), s.stats.days[today] ?? 0, today])
}

/** Send the current plan to the device (or clear it, if she turned reminders off). */
export async function syncReminders(force = false): Promise<void> {
  if (!isNativeApp) return
  const { reminders } = getLinks()
  const key = reminders.on ? planKey() : 'off'
  if (!force && key === lastKey) return
  lastKey = key
  const plan = reminders.on ? reminderPlan(getGame(), reminders, Date.now()) : []
  await native.notifySync(plan)
}

let timer: ReturnType<typeof setTimeout> | undefined
let started = false

/** Keep the device's reminders in step with the game, quietly. */
export function startReminderSync() {
  if (started || !isNativeApp) return
  started = true
  subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncReminders(), 5000)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void syncReminders()
  })
  void syncReminders()
}
