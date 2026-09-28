// A safety net: when a focus session's time is up, her apps unlock, even if
// TamaLucy was closed or crashed. (The app also unlocks them itself when a
// session ends normally.)
import DeviceActivity
import ManagedSettings

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity == .focus { unlock() }
    }

    /// Short sessions: Screen Time schedules last at least 15 minutes, so the app
    /// sets the warning to fire exactly when the session's time is up.
    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
        if activity == .focus { unlock() }
    }

    private func unlock() {
        ManagedSettingsStore(named: .focus).clearAllSettings()
    }
}
