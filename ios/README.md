# TamaLucy for iPhone and Mac

The same app as the website, wrapped as real iPhone and Mac apps. One Xcode project,
two apps, and the same fox on both (her mailbox code signs her in on each).

## iPhone

The iPhone app can do the two things a website can't:

- **The fox in the Dynamic Island** (and on the lock screen) with a live countdown
  while she focuses. Needs an iPhone with a Dynamic Island (iPhone 14 Pro and later,
  every iPhone 15 and later); other iPhones show it on the lock screen.
- **Her fox on the home screen.** A small or medium widget: the fox in its outfit in front
  of her wallpaper (or a colour), with today's focus, a class's hours, days to her next
  exam, her streak or her acorns, plus a line she writes herself. She styles it in the app
  (Settings → *your widget*, or Decor), and the Dynamic Island uses the same style.
- **Her distracting apps locked during focus.** She picks them once (Settings →
  *block distracting apps*). While the timer runs they open to a fox screen instead:
  *"Mochi is studying ✿ … back to studying"*. *"use it anyway"* unlocks the app and
  ends the session, and the fox is sad when she comes back. Other apps (her readings,
  notes) keep working.

The widget and the Dynamic Island need iOS 17 or later. Blocking apps uses Apple's Screen Time: she approves it with Face ID, and the app never sees
which apps she uses. Nothing about her phone is sent anywhere.

Everything else (the fox, acorns, letters, syncing) is the web app inside, so it's the
same fox as on her Mac.

## Mac

On a Mac she studies in other apps (Word, PDFs, Westlaw), so nothing gets locked.
Instead:

- **The fox and a countdown in the menu bar** for the whole session (the Mac's Dynamic
  Island), plus minutes left on the Dock icon. Click the fox for *Open TamaLucy* and
  *Keep Window on Top* (a little study buddy in the corner of her screen).
- **A fox over her distracting apps.** She picks them once (Settings → *distracting
  apps*). During focus, opening one brings up a floating fox: *back to studying* hides
  the app, *use it anyway* ends the session. Staying in the app for 20 seconds ends it
  too. The app only notices the apps she picked, and only during focus.
- **"Time's up!" notifications**, even with the window closed: TamaLucy keeps running in
  the menu bar.
- **Her iPhone widget on the desktop**, if she likes: macOS 14 or later can show iPhone
  widgets (right-click the desktop → *Edit Widgets*, with the iPhone on the same Apple
  Account; System Settings → Desktop & Dock → *Use iPhone widgets*).

## What's in here

```
project.yml        the Xcode project, described for XcodeGen (you set APP_ID + team here)
App/               the iPhone app: a full-screen web view + FocusBridge (Dynamic Island, blocking, haptics)
Mac/               the Mac app: window, menu bar fox (FocusCenter), the fox over distracting apps
Widget/            the home screen widget and the Live Activity (Dynamic Island + lock screen)
Shield/            the fox screen on a blocked app
ShieldAction/      its buttons ("back to studying" / "use it anyway")
Monitor/           unlocks her apps when time's up, even if TamaLucy was closed
Shared/            code and fox images shared between them
```

The web app talks to both native sides through `src/native.ts`.

## Build it and put it on her phone

You need a Mac with **Xcode 15 or later**, your **paid Apple Developer account**, and
**Node 20+**.

1. **Install the tools** (once):
   ```bash
   brew install xcodegen        # https://brew.sh if you don't have Homebrew
   ```
2. **Build the web app** from the repo folder (the iPhone app bundles it):
   ```bash
   npm install
   npm run build
   ```
   If you keep personal letters in `src/gift.local.ts`, this is the build that includes them.
3. **Set your ids** in `ios/project.yml`:
   - `APP_ID`: your own reverse-DNS id, e.g. `com.yourname.tamalucy`
   - `DEVELOPMENT_TEAM`: your Team ID (developer.apple.com → Account → Membership details)
4. **Generate and open the project:**
   ```bash
   cd ios
   xcodegen
   open TamaLucy.xcodeproj
   ```
   (`npm run ios` does steps 2 and 4 in one go.)
5. **Run it on her iPhone.** Plug her iPhone into the Mac, pick it as the run
   destination at the top of Xcode, and press ▶. Signing is automatic: Xcode registers
   the app, its four extensions, the App Group (the app and the widget share it) and the
   Family Controls capability for you. The first time, her iPhone asks to turn on **Developer Mode** (Settings →
   Privacy & Security → Developer Mode) and restarts.
6. **On her phone:** open TamaLucy, sign in with her mailbox code (first screen →
   *"i already have my fox on another device"*), then Settings → **block distracting
   apps** → choose apps. Start a focus session and the fox moves into the Dynamic Island.
7. **The widget:** touch and hold the home screen → **+** → search *TamaLucy* → small or
   medium → *Add Widget*. It updates whenever she opens the app.

An app installed from Xcode like this keeps working for a year (your development
profile's lifetime). Run it from Xcode again to renew it, or to update it after you
change the web app (`npm run build` first).

## The Mac app

Same project, same `APP_ID` and team (the Mac app's id is `APP_ID.mac`).

1. **Try it on your Mac:** at the top of Xcode pick the **TamaLucyMac** scheme and
   **My Mac**, then press ▶. Sign in with her code (or set up a test fox), pick a couple
   of distracting apps in Settings and start a focus session: the fox appears in the menu
   bar, and opening one of those apps brings up the fox.
2. **Give it to her:** with the **TamaLucyMac** scheme selected, Product → **Archive**.
   In the window that opens: **Distribute App** → **Direct Distribution**. Xcode signs it
   with your Developer ID and has Apple notarize it (a few minutes), then **Export** saves
   `TamaLucy.app`. Zip it and AirDrop/send it to her Mac. She drags it into Applications
   and opens it like any app, with no warnings and no App Store needed.
3. **On her Mac:** open TamaLucy, sign in with her mailbox code (first screen →
   *"i already have my fox on another device"*), Settings → **distracting apps** →
   choose apps, and allow notifications when asked.

To update it later: `npm run build`, Archive and export again, send the new app.

## TestFlight instead (no cable, installs like a normal app)

Apple treats Screen Time as sensitive, so an app that uses it can go through TestFlight or
the App Store only after Apple approves the **Family Controls (Distribution)** entitlement:

1. Request it at <https://developer.apple.com/contact/request/family-controls-distribution>
   for each bundle id that uses it: `APP_ID`, `APP_ID.shield`, `APP_ID.shield-action` and
   `APP_ID.monitor` (not `.widget`). It usually takes a few days to a few weeks.
2. Once approved, in Xcode: Product → Archive → Distribute App → TestFlight & App Store.
3. In App Store Connect → TestFlight, add her as an internal tester (her Apple ID
   email). She installs the **TestFlight** app and accepts the invite. Builds last 90 days;
   upload a new one to keep going.

The Dynamic Island part needs no approval.

## Troubleshooting

- **"the web app isn't built yet"** when building → run `npm run build` in the repo folder.
- **Signing errors about Family Controls or App Groups** → check `DEVELOPMENT_TEAM` is your
  paid team, then in Xcode select each target → *Signing & Capabilities* → *Try Again*.
- **The widget shows a plain fox** → open TamaLucy once (it sends the widget its style and
  pictures). Still plain? The app and the widget must share the App Group: select the
  FocusWidget target → *Signing & Capabilities* and check *App Groups* lists `group.<APP_ID>`.
- **No fox in the Dynamic Island** → Settings → TamaLucy → *Live Activities* on. On iPhones
  without a Dynamic Island it appears on the lock screen.
- **"choose apps" does nothing** → Screen Time must be allowed: Settings → Screen Time →
  on; then try again and approve with Face ID.
- **A blocked app stays locked after "use it anyway"** → open TamaLucy once; it ends the
  session and lifts every block. (A known Screen Time quirk in some builds:
  <https://developer.apple.com/forums/thread/807934>.)
- **Debugging the web part** → on the Mac, Safari → Settings → Advanced → *Show features for
  web developers*, then Develop → her iPhone (or this Mac) → TamaLucy.
- **Mac: no "time's up" notification** → System Settings → Notifications → TamaLucy → allow.
- **Mac: "TamaLucy can't be opened"** on her Mac → it wasn't notarized; export it with
  *Direct Distribution* (step 2 above), not *Custom* → *Copy App*.
