// Her fox on the home screen: the picture the app drew (her wallpaper or colour,
// the fox in its outfit and pose) with today's focus, a class, her next exam...
// on top, in her colours. Laid out like the preview in the app (WidgetStudio.tsx).
import SwiftUI
import WidgetKit

struct FoxEntry: TimelineEntry {
    let date: Date
    let card: FoxCard
    let small: UIImage?
    let medium: UIImage?
}

struct FoxProvider: TimelineProvider {
    func placeholder(in context: Context) -> FoxEntry {
        FoxEntry(date: .now, card: .placeholder, small: nil, medium: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (FoxEntry) -> Void) {
        completion(entry(at: .now))
    }

    /// The app reloads the widget whenever something changes; on its own it only
    /// needs to turn over at midnight (today's focus, days until an exam) and,
    /// a day and a half after she was last in, to say the fox misses her.
    func getTimeline(in context: Context, completion: @escaping (Timeline<FoxEntry>) -> Void) {
        let now = Date.now
        var dates = [now]
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            dates.append(midnight.addingTimeInterval(5))
        }
        if let saved = FoxCardStore.load()?.savedAt, saved > 0 {
            let missing = Date(timeIntervalSince1970: saved / 1000 + 36 * 3600 + 60)
            if missing > now { dates.append(missing) }
        }
        let entries = dates.sorted().map { entry(at: $0) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(at date: Date) -> FoxEntry {
        FoxEntry(date: date, card: FoxCardStore.load() ?? .placeholder, small: FoxCardStore.image("small"), medium: FoxCardStore.image("medium"))
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
        .foregroundStyle(ink)
        .containerBackground(for: .widget) { picture }
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

    /// The app's picture, kept pixel-sharp; a plain fox until the app has sent one.
    @ViewBuilder private var picture: some View {
        if let image = family == .systemSmall ? entry.small : entry.medium {
            Image(uiImage: image)
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
