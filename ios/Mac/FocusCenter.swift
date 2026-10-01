import AppKit
import SwiftUI
import UniformTypeIdentifiers
import UserNotifications

/// An app she picked as distracting.
struct WatchedApp: Codable, Hashable {
    var id: String
    var name: String
}

/// Everything the web app asks the Mac to do (see src/native.ts), plus the
/// menu bar fox. On a Mac she studies in other apps, so nothing is blocked:
/// the fox only pops up when she opens one of the apps she picked.
@MainActor
final class FocusCenter: NSObject, NSMenuDelegate {
    static let shared = FocusCenter()

    struct Session {
        var startedAt: Date
        var endsAt: Date
        var label: String
        var fox: String
    }

    /// Tells the web app something happened (it's often still on screen).
    var emit: ((String) -> Void)?

    private(set) var session: Session?
    private weak var window: NSWindow?
    private var statusItem: NSStatusItem?
    private var ticker: Timer?
    private var watcher: NSObjectProtocol?
    private var grace: Task<Void, Never>?
    private var brokeAt: Date?
    private let panel = DistractionPanel()

    private let defaults = UserDefaults.standard
    private var keepOnTop: Bool {
        get { defaults.bool(forKey: "keepOnTop") }
        set { defaults.set(newValue, forKey: "keepOnTop") }
    }
    private var watched: [WatchedApp] {
        get { defaults.data(forKey: "watchedApps").flatMap { try? JSONDecoder().decode([WatchedApp].self, from: $0) } ?? [] }
        set { defaults.set(try? JSONEncoder().encode(newValue), forKey: "watchedApps") }
    }

    // MARK: - setup

    func setUp() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.image = NSImage(named: "FoxMenu")
        item.button?.imagePosition = .imageLeading
        item.button?.font = .monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .medium)
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
        statusItem = item
    }

    func attach(_ window: NSWindow) {
        self.window = window
        window.level = keepOnTop ? .floating : .normal
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 1, green: 0.957, blue: 0.91, alpha: 1)
    }

    // MARK: - the bridge

    func handle(_ cmd: String, _ body: [String: Any]) async -> Any {
        switch cmd {
        case "focus.start": return startFocus(body)
        case "focus.end": return endFocus()
        case "focus.broke": return takeBrokeAt()
        case "blocking.status": return blockingStatus()
        case "blocking.choose": return chooseApps()
        case "haptic": return true // trackpads only buzz under a finger; nothing to do
        default: return NSNull()
        }
    }

    private func startFocus(_ body: [String: Any]) -> Bool {
        guard let endsMs = (body["endsAt"] as? NSNumber)?.doubleValue,
              let startedMs = (body["startedAt"] as? NSNumber)?.doubleValue else { return false }
        let next = Session(
            startedAt: Date(timeIntervalSince1970: startedMs / 1000),
            endsAt: Date(timeIntervalSince1970: endsMs / 1000),
            label: body["label"] as? String ?? "",
            fox: body["fox"] as? String ?? "your fox"
        )
        guard next.endsAt > .now else { return false }
        if session?.startedAt != next.startedAt { brokeAt = nil }
        session = next
        startTicker()
        startWatching()
        scheduleTimesUp(next)
        return true
    }

    private func endFocus() -> Bool {
        session = nil
        ticker?.invalidate()
        ticker = nil
        stopWatching()
        statusItem?.button?.title = ""
        NSApp.dockTile.badgeLabel = nil
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["timesUp"])
        return true
    }

    /// When she gave in to a distracting app (ms since 1970), or 0. Reading it clears it.
    private func takeBrokeAt() -> Double {
        defer { brokeAt = nil }
        return (brokeAt?.timeIntervalSince1970 ?? 0) * 1000
    }

    private func blockingStatus() -> [String: Any] {
        ["available": true, "authorized": true, "count": watched.count, "platform": "mac"]
    }

    /// Pick distracting apps from /Applications (choosing again replaces the list).
    private func chooseApps() -> [String: Any] {
        let picker = NSOpenPanel()
        picker.title = "Apps that distract you"
        picker.message = "During focus, opening one of these brings up your fox."
        picker.prompt = "Choose"
        picker.allowedContentTypes = [.application]
        picker.allowsMultipleSelection = true
        picker.canChooseDirectories = false
        picker.directoryURL = URL(fileURLWithPath: "/Applications")
        NSApp.activate(ignoringOtherApps: true)
        if picker.runModal() == .OK {
            let apps = picker.urls.compactMap { url -> WatchedApp? in
                guard let id = Bundle(url: url)?.bundleIdentifier, id != Bundle.main.bundleIdentifier else { return nil }
                return WatchedApp(id: id, name: FileManager.default.displayName(atPath: url.path).replacingOccurrences(of: ".app", with: ""))
            }
            watched = Array(Set(apps)).sorted { $0.name < $1.name }
        }
        return blockingStatus()
    }

    // MARK: - menu bar + Dock

    private func startTicker() {
        ticker?.invalidate()
        ticker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            Task { @MainActor in FocusCenter.shared.tick() }
        }
        tick()
    }

    private func tick() {
        guard let session else { return }
        let left = Int(session.endsAt.timeIntervalSinceNow.rounded(.up))
        if left <= 0 {
            // time's up: the web app takes it from here when she comes back
            statusItem?.button?.title = " done!"
            NSApp.dockTile.badgeLabel = "✿"
            stopWatching()
            ticker?.invalidate()
            ticker = nil
            return
        }
        statusItem?.button?.title = String(format: " %d:%02d", left / 60, left % 60)
        NSApp.dockTile.badgeLabel = "\(Int((Double(left) / 60).rounded(.up)))m"
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        if let session {
            let what = session.label.isEmpty ? "studying with \(session.fox)" : session.label
            let left = max(0, Int((session.endsAt.timeIntervalSinceNow / 60).rounded(.up)))
            menu.addItem(withTitle: left > 0 ? "\(what) · \(left) min left" : "\(what) · done! ✿", action: nil, keyEquivalent: "")
            menu.addItem(.separator())
        }
        menu.addItem(item("Open TamaLucy", #selector(openWindow), key: "o"))
        let top = item("Keep Window on Top", #selector(toggleKeepOnTop))
        top.state = keepOnTop ? .on : .off
        menu.addItem(top)
        menu.addItem(.separator())
        menu.addItem(item("Quit TamaLucy", #selector(quit), key: "q"))
    }

    private func item(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func openWindow() {
        NSApp.activate(ignoringOtherApps: true)
        if let window {
            window.makeKeyAndOrderFront(nil)
        } else {
            // the window was closed: clicking the Dock icon brings it back
            NSWorkspace.shared.open(Bundle.main.bundleURL)
        }
    }

    @objc private func toggleKeepOnTop() {
        keepOnTop.toggle()
        window?.level = keepOnTop ? .floating : .normal
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    // MARK: - distracting apps

    private func startWatching() {
        guard watcher == nil else { return }
        watcher = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { note in
            let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            Task { @MainActor in FocusCenter.shared.activated(app) }
        }
    }

    private func stopWatching() {
        if let watcher { NSWorkspace.shared.notificationCenter.removeObserver(watcher) }
        watcher = nil
        grace?.cancel()
        panel.hide()
    }

    private func activated(_ app: NSRunningApplication?) {
        guard let session, session.endsAt > .now, brokeAt == nil,
              let app, let id = app.bundleIdentifier else { return }
        guard let hit = watched.first(where: { $0.id == id }) else {
            // somewhere fine (her readings, Word, TamaLucy): the fox relaxes
            grace?.cancel()
            panel.hide()
            return
        }
        let minutes = max(1, Int((session.endsAt.timeIntervalSinceNow / 60).rounded(.up)))
        panel.show(FoxPanel(
            fox: session.fox,
            appName: hit.name,
            minutesLeft: minutes,
            back: { FocusCenter.shared.backToStudying(app) },
            anyway: { FocusCenter.shared.giveIn() }
        ))
        // ignoring the fox and staying in the app counts as giving in
        grace?.cancel()
        grace = Task {
            try? await Task.sleep(nanoseconds: 20_000_000_000)
            guard !Task.isCancelled else { return }
            if NSWorkspace.shared.frontmostApplication?.bundleIdentifier == id { FocusCenter.shared.giveIn() }
        }
    }

    private func backToStudying(_ app: NSRunningApplication) {
        grace?.cancel()
        panel.hide()
        app.hide()
        openWindow()
    }

    private func giveIn() {
        grace?.cancel()
        panel.hide()
        brokeAt = .now
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["timesUp"])
        // the web app ends the session (and the fox is sad) right away
        emit?("broke")
    }

    // MARK: - "time's up!"

    private func scheduleTimesUp(_ session: Session) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        let content = UNMutableNotificationContent()
        content.title = "time’s up! \(session.fox) is so proud of you"
        content.body = "come back to \(session.fox) for your reward ✿"
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, session.endsAt.timeIntervalSinceNow), repeats: false)
        center.removePendingNotificationRequests(withIdentifiers: ["timesUp"])
        center.add(UNNotificationRequest(identifier: "timesUp", content: content, trigger: trigger))
    }
}
