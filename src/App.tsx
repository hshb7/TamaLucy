import { useEffect, useRef, useState } from 'react'
import { buzz, setSoundEnabled, sfx, unlockAudio } from './audio.ts'
import { arrive, celebratePromotion, completeFocus, endBreak, failFocus, focusHidden, focusVisible, heartbeat, pendingPromotion, resolveAdventure, simulate, type RewardResult } from './game/logic.ts'
import { getGame, setGame, useGame } from './game/store.ts'
import { Toasts, toast } from './ui/bits.tsx'
import { Onboarding } from './screens/Onboarding.tsx'
import { Home } from './screens/Home.tsx'
import { FocusSetup } from './screens/FocusSetup.tsx'
import { FocusScreen } from './screens/Focus.tsx'
import { RewardScreen } from './screens/Reward.tsx'
import { BreakScreen } from './screens/Break.tsx'
import { Wardrobe } from './screens/Wardrobe.tsx'
import { Album } from './screens/Album.tsx'
import { StudyScreen } from './screens/Study.tsx'
import { SettingsScreen } from './screens/Settings.tsx'
import { FailedModal, MailModal, PostcardModal, PromotionModal } from './screens/Modals.tsx'
import { DecorScreen } from './screens/Decor.tsx'
import type { Note } from './game/state.ts'
import { checkMail, connectMailbox, mailProblem, onNewMail, takeMailLink } from './mail.ts'
import { startSync, syncFor, syncNow } from './sync.ts'
import { notify } from './notify.ts'
import { isNativeApp, native } from './native.ts'

export type View = 'home' | 'break' | 'wardrobe' | 'decor' | 'album' | 'study' | 'career' | 'exams' | 'settings'

export default function App() {
  const game = useGame()
  const [view, setView] = useState<View>(() => (getGame().breakEndsAt ? 'break' : 'home'))
  const [setupOpen, setSetupOpen] = useState(false)
  const [failedAway, setFailedAway] = useState<number | null>(null)
  const [failedBlocked, setFailedBlocked] = useState(false)
  const [reward, setReward] = useState<RewardResult | null>(null)
  const [newMail, setNewMail] = useState<Note[]>([])

  // Letters from far away
  useEffect(
    () =>
      onNewMail((added) => {
        setNewMail((m) => [...added, ...m])
        sfx.chime()
        buzz([40, 40, 40])
      }),
    [],
  )

  useEffect(() => setSoundEnabled(game.settings.sound), [game.settings.sound])

  // Working in another app (on the Mac): call her back when time's up
  const endsAt = game.session?.endsAt
  const free = game.settings.leaveMode === 'free'
  useEffect(() => {
    if (!endsAt || !free) return
    const id = setTimeout(() => {
      if (document.visibilityState === 'visible' && document.hasFocus()) return // the usual fanfare plays
      sfx.chime()
      const f = getGame().foxName
      notify(`time’s up! ${f} is so proud of you`, `come back to ${f} for your reward ✿`)
    }, Math.max(0, endsAt - Date.now()))
    return () => clearTimeout(id)
  }, [endsAt, free])

  // The iPhone app: the session in the Dynamic Island, and her distracting apps blocked until it ends
  const ses = game.session
  const sesKey = ses ? `${ses.startedAt}:${ses.endsAt}` : ''
  const hadSession = useRef(false)
  useEffect(() => {
    if (!isNativeApp) return
    if (ses) native.focusStarted({ startedAt: ses.startedAt, endsAt: ses.endsAt, label: ses.label, fox: game.foxName })
    else if (hadSession.current) native.focusEnded(getGame().pending ? 'done' : 'gaveUp')
    hadSession.current = !!ses
  }, [sesKey]) // only when the session itself starts, moves or ends

  // Leaving the app during focus + coming back
  useEffect(() => {
    const check = async () => {
      // she tapped "use it anyway" on a blocked app (iPhone app)
      const running = getGame().session
      if (isNativeApp && running) {
        const at = await native.brokeFocusAt()
        if (at >= running.startedAt && at <= running.endsAt && getGame().session?.startedAt === running.startedAt) {
          setGame(failFocus)
          setFailedBlocked(true)
          setFailedAway(0)
          sfx.sad()
          buzz([80, 60, 80], 'warning')
          return
        }
      }
      // bring in progress from her other device first, so time spent there
      // doesn't count as time away (a running session belongs to this device)
      const g = getGame()
      if (g.mailbox && !g.session) await syncFor(3500)
      const now = Date.now()
      const r = focusVisible(arrive(getGame(), now), now)
      setGame(r.state)
      if (r.outcome === 'failed') {
        setFailedBlocked(false)
        setFailedAway(r.awayMs)
        sfx.sad()
        buzz([80, 60, 80], 'warning')
      } else if (r.outcome === 'close-call') toast(`phew! ${r.state.foxName} looked up, but you came back in time. keep going!`)
      else if (r.outcome === 'paused') toast(`welcome back! the timer waited for you.`)
      checkMail(2 * 60_000)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') setGame((s) => focusHidden(s, Date.now()))
      else void check()
    }
    const onHide = () => setGame((s) => focusHidden(s, Date.now()))
    startSync()
    void check() // the page may have been reloaded / killed mid-session
    const link = takeMailLink()
    if (link)
      connectMailbox(link).then(
        (ok) => {
          if (!ok) return toast('hmm, that mailbox link didn’t work. is it the whole thing?')
          toast('mailbox connected! letters (and your fox) will find you here ♡')
          checkMail(0)
          void syncNow()
        },
        (e) => toast(mailProblem(e)),
      )
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  // The game clock
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      const s = getGame()
      if (s.session) {
        if (now >= s.session.endsAt && !s.session.hiddenAt) {
          setGame(completeFocus(s, now))
          sfx.fanfare()
          buzz([60, 40, 60, 40, 120], 'success')
          return
        }
        if (now - s.session.lastBeat > 3000) setGame(heartbeat(s, now))
      }
      if (s.breakEndsAt && now >= s.breakEndsAt) {
        setGame(endBreak(s))
        sfx.chime()
        buzz(200)
        toast(`break's over! ${s.foxName} is ready when you are.`)
      }
      if (s.adventure && now >= s.adventure.returnsAt) {
        setGame(resolveAdventure(s, now))
        sfx.chime()
      }
      if (now - s.lastTick > 60_000) setGame((g) => ({ ...simulate(g, now), lastVisit: now }))
      if (s.mailbox && !s.session && now - s.lastMailCheck > 15 * 60_000) checkMail(15 * 60_000)
    }, 500)
    return () => clearInterval(id)
  }, [])

  const openSetup = () => setSetupOpen(true)

  let screen
  if (!game.onboarded) screen = <Onboarding />
  else if (game.session) screen = <FocusScreen />
  else if (game.pending || reward)
    screen = (
      <RewardScreen
        result={reward}
        setResult={setReward}
        onDone={(next) => {
          setReward(null)
          setView(next)
        }}
      />
    )
  else if (view === 'break') screen = <BreakScreen onFocus={openSetup} onHome={() => setView('home')} onStudy={() => setView('study')} />
  else if (view === 'wardrobe') screen = <Wardrobe onBack={() => setView('home')} />
  else if (view === 'decor') screen = <DecorScreen onBack={() => setView('home')} />
  else if (view === 'album') screen = <Album onBack={() => setView('home')} />
  else if (view === 'study' || view === 'career' || view === 'exams')
    screen = <StudyScreen onBack={() => setView('home')} initialTab={view === 'study' ? 'cards' : view} />
  else if (view === 'settings') screen = <SettingsScreen onBack={() => setView('home')} />
  else screen = <Home onFocus={openSetup} go={setView} />

  const calm = !game.session && !game.pending && !reward
  const promo = calm ? pendingPromotion(game) : null
  const showPostcard = game.postcardToShow && calm && promo == null && view !== 'break' && failedAway == null
  const showMail = newMail.length > 0 && calm && promo == null && !showPostcard && failedAway == null

  return (
    <>
      {screen}
      {setupOpen && !game.session && <FocusSetup onClose={() => setSetupOpen(false)} />}
      {failedAway != null && (
        <FailedModal
          awayMs={failedAway}
          blocked={failedBlocked}
          onClose={() => setFailedAway(null)}
          onRetry={() => {
            setFailedAway(null)
            openSetup()
          }}
        />
      )}
      {promo != null && failedAway == null && (
        <PromotionModal
          rank={promo}
          onClose={() => {
            setGame(celebratePromotion)
          }}
        />
      )}
      {showPostcard && <PostcardModal card={game.postcardToShow!} fresh />}
      {showMail && <MailModal notes={newMail} onClose={() => setNewMail([])} />}
      <Toasts />
    </>
  )
}
