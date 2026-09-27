import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { ICON_ART, TREAT_ART } from '../art/items.ts'
import { PixelIcon } from './PixelIcon.tsx'

export function Meter({ value, icon, label, tone }: { value: number; icon: keyof typeof ICON_ART | 'onigiri'; label: string; tone: 'pink' | 'butter' }) {
  const filled = Math.round(value / 10)
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <MeterIcon icon={icon} />
      <div className={`meter-bar tone-${tone}`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : ''} />
        ))}
      </div>
    </div>
  )
}

function MeterIcon({ icon }: { icon: string }) {
  const s = icon === 'onigiri' ? TREAT_ART.onigiri : ICON_ART[icon]
  return <PixelIcon sprite={s} scale={2} />
}

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal px-box ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

// ─── toasts ─────────────────────────────────────────────────────────────────
let toastMsg: { text: string; id: number } | null = null
const toastListeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(text: string, ms = 3200) {
  toastMsg = { text, id: Date.now() }
  toastListeners.forEach((l) => l())
  clearTimeout(timer)
  timer = setTimeout(() => {
    toastMsg = null
    toastListeners.forEach((l) => l())
  }, ms)
}

export function Toasts() {
  const msg = useSyncExternalStore(
    (l) => {
      toastListeners.add(l)
      return () => toastListeners.delete(l)
    },
    () => toastMsg,
  )
  if (!msg) return null
  return (
    <div className="toast px-box" key={msg.id} role="status">
      {msg.text}
    </div>
  )
}
