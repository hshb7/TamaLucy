# TamaLucy 🦊

A cozy, pixel-art Tamagotchi (with a little Sims in it) that helps you focus.
A brown fox lives in a tiny room on your phone, walks around, eats, naps and
plays on its own, and wants your attention. Study with it (Pomodoro-style) and
it earns adventures, gifts, treats, clothes and handwritten notes, and climbs a
law career from 1L to the Supreme Court. Stay away too long and it gets hungry,
lonely, and eventually really down.

![screenshots](docs/screenshots.png)

It's an installable web app (PWA), so it runs on **iPhone and Android** from the
home screen, works offline, and needs no app store.

## What's inside

**Focus timer**
- Pick 10 / 15 / 25 / 45 / 60 minutes (or any length in 5-minute steps), plus an optional "what are you working on?".
- During focus the fox naps in a dim night-light scene, and the screen is kept awake.
- **Leaving the app wakes the fox.** Switch apps for more than the grace period (10s by default) and the session fails and the fox gets sad. A quick accidental swipe is forgiven. There's also a "just pause" mode in settings.
- Built-in guide for locking the phone to the app for real (iPhone Guided Access, Android App Pinning). See [below](#about-you-cant-touch-other-apps).
- Optional break timer afterwards.

**Rewards after every session** (pick one; 15+ min gives 3 options to choose from, 45+ min gives two rewards):
- 🎒 **Adventure**: the fox leaves for a few minutes (the length of your break) and comes back with a postcard + souvenir from one of 8 places.
- 🎁 **Gift**: 11 pieces of decor that show up in the room (fairy lights, mushroom lamp that glows at night, teddy bear, heart rug...).
- 🍓 **Treat**: 8 snacks that fill the tummy. The fox secretly has two favourites to discover.
- 🎀 **Clothes**: 11 outfits (frog hat, strawberry hat, beret, flower crown, heart shades, scarf...). Mix and match in the closet.
- 💌 **Note**: the fox writes you a little letter. ~40 notes, some depending on time of day, session length and your streak.

**A little life sim (Sims-style)**
- **Needs:** hunger, energy, fun, hygiene and social, shown as five bars. Mood comes from all of them, and one very low need drags it down. A mood gem floats over the fox's head.
- **Free will:** the fox walks around the room by itself. It eats from its bowl when hungry, naps when tired, plays with the ball or yarn, reads your casebooks at the desk, looks out the window, and hugs its teddy when lonely. Thought bubbles show what it wants.
- **Pie menus:** tap the fox for pet, cuddle, chat, brush fur, dance, play tag, give a treat or quiz me. Tap furniture to use it: refill the bowl, bath time, take a nap, study together at the desk, and so on. The current action shows as a chip you can cancel.
- **A bigger room:** swipe to pan across it. There's a living room, a study corner with a green banker's lamp, a clawfoot bathtub, a food bowl and a wall clock that shows the real time.
- **Decor:** wallpapers and floors to choose from, with more unlocked by the career.
- **While you're away** the fox looks after itself (a full bowl buys it about a day), but it still gets sad after about 2 days and depressed around day 3. The room turns grey, the fox curls up under a rain cloud, and it leaves "while you were away..." letters.
- The window follows the real time of day, and the fox sleeps in its basket at night.

**Law school edition**
- **Career ladder:** every hour of focus moves the fox up: Pre-Law Pup, 1L, 2L, 3L, Law Graduate, Passed the Bar, Associate, Senior Associate, Partner, Judge, Supreme Court Justice. Each promotion gets a celebration and unlocks something (grad cap, tie, judge wig, diploma, gavel, scales of justice, wallpapers).
- **Subjects:** one-tap chips on the focus screen (Torts, Contracts, Civ Pro, Crim Law, Con Law, Property, Evidence, Legal Writing...), with study time per subject on the career screen. Edit the list in `src/gift.ts`.
- **Legal Latin flashcards:** the fox quizzes you on 26 terms (mens rea, stare decisis, res ipsa loquitur...). Tap the fox → *quiz me*, the desk → *flashcards*, or use it during breaks.
- Law-pun notes from the fox ("IRAC. issue: you're tired..."), a Law Library and Courthouse Steps adventure.
- Streaks, a daily "4 acorns" goal and a weekly chart.

**Look & feel**: everything is hand-made pixel art drawn in code (no image files), in a
warm pink/cream kawaii palette, with *Pixelify Sans* + *DotGothic16* pixel fonts and small
chiptune sound effects.

## Make it personal 💌

Edit [`src/gift.ts`](src/gift.ts):

```ts
export const GIFT = {
  appName: 'TamaLucy',        // home-screen name
  recipientName: 'Lucy',      // pre-filled "your name"
  foxName: 'Mochi',           // suggested fox name (they can rename it)
  from: '',                   // your name, signs the secret letters
  welcome: '',                // optional message on the very first screen
  secretNotes: [],            // your own letters, see below
}
```

**Secret letters**: anything you put in `secretNotes` is delivered by the fox in
order, "found tucked under the rug". One is guaranteed after the 1st, 3rd, 7th,
12th, 20th, 30th... completed focus session, and they can also turn up when the
fox writes a note. This is the best place to hide something sweet.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # game-logic unit tests
npm run build      # production build in dist/
```

**Try the whole loop in a minute:** open the app with `?debug` (or `#debug`) on the end of the
URL. That adds a 6-second focus length and a 12-second break/adventure length
(Settings → break length), so you can see every reward without waiting.

## Put it on a phone

1. **Host `dist/`** anywhere static. Paths are relative, so any folder works:
   - **GitHub Pages**: repo Settings → Pages → Source "GitHub Actions", then run the
     *Deploy to GitHub Pages* workflow from the Actions tab. (Pages on a private repo needs a paid GitHub plan.)
   - **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, output folder `dist`.
2. **Open the link on the phone and add it to the home screen:**
   - iPhone (Safari): Share → *Add to Home Screen*
   - Android (Chrome): ⋮ → *Install app*

   Installed, it opens full-screen, works offline, and (on iPhone) its saved data
   isn't subject to Safari's 7-day storage cleanup.

Progress is saved on the device (localStorage), so nothing leaves the phone.

## About "you can't touch other apps"

Web apps aren't allowed to block other apps, so TamaLucy does what focus apps
like Forest do: it **detects when you leave** (the page goes to the background)
and makes it cost something. The fox wakes up worried and the session doesn't
count. It also catches the app being killed or reloaded mid-session, and
keeps the screen awake so the phone doesn't auto-lock and trip the timer.

For a real lock, both phones have one built in, and the app explains how in
*Focus → "lock my phone for real"*:
- **iPhone: Guided Access** (Settings → Accessibility → Guided Access, then triple-click the side button in the app).
- **Android: App pinning** (Settings → Security → App pinning).

True OS-level app blocking needs a native app: Apple's Screen Time API
(FamilyControls) with an Apple-approved entitlement, or Android's usage-access
and accessibility APIs. Wrapping this project with Capacitor is the most direct
route there if you ever want it.

## Project layout

```
src/
  gift.ts            ← personalise here
  art/               pixel art as code: fox, clothes, items, room (+ day/night)
  game/              state + save migration, needs & offline simulation, sessions,
                     rewards, law career, flashcards, text content, tests
  ui/                canvas renderer, the room (camera, pie menus), the fox's
                     free-will brain (brain.ts), shared widgets
  screens/           onboarding, home, focus, rewards, break, closet, album, stats, settings
scripts/
  make-icons.ts      renders the app icons from the fox sprite (npm run icons)
  sprite-sheet.ts    renders all sprites to sprites.png for quick art edits (npm run sprites)
```

The sprites are text grids (one character per pixel, colours in
`src/art/palette.ts`), so tweaking the fox is a text edit. Run `npm run sprites`
to see the result.
