import { useState } from 'react'
import { drawWallAndFloor } from '../art/room.ts'
import type { Painter } from '../art/painter.ts'
import { sfx } from '../audio.ts'
import { ladder, unlockRank } from '../game/career.ts'
import { setGame, useGame } from '../game/store.ts'
import type { GameState } from '../game/state.ts'
import { daysUntil } from '../game/study.ts'
import { dayKey } from '../game/time.ts'
import { POSES, SHOWS, WIDGET_BACKGROUNDS, setWidgetStyle, widgetBackgroundUnlocked, widgetData, widgetStat, type WidgetData } from '../game/widget.ts'
import { nativePlatform } from '../native.ts'
import { useNow } from '../hooks.ts'
import { PixelCanvas } from '../ui/PixelCanvas.tsx'
import { WIDGET_SIZES, drawWidgetFox, drawWidgetScene, type WidgetSize } from '../ui/widgetArt.ts'
import { Header } from './Header.tsx'

/** A home screen widget as it'll look on her iPhone (the Swift widget lays it out the same way). */
function HomeWidget({ game, data, size }: { game: GameState; data: WidgetData; size: WidgetSize }) {
  const now = Date.now()
  const stat = widgetStat(data, dayKey(now), (d) => daysUntil(d, now))
  const { w, h } = WIDGET_SIZES[size]
  return (
    <div className={`widget widget-${size}`} style={{ color: data.ink }}>
      <PixelCanvas w={w} h={h} draw={(p) => drawWidgetScene(p, game, size)} fps={4} className="widget-art" />
      <div className="widget-card" style={{ background: data.card }}>
        {size === 'medium' && <span className="widget-fox">{data.fox}</span>}
        <span className="widget-big" style={{ color: data.accent }}>
          {stat.big}
        </span>
        <span className="widget-label">{stat.small}</span>
        {size === 'medium' && <span className="widget-caption">{data.caption}</span>}
      </div>
    </div>
  )
}

function LiveActivity({ game, data }: { game: GameState; data: WidgetData }) {
  const fox = (p: Painter) => drawWidgetFox(p, game, 'study', 1, 33, 'open')
  return (
    <div className="live-preview">
      <div className="island" aria-label="the Dynamic Island">
        <PixelCanvas w={44} h={34} draw={fox} fps={2} className="island-fox" />
        <span style={{ color: data.accent }}>24:59</span>
      </div>
      <div className="lock-banner" style={{ background: data.card, color: data.ink }} aria-label="the lock screen">
        <PixelCanvas w={44} h={34} draw={fox} fps={2} className="lock-fox" />
        <div className="lock-text">
          <b>{game.lastCourse && game.courses.find((c) => c.id === game.lastCourse)?.name || `studying with ${data.fox}`}</b>
          <span className="lock-bar" style={{ background: `${data.accent}33` }}>
            <span style={{ background: data.accent }} />
          </span>
        </div>
        <span className="lock-time">24:59</span>
      </div>
    </div>
  )
}

function Swatch({ id }: { id: string }) {
  const bg = WIDGET_BACKGROUNDS[id]
  if (!bg.wall) return <span className="swatch-fill" style={{ background: bg.color }} />
  const draw = (p: Painter) => drawWallAndFloor({ rect: (x, y, w, h, c, a) => p.rect(x - 2, y - 30, w, h, c, a), sprite: (s, x, y, a) => p.sprite(s, x - 2, y - 30, a) }, { wall: bg.wall!, floor: 'honey' })
  return <PixelCanvas w={14} h={14} draw={draw} fps={1} className="swatch-fill" />
}

/** Style her widget: background, the fox's pose, what it shows, her own little line. */
export function WidgetStudio({ onBack }: { onBack: () => void }) {
  const game = useGame()
  useNow(30_000)
  const data = widgetData(game, Date.now())
  const w = game.widget
  const [caption, setCaption] = useState(w.caption)
  const set = (patch: Parameters<typeof setWidgetStyle>[1]) => {
    sfx.tap()
    setGame((s) => setWidgetStyle(s, patch))
  }
  const classes = game.courses.filter((c) => !c.doneAt)

  return (
    <main className="screen widget-studio">
      <Header title="your widget" onBack={onBack} />
      <section className="phone-preview" aria-label="preview">
        <div className="widget-row">
          <HomeWidget game={game} data={data} size="small" />
          <HomeWidget game={game} data={data} size="medium" />
        </div>
        <LiveActivity game={game} data={data} />
      </section>

      <section className="px-box card">
        <h2>background</h2>
        <div className="bg-swatches">
          {Object.entries(WIDGET_BACKGROUNDS).map(([id, bg]) => {
            const open = widgetBackgroundUnlocked(game, id)
            const rank = bg.wall ? unlockRank(game, 'wall', bg.wall) : -1
            const CAREER = ladder(game)
            return (
              <button
                key={id}
                className={`bg-swatch ${w.bg === id ? 'on' : ''}`}
                disabled={!open}
                onClick={() => set({ bg: id })}
                aria-pressed={w.bg === id}
                aria-label={open ? bg.name : `${bg.name}, unlocks at ${CAREER[rank]?.short}`}
              >
                <Swatch id={id} />
                <small>{open ? bg.name : `at ${CAREER[rank]?.short}`}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="px-box card">
        <h2>{game.foxName} is…</h2>
        <div className="chips chips-left">
          {POSES.map((p) => (
            <button key={p.id} className={`chip-btn ${w.pose === p.id ? 'on' : ''}`} onClick={() => set({ pose: p.id })}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="muted">{game.foxName} wears the outfit from the closet.</p>
      </section>

      <section className="px-box card">
        <h2>it shows</h2>
        <div className="chips chips-left">
          {SHOWS.map((x) => (
            <button key={x.id} className={`chip-btn ${w.show === x.id ? 'on' : ''}`} onClick={() => set({ show: x.id })}>
              {x.label}
            </button>
          ))}
        </div>
        {w.show === 'class' &&
          (classes.length ? (
            <div className="subject-chips">
              <button className={`subject-chip ${!w.courseId ? 'on' : ''}`} onClick={() => set({ courseId: '' })}>
                the one i studied last
              </button>
              {classes.map((c) => (
                <button key={c.id} className={`subject-chip ${w.courseId === c.id ? 'on' : ''}`} onClick={() => set({ courseId: c.id })}>
                  {c.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">add your classes on the bookshelf (study → classes) and their hours show up here.</p>
          ))}
      </section>

      <section className="px-box card">
        <label>
          your own little line
          <input
            value={caption}
            maxLength={40}
            placeholder={`e.g. you’ve got this, ${game.owner.toLowerCase()} ✿`}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => setGame((s) => setWidgetStyle(s, { caption }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </label>
        <p className="muted">leave it empty and it shows how {game.foxName} is doing instead.</p>
      </section>

      <section className="px-box card">
        <h2>putting it on your home screen</h2>
        {nativePlatform === 'ios' ? (
          <ol className="steps">
            <li>touch and hold an empty spot on your home screen until the apps jiggle</li>
            <li>tap <b>+</b> (top left), search for <b>TamaLucy</b>, pick small or medium, <b>Add Widget</b></li>
            <li>it updates whenever you open the app. the Dynamic Island uses this style too ✿</li>
          </ol>
        ) : (
          <p className="muted">
            the widget lives on your iPhone, in the TamaLucy app. you can style it from any device: it follows {game.foxName} everywhere, and the iPhone picks
            it up next time you open the app there.
          </p>
        )}
      </section>
    </main>
  )
}
