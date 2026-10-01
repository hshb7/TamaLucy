// TamaLucy for Mac: the same app as the website (bundled from ../dist) in its
// own window, plus what a website can't do on a Mac: the fox and a countdown
// in the menu bar, a Dock badge, and a fox that pops up when she opens one of
// her distracting apps during focus. Lives on in the menu bar when the window
// is closed.
import SwiftUI

@main
struct TamaLucyMacApp: App {
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate

    var body: some Scene {
        Window("TamaLucy", id: "main") {
            MacWebView()
                // narrow it down and it turns into the compact (phone-style) layout,
                // a little study buddy for the corner of the screen
                .frame(minWidth: 380, minHeight: 600)
                .background(Color(red: 1, green: 0.957, blue: 0.91))
        }
        .defaultSize(width: 1180, height: 780)
        .commands {
            // one fox, one window
            CommandGroup(replacing: .newItem) {}
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        FocusCenter.shared.setUp()
    }

    /// Closing the window keeps TamaLucy in the menu bar (a session keeps counting).
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
