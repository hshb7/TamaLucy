import Foundation
import UserNotifications

/// The fox's reminders while the app is closed ("Mochi misses you", "exam
/// tomorrow"). The web app plans them from her save (src/game/reminders.ts)
/// and hands the whole plan over every time it changes; this replaces the
/// previous one. The "time's up" notification is separate and untouched.
enum Reminders {
    private static let prefix = "tl."

    /// Handles the notify.* commands; nil for anything else.
    static func handle(_ cmd: String, _ body: [String: Any]) async -> Any? {
        switch cmd {
        case "notify.status": return await status()
        case "notify.ask": return await ask()
        case "notify.sync": return await sync(body["items"] as? [[String: Any]] ?? [])
        default: return nil
        }
    }

    private static func state() async -> String {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional: return "granted"
        case .denied: return "denied"
        default: return "notasked"
        }
    }

    private static func status() async -> [String: Any] {
        ["available": true, "state": await state()]
    }

    private static func ask() async -> [String: Any] {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        return await status()
    }

    private static func sync(_ items: [[String: Any]]) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let ours = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        let now = Date.now.timeIntervalSince1970 * 1000
        for item in items.prefix(48) {
            guard let id = item["id"] as? String,
                  let at = (item["at"] as? NSNumber)?.doubleValue, at > now + 1000 else { continue }
            let content = UNMutableNotificationContent()
            content.title = item["title"] as? String ?? ""
            content.body = item["body"] as? String ?? ""
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: (at - now) / 1000, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
        }
        return true
    }
}
