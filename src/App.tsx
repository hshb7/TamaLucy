import { useEffect, useState } from 'react'
import { buzz, setSoundEnabled, sfx, unlockAudio } from './audio.ts'
import { arrive, celebratePromotion, completeFocus, endBreak, focusHidden, focusVisible, heartbeat, pendingPromotion, resolveAdventure, simulate, type RewardResult } from './game/logic.ts'
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
import { StatsScreen } from './screens/Stats.tsx'
import { SettingsScreen } from './screens/Settings.tsx'
import { FailedModal, PostcardModal, PromotionModal } from './screens/Modals.tsx'
import { DecorScreen } from './screens/Decor.tsx'

export type View = 'home' | 'break' | 'wardrobe' | 'decor' | 'album' | 'stats' | 'settings'

export default function App() {
  const game = useGame()
  const [view, setView] = useState<View>(() => (getGame().breakEndsAt ? 'break' : 'home'))
  const [setupOpen, setSetupOpen] = useState(false)
  const [failedAway, setFailedAway] = useState<number | null>(null)
  const [reward, setReward] = useState<RewardResult | null>(null)

  useEffect(() => setSoundEnabled(game.settings.sound), [game.settings.sound])

  // Leaving the app during focus + coming back
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const r = focusVisible(arrive(getGame(), now), now)
      setGame(r.state)
      if (r.outcome === 'failed') {
        setFailedAway(r.awayMs)
        sfx.sad()
        buzz([80, 60, 80])
      } else if (r.outcome === 'close-call') toast(`phew! ${r.state.foxName} stirred but stayed asleep. stay with ${r.state.foxName}!`)
      else if (r.outcome === 'paused') toast(`welcome back! the timer waited for you.`)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') setGame((s) => focusHidden(s, Date.now()))
      else check()
    }
    const onHide = () => setGame((s) => focusHidden(s, Date.now()))
    check() // the page may have been reloaded / killed mid-session
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
          buzz([60, 40, 60, 40, 120])
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
  else if (view === 'break') screen = <BreakScreen onFocus={openSetup} onHome={() => setView('home')} />
  else if (view === 'wardrobe') screen = <Wardrobe onBack={() => setView('home')} />
  else if (view === 'decor') screen = <DecorScreen onBack={() => setView('home')} />
  else if (view === 'album') screen = <Album onBack={() => setView('home')} />
  else if (view === 'stats') screen = <StatsScreen onBack={() => setView('home')} />
  else if (view === 'settings') screen = <SettingsScreen onBack={() => setView('home')} />
  else screen = <Home onFocus={openSetup} go={setView} />

  const calm = !game.session && !game.pending && !reward
  const promo = calm ? pendingPromotion(game) : null
  const showPostcard = game.postcardToShow && calm && promo == null && view !== 'break'

  return (
    <>
      {screen}
      {setupOpen && !game.session && <FocusSetup onClose={() => setSetupOpen(false)} />}
      {failedAway != null && (
        <FailedModal
          awayMs={failedAway}
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
      <Toasts />
    </>
  )
}
