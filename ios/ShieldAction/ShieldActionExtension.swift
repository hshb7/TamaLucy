// The buttons on the fox's block screen.
import Foundation
import ManagedSettings
import UserNotifications

final class ShieldActionExtension: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
        respond(to: action, completionHandler)
    }

    private func respond(to action: ShieldAction, _ completion: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonPressed:
            // "back to studying": close the blocked app
            completion(.close)
        case .secondaryButtonPressed:
            // "use it anyway": the session is over. TamaLucy reads this when she comes
            // back (the fox is sad, the session doesn't count). Lift the block and let her in.
            Shared.defaults.set(Date().timeIntervalSince1970, forKey: Shared.Key.brokeAt)
            ManagedSettingsStore(named: .focus).clearAllSettings()
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [Shared.timesUpNotification])
            completion(.defer)
        @unknown default:
            completion(.close)
        }
    }
}
