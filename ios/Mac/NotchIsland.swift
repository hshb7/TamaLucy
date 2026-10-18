// The fox at the notch: a little island at the top of the screen, like the
// iPhone's Dynamic Island. During a focus session it holds the fox and the
// countdown either side of the notch; hover it (or click) and it opens up with
// what she's working on, the progress and a button into the app. Between
// sessions it's invisible, and a hover over the notch peeks the fox and
// today's focus. A Mac without a notch gets the same pill at the top centre,
// during sessions only.
import AppKit
import SwiftUI

/// What the island shows. FocusCenter keeps it up to date.
@MainActor
final class IslandModel: ObservableObject {
    struct Session: Equatable {
        var startedAt: Date
        var endsAt: Date
        /// What she's working on ("Torts outline"), or empty.
        var label: String
        var fox: String

        var title: String { label.isEmpty ? "studying with \(fox)" : label }
    }

    enum Look: Equatable {
        /// Nothing to see (a hover over the notch still peeks).
        case hidden
        /// The fox and the countdown beside the notch.
        case pill
        /// Opened up: the session's details, or the fox's card between sessions.
        case open
    }

    @Published var session: Session?
    /// The timer ran out; her reward is waiting in the app.
    @Published var done = false
    @Published var hovering = false
    /// Just finished: opens up for a moment on its own.
    @Published var flash = false
    /// The notch's size (or the stand-in's), so the row leaves a gap for it.
    @Published var notch = CGSize(width: 190, height: 32)
    /// Her widget's card (colours, today's numbers) and the fox in its outfit, once the app has sent them.
    @Published var card: FoxCard?
    @Published var study: NSImage?
    @Published var happy: NSImage?
    /// Only a real notch can be hovered when nothing's showing.
    var peeks = true
    var open: () -> Void = {}

    var look: Look {
        if session == nil { return hovering && peeks ? .open : .hidden }
        return hovering || flash ? .open : .pill
    }

    func reloadCard() {
        card = FoxCardStore.load()
        study = FoxCardStore.image("foxStudy")
        happy = FoxCardStore.image("foxHappy")
    }
}

/// The island's window: sized to exactly what's showing (so nothing invisible
/// sits over the menu bar), animated between its looks, hugging the notch.
@MainActor
final class NotchIsland {
    let model = IslandModel()
    var enabled = true {
        didSet { layout(animated: false) }
    }
    /// This screen has a real notch (the island peeks on hover; otherwise it only shows during sessions).
    private(set) var hasNotch = false

    private var panel: NSPanel?
    private var screenWatcher: NSObjectProtocol?
    private var flashTask: Task<Void, Never>?
    private var hoverTask: Task<Void, Never>?

    /// How far the pill reaches past the notch on each side.
    static let ear: CGFloat = 72
    private let openWidth: CGFloat = 420
    private let openHeight: CGFloat = 112

    func setUp(enabled: Bool, open: @escaping () -> Void) {
        model.open = open
        model.reloadCard()
        screenWatcher = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.layout(animated: false) }
        }
        self.enabled = enabled
    }

    // MARK: - what FocusCenter tells it

    func session(_ next: IslandModel.Session?) {
        if next == nil || next?.startedAt != model.session?.startedAt {
            model.done = false
            model.flash = false
            flashTask?.cancel()
        }
        model.session = next
        layout(animated: true)
    }

    /// The timer ran out: open up for a moment, then sit as "done!" until the app ends the session.
    func timesUp() {
        guard model.session != nil, !model.done else { return }
        model.done = true
        model.flash = true
        layout(animated: true)
        flashTask?.cancel()
        flashTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 8_000_000_000)
            guard !Task.isCancelled else { return }
            self?.model.flash = false
            self?.layout(animated: true)
        }
    }

    /// The app sent new words or pictures for the widget; the island uses them too.
    func cardChanged() {
        model.reloadCard()
    }

    private func hover(_ inside: Bool) {
        hoverTask?.cancel()
        if inside {
            // only a lingering pointer opens it: a quick pass across the top of
            // the screen (reaching for the menu bar) leaves it be
            hoverTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 400_000_000)
                guard !Task.isCancelled else { return }
                self?.model.hovering = true
                self?.layout(animated: true)
            }
            return
        }
        // a moment's grace, so the mouse can wander down to the button
        hoverTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            self?.model.hovering = false
            self?.layout(animated: true)
        }
    }

    // MARK: - geometry

    /// The screen with the notch, else the main one.
    private var screen: NSScreen? {
        NSScreen.screens.first { $0.safeAreaInsets.top > 0 } ?? NSScreen.main
    }

    /// The notch's size in points, or a stand-in the height of the menu bar.
    private func measure(_ screen: NSScreen) {
        let inset = screen.safeAreaInsets.top
        hasNotch = inset > 0
        if hasNotch, let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea {
            model.notch = CGSize(width: max(120, right.minX - left.maxX), height: inset)
        } else if hasNotch {
            model.notch = CGSize(width: 190, height: inset)
        } else {
            model.notch = CGSize(width: 190, height: max(22, screen.frame.maxY - screen.visibleFrame.maxY))
        }
        model.peeks = hasNotch
    }

    private func size(for look: IslandModel.Look) -> CGSize {
        let notch = model.notch
        switch look {
        case .hidden: return hasNotch ? notch : .zero
        case .pill: return CGSize(width: notch.width + 2 * NotchIsland.ear, height: notch.height + 6)
        case .open: return CGSize(width: max(openWidth, notch.width + 2 * NotchIsland.ear), height: notch.height + openHeight)
        }
    }

    func layout(animated: Bool) {
        guard enabled, let screen else {
            panel?.orderOut(nil)
            return
        }
        measure(screen)
        let size = size(for: model.look)
        guard size != .zero else {
            panel?.orderOut(nil)
            return
        }
        let panel = self.panel ?? makePanel()
        let frame = NSRect(x: screen.frame.midX - size.width / 2, y: screen.frame.maxY - size.height, width: size.width, height: size.height)
        if animated, panel.isVisible {
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.28
                ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                panel.animator().setFrame(frame, display: true)
            }
        } else {
            panel.setFrame(frame, display: true)
        }
        panel.orderFrontRegardless()
    }

    private func makePanel() -> NSPanel {
        let panel = IslandPanel(
            contentRect: NSRect(x: 0, y: 0, width: 200, height: 40),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isFloatingPanel = true
        // above the menu bar, on every space, over full-screen apps too; never takes focus
        // (set after isFloatingPanel, which would otherwise drop it back to the floating level)
        panel.level = .statusBar
        panel.hidesOnDeactivate = false
        panel.isMovable = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]

        let host = IslandHostView(frame: NSRect(x: 0, y: 0, width: 200, height: 40))
        host.onHover = { [weak self] inside in self?.hover(inside) }
        host.onClick = { [weak self] in self?.model.open() }
        let hosting = NSHostingView(rootView: IslandView(model: model))
        hosting.sizingOptions = []
        hosting.frame = host.bounds
        hosting.autoresizingMask = [.width, .height]
        host.addSubview(hosting)
        panel.contentView = host
        self.panel = panel
        return panel
    }
}

/// A panel allowed over the menu bar: AppKit otherwise keeps every window
/// below it, and the island would sit under the notch instead of beside it.
private final class IslandPanel: NSPanel {
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
}

/// Holds the island and watches the mouse. (SwiftUI's own hover tracking wants a
/// key window, and this panel never becomes one.)
private final class IslandHostView: NSView {
    var onHover: (Bool) -> Void = { _ in }
    var onClick: () -> Void = {}
    private var tracking: NSTrackingArea?

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking { removeTrackingArea(tracking) }
        let area = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self, userInfo: nil)
        addTrackingArea(area)
        tracking = area
    }

    override func mouseEntered(with event: NSEvent) { onHover(true) }
    override func mouseExited(with event: NSEvent) { onHover(false) }
    override func mouseDown(with event: NSEvent) { onClick() }
    override var acceptsFirstResponder: Bool { false }
}

// MARK: - the island itself

private struct IslandView: View {
    @ObservedObject var model: IslandModel

    private let pink = Color(red: 0.96, green: 0.6, blue: 0.65)
    /// The island's side margin: the fox, the text and the button all start here.
    static let margin: CGFloat = 16

    /// Her widget's highlight colour, unless it would vanish on black.
    private var accent: Color {
        guard let card = model.card, Color.luminance(hex: card.accent) > 0.2 else { return pink }
        return Color(hex: card.accent)
    }

    var body: some View {
        let look = model.look
        ZStack(alignment: .top) {
            if look != .hidden {
                UnevenRoundedRectangle(topLeadingRadius: 0, bottomLeadingRadius: look == .open ? 22 : 14, bottomTrailingRadius: look == .open ? 22 : 14, topTrailingRadius: 0, style: .continuous)
                    .fill(Color.black)
                VStack(spacing: 6) {
                    row
                    if look == .open { details }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .contentShape(Rectangle())
        .onTapGesture { model.open() }
        .animation(.easeInOut(duration: 0.25), value: look)
        .foregroundStyle(.white)
    }

    /// The fox on the left of the notch, the countdown (or today's number) on the right.
    private var row: some View {
        let n = model.notch
        let ear = NotchIsland.ear
        // the fox at the left edge, the number at the right, the notch's width
        // kept clear between them; opened up, they move out to the panel's edges
        // so the details below share their margins
        return HStack(spacing: 0) {
            fox
                .frame(width: ear - 18, height: n.height - 6, alignment: .leading)
            Spacer(minLength: n.width)
            headline
                .font(.pixel(16))
                .monospacedDigit()
                .foregroundStyle(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: ear - 18, alignment: .trailing)
        }
        .padding(.horizontal, IslandView.margin)
        .frame(maxWidth: .infinity)
        .frame(height: n.height + 6)
    }

    /// The pixel fox in her outfit (once the app has drawn it): studying, happy when the time's up or between sessions.
    private var fox: some View {
        let resting = model.done || model.session == nil
        let drawn = resting ? model.happy : model.study
        return (drawn.map { Image(nsImage: $0) } ?? Image(resting ? "FoxHappy" : "FoxStudy"))
            .resizable()
            .interpolation(.none)
            .aspectRatio(contentMode: .fit)
    }

    @ViewBuilder private var headline: some View {
        let now = Date.now
        if let s = model.session {
            if model.done || s.endsAt <= now {
                Text("done!")
            } else {
                Text(timerInterval: now...s.endsAt, countsDown: true, showsHours: false)
            }
        } else if let card = model.card {
            Text(card.stat(now: now).big)
        } else {
            Text("✿")
        }
    }

    /// Under the row, when it's open.
    private var details: some View {
        // centred under the notch, which is the eye's anchor; the fox and the
        // number stay out at the sides
        VStack(alignment: .center, spacing: 10) {
            if let s = model.session {
                Text(s.title).font(.pixel(17)).lineLimit(1)
                if model.done {
                    Text("done! come back for your reward ✿")
                        .font(.system(size: 12, design: .rounded))
                        .opacity(0.85)
                } else {
                    ProgressView(timerInterval: s.startedAt...max(s.startedAt.addingTimeInterval(1), s.endsAt), countsDown: false) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(accent)
                    Text("ends at \(s.endsAt.formatted(date: .omitted, time: .shortened))")
                        .font(.system(size: 11, design: .rounded))
                        .opacity(0.7)
                }
            } else if let card = model.card {
                let stat = card.stat()
                Text("\(stat.big) \(stat.small)").font(.pixel(17)).lineLimit(1)
                Text(card.line())
                    .font(.system(size: 12, design: .rounded))
                    .opacity(0.85)
                    .lineLimit(2)
            } else {
                Text("your fox is in the app, waiting for a session ✿")
                    .font(.system(size: 12, design: .rounded))
                    .opacity(0.85)
            }
            OpenButton(title: model.session == nil ? "open TamaLucy · start a session" : "open TamaLucy", action: model.open)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, IslandView.margin)
        .padding(.top, 2)
        .padding(.bottom, 14)
    }
}

/// The island's one button. A tap gesture rather than a Button: the panel never
/// becomes key, and a Button in a non-key window swallows its click without
/// acting. Brightens under the pointer, with a hand cursor, so it reads as clickable.
private struct OpenButton: View {
    let title: String
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Text(title)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(Color.white.opacity(hovering ? 0.3 : 0.14), in: Capsule())
            .contentShape(Capsule())
            .animation(.easeOut(duration: 0.15), value: hovering)
            .onHover { inside in
                hovering = inside
                if inside { NSCursor.pointingHand.push() } else { NSCursor.pop() }
            }
            .onTapGesture(perform: action)
    }
}
