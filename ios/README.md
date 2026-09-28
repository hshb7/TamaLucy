# TamaLucy for iPhone

The same app as the website, wrapped as a real iPhone app so it can do the two
things a website can't:

- **The fox in the Dynamic Island** (and on the lock screen) with a live countdown
  while she focuses. Needs an iPhone with a Dynamic Island (iPhone 14 Pro and later,
  every iPhone 15 and later); other iPhones show it on the lock screen.
- **Her distracting apps locked during focus.** She picks them once (Settings →
  *block distracting apps*). While the timer runs they open to a fox screen instead:
  *"Mochi is studying ✿ … back to studying"*. *"use it anyway"* unlocks the app and
  ends the session, and the fox is sad when she comes back. Other apps (her readings,
  notes) keep working.

It uses Apple's Screen Time: she approves it with Face ID, and the app never sees
which apps she uses. Nothing about her phone is sent anywhere.

Everything else (the fox, acorns, letters, sync with her Mac) is the web app inside,
so it's the same fox as on her Mac. The Mac keeps using the website version (see the
main README).

## What's in here

```
project.yml        the Xcode project, described for XcodeGen (you set APP_ID + team here)
App/               the app: a full-screen web view + FocusBridge (Dynamic Island, blocking, haptics)
Widget/            the Live Activity (Dynamic Island + lock screen)
Shield/            the fox screen on a blocked app
ShieldAction/      its buttons ("back to studying" / "use it anyway")
Monitor/           unlocks her apps when time's up, even if TamaLucy was closed
Shared/            code and fox images shared between them
```

The web app talks to the native side through `src/native.ts`.

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
   the app, its four extensions, the App Group and the Family Controls capability for
   you. The first time, her iPhone asks to turn on **Developer Mode** (Settings →
   Privacy & Security → Developer Mode) and restarts.
6. **On her phone:** open TamaLucy, sign in with her mailbox code (first screen →
   *"i already have my fox on another device"*), then Settings → **block distracting
   apps** → choose apps. Start a focus session and the fox moves into the Dynamic Island.

An app installed from Xcode like this keeps working for a year (your development
profile's lifetime). Run it from Xcode again to renew it, or to update it after you
change the web app (`npm run build` first).

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
- **No fox in the Dynamic Island** → Settings → TamaLucy → *Live Activities* on. On iPhones
  without a Dynamic Island it appears on the lock screen.
- **"choose apps" does nothing** → Screen Time must be allowed: Settings → Screen Time →
  on; then try again and approve with Face ID.
- **A blocked app stays locked after "use it anyway"** → open TamaLucy once; it ends the
  session and lifts every block. (A known Screen Time quirk in some builds:
  <https://developer.apple.com/forums/thread/807934>.)
- **Debugging the web part** → on the Mac, Safari → Settings → Advanced → *Show features for
  web developers*, then Develop → her iPhone → TamaLucy.
