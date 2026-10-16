// Her fox on the home screen (iPhone) or the desktop (Mac): the picture the app
// drew (her wallpaper or colour, the fox in its outfit and pose) with today's
// focus, a class, her next exam... on top, in her colours. Laid out like the
// preview in the app (WidgetStudio.tsx). While a focus session runs it counts
// the session down instead, and says "done!" for a while after.
import SwiftUI
import WidgetKit

struct FoxEntry: TimelineEntry {
    let date: Date
    let card: FoxCard
    let small: PlatformImage?
    let medium: PlatformImage?
    /// A session is on (or just ended): shown instead of the card.
    let focus: FocusNow?
    let done: Bool
}

struct FoxProvider: TimelineProvider {
    func placeholder(in context: Context) -> FoxEntry {
        FoxEntry(date: .now, card: .placeholder, small: nil, medium: nil, focus: nil, done: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (FoxEntry) -> Void) {
        completion(entry(at: .now))
    }

    /// The app reloads the widget whenever something changes. On its own it turns
    /// over when a session ends (the countdown counts by itself) and half an hour
    /// after that, at midnight (today's focus, days until an exam) and, a day and
    /// a half after she was last in, to say the fox misses her.
    func getTimeline(in context: Context, completion: @escaping (Timeline<FoxEntry>) -> Void) {
        let now = Date.now
        var dates = [now]
        if let focus = FocusNow.load() {
            if focus.endsAt > now { dates.append(focus.endsAt) }
            dates.append(focus.endsAt.addingTimeInterval(FoxProvider.lingers))
        }
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            dates.append(midnight.addingTimeInterval(5))
        }
        if let saved = FoxCardStore.load()?.savedAt, saved > 0 {
            dates.append(Date(timeIntervalSince1970: saved / 1000 + 36 * 3600 + 60))
        }
        let entries = dates.filter { $0 >= now }.sorted().map { entry(at: $0) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    /// How long "done!" stays after the timer ran out, if the app hasn't ended the session.
    static let lingers: TimeInterval = 30 * 60

    private func entry(at date: Date) -> FoxEntry {
        let focus = FocusNow.load().flatMap { $0.endsAt.addingTimeInterval(FoxProvider.lingers) > date ? $0 : nil }
        return FoxEntry(
            date: date,
            card: FoxCardStore.load() ?? .placeholder,
            small: FoxCardStore.image("small"),
            medium: FoxCardStore.image("medium"),
            focus: focus,
            done: focus.map { $0.endsAt <= date } ?? false
        )
    }
}

struct FoxWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FoxWidget", provider: FoxProvider()) { entry in
            FoxWidgetView(entry: entry)
        }
        .configurationDisplayName("TamaLucy")
        .description("your fox, in your style. style it in the app: settings → your widget.")
        .supportedFamilies([.systemSmall, .systemMedium])
        // the picture goes right to the edges
        .contentMarginsDisabled()
    }
}

struct FoxWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FoxEntry

    private var card: FoxCard { entry.card }
    private var ink: Color { Color(hex: card.ink) }

    var body: some View {
        Group {
            if let focus = entry.focus {
                FocusWidgetView(focus: focus, done: entry.done, card: card, small: family == .systemSmall)
            } else {
                GeometryReader { geo in
                    let pad = geo.size.width * (family == .systemSmall ? 0.06 : 0.03)
                    if family == .systemSmall {
                        words(compact: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(hex: card.card).opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .padding(pad)
                    } else {
                        words(compact: false)
                            .frame(width: geo.size.width * 0.54, alignment: .topLeading)
                            .frame(maxHeight: .infinity, alignment: .topLeading)
                            .background(Color(hex: card.card).opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .padding(pad + 2)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
            }
        }
        .foregroundStyle(ink)
        .containerBackground(for: .widget) { background }
    }

    private func words(compact: Bool) -> some View {
        let stat = card.stat(now: entry.date)
        return VStack(alignment: .leading, spacing: compact ? 0 : 2) {
            if !compact {
                Text(card.fox).font(.pixel(15))
            }
            Text(stat.big)
                .font(.pixel(22))
                .foregroundStyle(Color(hex: card.accent))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(stat.small)
                .font(.system(size: 12, design: .rounded))
                .lineLimit(1)
            if !compact {
                Spacer(minLength: 2)
                Text(card.line(now: entry.date))
                    .font(.system(size: 11, design: .rounded))
                    .opacity(0.8)
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, compact ? 10 : 12)
        .padding(.vertical, compact ? 6 : 8)
    }

    /// Her card's colour while a session runs; otherwise the app's picture, kept pixel-sharp (a plain fox until the app has sent one).
    @ViewBuilder private var background: some View {
        if entry.focus != nil {
            Color(hex: card.card)
        } else if let image = family == .systemSmall ? entry.small : entry.medium {
            Image(platform: image)
                .resizable()
                .interpolation(.none)
                .scaledToFill()
        } else {
            ZStack(alignment: family == .systemSmall ? .bottom : .bottomLeading) {
                Color(hex: card.card)
                Image("FoxHappy")
                    .resizable()
                    .interpolation(.none)
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 70)
                    .padding(10)
            }
        }
    }
}

/// The session, while it runs: the fox studying, what she's working on, the time left (counting by itself).
private struct FocusWidgetView: View {
    let focus: FocusNow
    let done: Bool
    let card: FoxCard
    let small: Bool

    private var accent: Color { Color(hex: card.accent) }

    /// The fox in her outfit, once the app has drawn it: studying, then happy when time's up.
    private var fox: Image {
        if let drawn = FoxCardStore.image(done ? "foxHappy" : "foxStudy") { return Image(platform: drawn) }
        return Image(done ? "FoxHappy" : "FoxStudy")
    }

    var body: some View {
        if small {
            VStack(spacing: 2) {
                fox.resizable().interpolation(.none).aspectRatio(contentMode: .fit).frame(height: 46)
                countdown
                    .font(.pixel(22))
                    .foregroundStyle(accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(done ? "come back for your reward ✿" : focus.title)
                    .font(.system(size: 11, design: .rounded))
                    .lineLimit(1)
            }
            .padding(10)
        } else {
            HStack(spacing: 14) {
                fox.resizable().interpolation(.none).aspectRatio(contentMode: .fit).frame(width: 76, height: 50)
                VStack(alignment: .leading, spacing: 4) {
                    Text(focus.title).font(.pixel(15)).lineLimit(1)
                    countdown
                        .font(.pixel(26))
                        .foregroundStyle(accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    if done {
                        Text("done! come back for your reward ✿")
                            .font(.system(size: 11, design: .rounded))
                            .opacity(0.8)
                    } else {
                        ProgressView(timerInterval: focus.startedAt...max(focus.startedAt.addingTimeInterval(1), focus.endsAt), countsDown: false) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .tint(accent)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(14)
        }
    }

    @ViewBuilder private var countdown: some View {
        let now = Date.now
        if done || focus.endsAt <= now {
            Text("done!")
        } else {
            Text(timerInterval: now...focus.endsAt, countsDown: true, showsHours: false)
                .monospacedDigit()
        }
    }
}
