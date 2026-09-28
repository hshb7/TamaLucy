import ActivityKit
import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit
import UserNotifications

/// Everything the web app asks the iPhone to do (see src/native.ts).
@MainActor
final class FocusBridge {
    private weak var host: UIViewController?
    private let store = ManagedSettingsStore(named: .focus)

    init(host: UIViewController) {
        self.host = host
    }

    func handle(_ cmd: String, _ body: [String: Any]) async -> Any {
        switch cmd {
        case "focus.start": return await startFocus(body)
        case "focus.end": return endFocus(done: body["reason"] as? String == "done")
        case "focus.broke": return takeBrokeAt()
        case "blocking.status": return blockingStatus()
        case "blocking.choose": return await chooseApps()
        case "haptic": haptic(body["style"] as? String ?? "light"); return true
        default: return NSNull()
        }
    }

    // MARK: - focus sessions

    /// A session started (or its end moved): Dynamic Island, blocked apps, "time's up" notification.
    private func startFocus(_ body: [String: Any]) async -> Bool {
        guard let endsMs = (body["endsAt"] as? NSNumber)?.doubleValue,
              let startedMs = (body["startedAt"] as? NSNumber)?.doubleValue else { return false }
        let endsAt = Date(timeIntervalSince1970: endsMs / 1000)
        let startedAt = Date(timeIntervalSince1970: startedMs / 1000)
        guard endsAt > .now else { return false }
        let fox = body["fox"] as? String ?? "your fox"
        let label = body["label"] as? String ?? ""

        let shared = Shared.defaults
        shared.set(fox, forKey: Shared.Key.foxName)
        shared.set(endsAt.timeIntervalSince1970, forKey: Shared.Key.endsAt)
        UIApplication.shared.isIdleTimerDisabled = true

        showInDynamicIsland(fox: fox, label: label, startedAt: startedAt, endsAt: endsAt)
        blockApps(until: endsAt)
        await scheduleTimesUp(fox: fox, at: endsAt)
        return true
    }

    /// The session is over (done, given up, or failed): unblock everything.
    private func endFocus(done: Bool) -> Bool {
        UIApplication.shared.isIdleTimerDisabled = false
        store.clearAllSettings()
        DeviceActivityCenter().stopMonitoring([.focus])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Shared.timesUpNotification])
        Shared.defaults.removeObject(forKey: Shared.Key.endsAt)
        for activity in Activity<FocusAttributes>.activities {
            let state = FocusAttributes.ContentState(endsAt: activity.content.state.endsAt, done: done)
            // a finished session stays on the lock screen a little while; anything else goes right away
            let dismissal: ActivityUIDismissalPolicy = done ? .after(.now.addingTimeInterval(15 * 60)) : .immediate
            Task { await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: dismissal) }
        }
        return true
    }

    /// When she tapped "use it anyway" on a blocked app (ms since 1970), or 0. Reading it clears it.
    private func takeBrokeAt() -> Double {
        let shared = Shared.defaults
        let at = shared.double(forKey: Shared.Key.brokeAt)
        shared.removeObject(forKey: Shared.Key.brokeAt)
        return at * 1000
    }

    // MARK: - Dynamic Island

    private func showInDynamicIsland(fox: String, label: String, startedAt: Date, endsAt: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let content = ActivityContent(state: FocusAttributes.ContentState(endsAt: endsAt, done: false), staleDate: endsAt.addingTimeInterval(60))
        let activities = Activity<FocusAttributes>.activities
        if let same = activities.first(where: { $0.attributes.startedAt == startedAt }) {
            // same session, the end moved (the timer was paused)
            Task { await same.update(content) }
            return
        }
        for old in activities {
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        _ = try? Activity.request(
            attributes: FocusAttributes(foxName: fox, label: label, startedAt: startedAt),
            content: content,
            pushType: nil
        )
    }

    // MARK: - blocking apps (Screen Time)

    private func loadSelection() -> FamilyActivitySelection? {
        guard let data = Shared.defaults.data(forKey: Shared.Key.selection) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    private func saveSelection(_ selection: FamilyActivitySelection) {
        Shared.defaults.set(try? JSONEncoder().encode(selection), forKey: Shared.Key.selection)
    }

    private func count(_ s: FamilyActivitySelection?) -> Int {
        guard let s else { return 0 }
        return s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count
    }

    private func blockingStatus() -> [String: Any] {
        [
            "available": true,
            "authorized": AuthorizationCenter.shared.authorizationStatus == .approved,
            "count": count(loadSelection()),
        ]
    }

    /// Screen Time permission (Face ID / passcode, once), then Apple's app picker.
    private func chooseApps() async -> [String: Any] {
        if AuthorizationCenter.shared.authorizationStatus != .approved {
            do {
                try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            } catch {
                return blockingStatus()
            }
        }
        guard let host else { return blockingStatus() }
        let picked: FamilyActivitySelection? = await withCheckedContinuation { done in
            let sheet = AppPickerSheet(selection: loadSelection() ?? FamilyActivitySelection()) { result in
                host.dismiss(animated: true)
                done.resume(returning: result)
            }
            let controller = UIHostingController(rootView: sheet)
            // it has to end with Cancel or Done, so the continuation always resumes
            controller.isModalInPresentation = true
            host.present(controller, animated: true)
        }
        if let picked { saveSelection(picked) }
        return blockingStatus()
    }

    private func blockApps(until endsAt: Date) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved,
              let selection = loadSelection(), count(selection) > 0 else { return }
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)

        // Safety net: the monitor extension lifts the block when time's up, even if
        // TamaLucy was closed. Screen Time schedules last at least 15 minutes, so a
        // shorter session ends with the "warning" that fires `warning` before the end.
        let start = Date.now
        let end = max(endsAt, start.addingTimeInterval(15 * 60 + 30))
        let warningMinutes = Int(end.timeIntervalSince(endsAt) / 60)
        let calendar = Calendar.current
        let parts: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let schedule = DeviceActivitySchedule(
            intervalStart: calendar.dateComponents(parts, from: start),
            intervalEnd: calendar.dateComponents(parts, from: end),
            repeats: false,
            warningTime: warningMinutes > 0 ? DateComponents(minute: warningMinutes) : nil
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.focus])
        try? center.startMonitoring(.focus, during: schedule)
    }

    // MARK: - little things

    private func scheduleTimesUp(fox: String, at date: Date) async {
        let center = UNUserNotificationCenter.current()
        _ = try? await center.requestAuthorization(options: [.alert, .sound])
        let content = UNMutableNotificationContent()
        content.title = "time’s up! \(fox) is so proud of you"
        content.body = "come back to \(fox) for your reward ✿"
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, date.timeIntervalSinceNow), repeats: false)
        center.removePendingNotificationRequests(withIdentifiers: [Shared.timesUpNotification])
        try? await center.add(UNNotificationRequest(identifier: Shared.timesUpNotification, content: content, trigger: trigger))
    }

    private func haptic(_ style: String) {
        switch style {
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }
}

/// Apple's app picker, with Cancel and Done.
private struct AppPickerSheet: View {
    @State private var selection: FamilyActivitySelection
    let finish: (FamilyActivitySelection?) -> Void

    init(selection: FamilyActivitySelection, finish: @escaping (FamilyActivitySelection?) -> Void) {
        _selection = State(initialValue: selection)
        self.finish = finish
    }

    var body: some View {
        NavigationStack {
            FamilyActivityPicker(selection: $selection)
                .navigationTitle("apps to block while you focus")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { finish(nil) } }
                    ToolbarItem(placement: .confirmationAction) { Button("Done") { finish(selection) } }
                }
        }
    }
}
