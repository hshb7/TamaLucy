import { useEffect, useState, type ReactNode } from 'react'
import { ICON_ART, NEED_ICON_ART } from '../art/items.ts'
import { sprite, type Sprite } from '../art/sprite.ts'
import { currentRank } from '../game/career.ts'
import { streak } from '../game/logic.ts'
import { useGame } from '../game/store.ts'
import { useNow } from '../hooks.ts'
import { FoxPortrait } from '../ui/FoxPortrait.tsx'
import { PixelIcon } from '../ui/PixelIcon.tsx'
import type { View } from '../App.tsx'
import { settingsTabs, type SettingsTab } from './Settings.tsx'
import { SignOutButton } from './SignOut.tsx'

const HOUSE = sprite([
  '.....oo.....',
  '....ommo....',
  '...ommmmo...',
  '..ommmmmmo..',
  '.ommmmmmmmo.',
  'oooooooooooo',
  '.occcccccco.',
  '.occcnnccco.',
  '.occcnnccco.',
  '.occcnnccco.',
  '.oooooooooo.',
  '............',
])

const CALENDAR = sprite([
  '..o......o..',
  'oooooooooooo',
  'oppppppppppo',
  'oppppppppppo',
  'oooooooooooo',
  'occcoccoccco',
  'occcoccoccco',
  'ocmmoccoccco',
  'ocmmoccoccco',
  'occcoccoccco',
  'oooooooooooo',
  '............',
])

const PHONE = sprite([
  '...oooooo...',
  '...occcco...',
  '...ocmmco...',
  '...ocmmco...',
  '...occcco...',
  '...ocyyco...',
  '...ocyyco...',
  '...occcco...',
  '...occcco...',
  '...ococco...',
  '...oooooo...',
  '............',
])

type Item = { view: View; label: string; icon: Sprite }
type Group = { title?: string; items: Item[] }

const GROUPS: Group[] = [
  { items: [{ view: 'home', label: 'the room', icon: HOUSE }] },
  {
    title: 'study',
    items: [
      { view: 'classes', label: 'classes', icon: NEED_ICON_ART.books },
      { view: 'study', label: 'flashcards', icon: NEED_ICON_ART.card },
      { view: 'exams', label: 'exams', icon: NEED_ICON_ART.gavel },
      { view: 'calendar', label: 'calendar', icon: CALENDAR },
      { view: 'career', label: 'career', icon: ICON_ART.chart },
    ],
  },
  {
    title: 'fox',
    items: [
      { view: 'album', label: 'album', icon: ICON_ART.mail },
      { view: 'wardrobe', label: 'closet', icon: ICON_ART.bow },
      { view: 'decor', label: 'decor', icon: NEED_ICON_ART.palette },
      { view: 'widget', label: 'widget', icon: PHONE },
    ],
  },
  { items: [{ view: 'settings', label: 'settings', icon: ICON_ART.gear }] },
]

interface Props {
  view: View
  go: (v: View) => void
  onFocus: () => void
  /** Which settings section is open; "settings" unfolds into them in the sidebar. */
  settingsTab: SettingsTab
  onSettingsTab: (t: SettingsTab) => void
  children: ReactNode
}

/**
 * The Mac (and any wide window): a sidebar to get around, like a proper desktop
 * app, with the screen beside it. The phone keeps its stacked layout and its
 * menu under the room.
 */
export function DesktopShell({ view, go, onFocus, settingsTab, onSettingsTab, children }: Props) {
  const game = useGame()
  const now = useNow(60_000)
  const rank = currentRank(game)
  const unread = game.notes.filter((n) => !n.read).length
  const st = streak(game.stats.days, now)
  // the settings folder: open whenever settings is reached, and a click on "settings" while there folds it
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (view === 'settings') setOpen(true)
  }, [view])
  const unfolded = view === 'settings' && open
  return (
    <div className="shell">
      <aside className="side-nav">
        <button className="side-fox" onClick={() => go('home')} aria-label={`${game.foxName}, ${rank.title}. go to the room`}>
          <FoxPortrait equipped={game.equipped} label="" />
          <span className="side-name">
            <b>{game.foxName}</b>
            <small>{rank.title}</small>
          </span>
        </button>
        <nav aria-label="sections">
          {GROUPS.map((g, i) => (
            <div key={i} className="side-group">
              {g.title && <p className="side-title">{g.title === 'fox' ? game.foxName.toLowerCase() : g.title}</p>}
              {g.items.map((it) =>
                it.view === 'settings' ? (
                  // settings unfolds into its sections, like a folder
                  <div key={it.view} className="side-tree">
                    <button
                      className={`side-item ${view === 'settings' ? 'on' : ''}`}
                      aria-expanded={unfolded}
                      onClick={() => (view === 'settings' ? setOpen(!open) : go('settings'))}
                    >
                      <PixelIcon sprite={it.icon} scale={2} />
                      <span>{it.label}</span>
                      <span className={`caret ${unfolded ? 'open' : ''}`} aria-hidden="true">
                        ▸
                      </span>
                    </button>
                    {/* always in the tree, folded shut or open, so it can slide */}
                    <div className={`side-fold ${unfolded ? 'open' : ''}`} aria-hidden={!unfolded}>
                      <div className="side-fold-inner">
                        <div className="side-sub" role="tablist" aria-label="settings sections">
                          {settingsTabs(game.foxName).map((t) => (
                            <button
                              key={t.id}
                              role="tab"
                              aria-selected={settingsTab === t.id}
                              tabIndex={unfolded ? 0 : -1}
                              className={`side-subitem ${settingsTab === t.id ? 'on' : ''}`}
                              onClick={() => onSettingsTab(t.id)}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button key={it.view} className={`side-item ${view === it.view ? 'on' : ''}`} aria-current={view === it.view ? 'page' : undefined} onClick={() => go(it.view)}>
                    <PixelIcon sprite={it.icon} scale={2} />
                    <span>{it.label}</span>
                    {it.view === 'album' && unread > 0 && <span className="badge">{unread}</span>}
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-stats">
            <span className="chip" title="acorns: earned by focusing, spent on the fox">
              <PixelIcon sprite={ICON_ART.acorn} scale={2} /> {game.acorns}
            </span>
            <span className="chip streak" title="focus streak">
              <PixelIcon sprite={ICON_ART.flame} scale={2} /> {st}
            </span>
          </div>
          {view !== 'home' && (
            <button className="btn btn-pink side-focus" onClick={onFocus}>
              <PixelIcon sprite={ICON_ART.acorn} scale={2} /> focus with {game.foxName}
            </button>
          )}
          {game.mailbox && <SignOutButton className="link side-signout" label="sign out" />}
        </div>
      </aside>
      <div className="shell-main">{children}</div>
    </div>
  )
}
