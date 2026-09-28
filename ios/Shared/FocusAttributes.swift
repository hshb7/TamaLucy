// What the Dynamic Island and the lock screen show for a focus session.
// Shared by the app (which starts, updates and ends it) and the widget (which draws it).
import ActivityKit
import Foundation

struct FocusAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var endsAt: Date
        /// The timer ran out and she earned her reward.
        var done: Bool
    }

    var foxName: String
    /// What she's working on ("Torts outline"), or empty.
    var label: String
    var startedAt: Date
}
