// Her widget's words and pictures. The web app sends them (see src/game/widget.ts
// and src/ui/widgetArt.ts) whenever they change; the app keeps them in the App
// Group so the widget (the iPhone's home screen, the Mac's desktop), the Dynamic
// Island and the Mac's notch island can draw them.
import SwiftUI
#if canImport(UIKit)
import UIKit
typealias PlatformImage = UIImage
#else
import AppKit
typealias PlatformImage = NSImage
#endif

struct FoxCard: Codable {
    struct Exam: Codable {
        var name: String
        /// Local YYYY-MM-DD.
        var date: String
    }

    struct Course: Codable {
        var name: String
        var hours: Int
        var goal: Int
        var color: String
    }

    var fox: String
    var caption: String
    /// today, acorns, streak, exam or class.
    var show: String
    /// The day the numbers are for (local YYYY-MM-DD).
    var day: String
    var todayMinutes: Int
    var acorns: Int
    var streak: Int
    var exam: Exam?
    var course: Course?
    /// Her colours: text, the card behind it, and the highlight.
    var ink: String
    var card: String
    var accent: String
    /// When the app last saw her (ms since 1970).
    var savedAt: Double

    static let placeholder = FoxCard(
        fox: "Mochi", caption: "Mochi is feeling cozy", show: "today", day: "", todayMinutes: 0, acorns: 0, streak: 0,
        exam: nil, course: nil, ink: "#5b3a31", card: "#fffaf3", accent: "#e4819a", savedAt: 0
    )

    /// The big number and the words under it, worked out for `now` (same wording as the app's preview).
    func stat(now: Date = .now) -> (big: String, small: String) {
        let today = FoxCard.dayKey(now)
        switch show {
        case "acorns":
            return ("\(acorns)", "acorns")
        case "streak":
            let alive = day == today || day == FoxCard.dayKey(now.addingTimeInterval(-86_400))
            return ("\(alive ? streak : 0)", "day streak")
        case "exam":
            guard let exam else { return ("—", "no exams coming up") }
            let n = FoxCard.daysUntil(exam.date, from: now)
            if n < 0 { return ("✓", "\(exam.name) is done!") }
            return n == 0 ? ("today", exam.name) : ("\(n)", "day\(n == 1 ? "" : "s") to \(exam.name)")
        case "class":
            guard let course else { return ("—", "add a class on the bookshelf") }
            return ("\(course.hours)/\(course.goal)h", course.name)
        default:
            let m = day == today ? todayMinutes : 0
            return (m >= 60 ? "\(m / 60)h \(m % 60)m" : "\(m)m", "focused today")
        }
    }

    /// Her line, unless she hasn't opened the app in a while.
    func line(now: Date = .now) -> String {
        savedAt > 0 && now.timeIntervalSince1970 - savedAt / 1000 > 36 * 3600 ? "\(fox) misses you ✿ come say hi?" : caption
    }

    static func dayKey(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func daysUntil(_ key: String, from now: Date) -> Int {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let target = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return -1 }
        let start = Calendar.current.startOfDay(for: now)
        return Calendar.current.dateComponents([.day], from: start, to: target).day ?? -1
    }
}

/// The focus session running right now, as the app wrote it down in the App
/// Group for the widgets: the home screen / desktop widget counts it down, and
/// on the iPhone the Screen Time extensions read `endsAt` too (Shared.swift).
struct FocusNow {
    var startedAt: Date
    var endsAt: Date
    /// What she's working on ("Torts outline"), or empty.
    var label: String
    var fox: String

    enum Key {
        /// Seconds since 1970. The same strings as Shared.Key in Shared.swift.
        static let endsAt = "focusEndsAt"
        static let startedAt = "focusStartedAt"
        static let label = "focusLabel"
        static let fox = "foxName"
    }

    var title: String { label.isEmpty ? "studying with \(fox)" : label }

    static func load() -> FocusNow? {
        let d = FoxCardStore.defaults
        let ends = d.double(forKey: Key.endsAt)
        guard ends > 0 else { return nil }
        let started = d.double(forKey: Key.startedAt)
        return FocusNow(
            startedAt: Date(timeIntervalSince1970: started > 0 ? started : ends - 25 * 60),
            endsAt: Date(timeIntervalSince1970: ends),
            label: d.string(forKey: Key.label) ?? "",
            fox: d.string(forKey: Key.fox) ?? "your fox"
        )
    }

    func save() {
        let d = FoxCardStore.defaults
        d.set(endsAt.timeIntervalSince1970, forKey: Key.endsAt)
        d.set(startedAt.timeIntervalSince1970, forKey: Key.startedAt)
        d.set(label, forKey: Key.label)
        d.set(fox, forKey: Key.fox)
    }

    static func clear() {
        let d = FoxCardStore.defaults
        d.removeObject(forKey: Key.endsAt)
        d.removeObject(forKey: Key.startedAt)
        d.removeObject(forKey: Key.label)
    }
}

/// Where the card lives: its words in the App Group's defaults, its pictures in the App Group's folder.
enum FoxCardStore {
    static let appGroup = Bundle.main.object(forInfoDictionaryKey: "TLAppGroup") as? String ?? "group.tamalucy"
    /// small and medium: the whole widget picture. foxStudy and foxHappy: the fox for the Dynamic Island and the notch.
    static let images = ["small", "medium", "foxStudy", "foxHappy"]
    private static let key = "foxCard"

    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }
    private static var folder: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) }

    static func load() -> FoxCard? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(FoxCard.self, from: data)
    }

    /// Save what the web app sent: the card's fields plus its pictures as data: URLs.
    static func save(_ sent: [String: Any]) -> Bool {
        guard let json = try? JSONSerialization.data(withJSONObject: sent),
              let card = try? JSONDecoder().decode(FoxCard.self, from: json),
              let data = try? JSONEncoder().encode(card) else { return false }
        defaults.set(data, forKey: key)
        for name in images {
            guard let url = sent[name] as? String, let comma = url.firstIndex(of: ","),
                  let png = Data(base64Encoded: String(url[url.index(after: comma)...])),
                  let file = folder?.appendingPathComponent("widget-\(name).png") else { continue }
            try? png.write(to: file, options: .atomic)
        }
        return true
    }

    static func image(_ name: String) -> PlatformImage? {
        guard let file = folder?.appendingPathComponent("widget-\(name).png") else { return nil }
        return PlatformImage(contentsOfFile: file.path)
    }
}

extension Image {
    /// The same picture on an iPhone (UIImage) and a Mac (NSImage).
    init(platform image: PlatformImage) {
        #if canImport(UIKit)
        self.init(uiImage: image)
        #else
        self.init(nsImage: image)
        #endif
    }
}

extension Color {
    /// "#rrggbb" from the web app.
    init(hex: String) {
        let (r, g, b) = Color.rgb(hex)
        self.init(red: r, green: g, blue: b)
    }

    /// How light a "#rrggbb" colour looks (0 black ... 1 white).
    static func luminance(hex: String) -> Double {
        let (r, g, b) = rgb(hex)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private static func rgb(_ hex: String) -> (Double, Double, Double) {
        let n = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0
        return (Double((n >> 16) & 255) / 255, Double((n >> 8) & 255) / 255, Double(n & 255) / 255)
    }
}

extension Font {
    /// The app's pixel font (bundled with the widgets and the Mac app).
    static func pixel(_ size: CGFloat) -> Font {
        .custom("PixelifySans-SemiBold", size: size)
    }
}
