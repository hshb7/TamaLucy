// Her home screen widget's words and pictures. The web app sends them (see
// src/game/widget.ts and src/ui/widgetArt.ts) whenever they change; the app keeps
// them in the App Group so the widget, and the Dynamic Island, can draw them.
import SwiftUI
import UIKit

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

/// Where the card lives: its words in the App Group's defaults, its pictures in the App Group's folder.
enum FoxCardStore {
    static let appGroup = Bundle.main.object(forInfoDictionaryKey: "TLAppGroup") as? String ?? "group.tamalucy"
    /// small and medium: the whole widget picture. foxStudy and foxHappy: the fox for the Dynamic Island.
    static let images = ["small", "medium", "foxStudy", "foxHappy"]
    private static let key = "foxCard"

    private static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }
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

    static func image(_ name: String) -> UIImage? {
        guard let file = folder?.appendingPathComponent("widget-\(name).png") else { return nil }
        return UIImage(contentsOfFile: file.path)
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
    /// The app's pixel font (bundled with the widget).
    static func pixel(_ size: CGFloat) -> Font {
        .custom("PixelifySans-SemiBold", size: size)
    }
}
