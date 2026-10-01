import AppKit
import SwiftUI

/// The fox that floats over a distracting app during focus.
struct FoxPanel: View {
    let fox: String
    let appName: String
    let minutesLeft: Int
    let back: () -> Void
    let anyway: () -> Void

    private let cocoa = Color(red: 0.29, green: 0.165, blue: 0.133)

    var body: some View {
        VStack(spacing: 12) {
            Image("FoxStudy")
                .resizable()
                .interpolation(.none)
                .frame(width: 128, height: 80)
            Text("\(fox) is studying ✿")
                .font(.title2.weight(.semibold))
            Text("\(appName) can wait. only \(minutesLeft) minute\(minutesLeft == 1 ? "" : "s") to go, you’ve got this!")
                .multilineTextAlignment(.center)
                .foregroundStyle(cocoa.opacity(0.75))
            Button(action: back) {
                Text("back to studying").frame(maxWidth: .infinity).padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(red: 0.91, green: 0.45, blue: 0.55))
            .keyboardShortcut(.defaultAction)
            Button("use it anyway (ends the session)", action: anyway)
                .buttonStyle(.link)
                .foregroundStyle(cocoa.opacity(0.7))
            Text("staying in \(appName) ends the session too.")
                .font(.caption)
                .foregroundStyle(cocoa.opacity(0.5))
        }
        .foregroundStyle(cocoa)
        .fontDesign(.rounded)
        .padding(28)
        .frame(width: 360)
        .background(Color(red: 1, green: 0.957, blue: 0.91))
    }
}

/// A small window that stays above everything (even full-screen apps)
/// without pulling focus away from the app she's in.
@MainActor
final class DistractionPanel {
    private var panel: NSPanel?

    func show(_ content: FoxPanel) {
        let panel = self.panel ?? makePanel()
        panel.contentView = NSHostingView(rootView: content)
        panel.setContentSize(panel.contentView?.fittingSize ?? NSSize(width: 360, height: 320))
        panel.center()
        panel.orderFrontRegardless()
        self.panel = panel
    }

    func hide() {
        panel?.orderOut(nil)
    }

    private func makePanel() -> NSPanel {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 320),
            styleMask: [.titled, .fullSizeContentView, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isFloatingPanel = true
        panel.level = .statusBar
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        return panel
    }
}
