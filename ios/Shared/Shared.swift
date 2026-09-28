// Shared by the app and its Screen Time extensions (shield screen, shield
// button, activity monitor). They talk through the App Group's UserDefaults.
import DeviceActivity
import Foundation
import ManagedSettings

enum Shared {
    /// The App Group (group.<APP_ID>), read from each target's Info.plist.
    static let appGroup = Bundle.main.object(forInfoDictionaryKey: "TLAppGroup") as? String ?? "group.tamalucy"
    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

    enum Key {
        /// The apps she chose to block (FamilyActivitySelection as JSON).
        static let selection = "blockedSelection"
        static let foxName = "foxName"
        /// When the running session ends (seconds since 1970), or absent.
        static let endsAt = "focusEndsAt"
        /// When she tapped "use it anyway" on a blocked app (seconds since 1970).
        static let brokeAt = "focusBrokeAt"
    }

    /// The pending "time's up!" notification.
    static let timesUpNotification = "timesUp"
}

extension ManagedSettingsStore.Name {
    /// Everything blocked for a focus session lives in this one store.
    static let focus = Self("focus")
}

extension DeviceActivityName {
    static let focus = Self("focus")
}
