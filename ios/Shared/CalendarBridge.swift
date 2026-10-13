import EventKit
import Foundation

/// Her calendar (EventKit), for the iPhone and the Mac: exams and deadlines
/// come in, finished sessions go out. See src/calendar.ts.
@MainActor
enum CalendarBridge {
    private static let store = EKEventStore()

    /// Handles the calendar.* commands; nil for anything else.
    static func handle(_ cmd: String, _ body: [String: Any]) async -> Any? {
        switch cmd {
        case "calendar.list": return await list()
        case "calendar.events": return await events(body)
        case "calendar.add": return await add(body)
        default: return nil
        }
    }

    private static func authorized() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17, macOS 14, *) { return status == .fullAccess }
        return status == .authorized
    }

    /// Asks once; after that the system remembers her answer.
    private static func authorize() async -> Bool {
        if authorized() { return true }
        do {
            if #available(iOS 17, macOS 14, *) { return try await store.requestFullAccessToEvents() }
            return try await store.requestAccess(to: .event)
        } catch {
            return false
        }
    }

    private static func list() async -> [String: Any] {
        guard await authorize() else { return ["available": true, "authorized": false, "calendars": []] }
        let calendars = store.calendars(for: .event).sorted { $0.title < $1.title }.map { c -> [String: Any] in
            ["id": c.calendarIdentifier, "title": c.title, "color": hex(c.cgColor), "writable": c.allowsContentModifications]
        }
        return ["available": true, "authorized": true, "calendars": calendars]
    }

    private static func events(_ body: [String: Any]) async -> [[String: Any]] {
        guard await authorize(),
              let ids = body["calendars"] as? [String],
              let from = (body["from"] as? NSNumber)?.doubleValue,
              let to = (body["to"] as? NSNumber)?.doubleValue else { return [] }
        let calendars = store.calendars(for: .event).filter { ids.contains($0.calendarIdentifier) }
        guard !calendars.isEmpty else { return [] }
        let predicate = store.predicateForEvents(
            withStart: Date(timeIntervalSince1970: from / 1000),
            end: Date(timeIntervalSince1970: to / 1000),
            calendars: calendars
        )
        return store.events(matching: predicate).prefix(500).map { e -> [String: Any] in
            [
                "id": e.calendarItemIdentifier,
                "title": e.title ?? "",
                "start": e.startDate.timeIntervalSince1970 * 1000,
                "end": e.endDate.timeIntervalSince1970 * 1000,
                "allDay": e.isAllDay,
                "recurring": e.hasRecurrenceRules,
                "calendar": e.calendar.calendarIdentifier,
            ]
        }
    }

    /// A finished session, onto the calendar she chose (or the default one).
    private static func add(_ body: [String: Any]) async -> Bool {
        guard await authorize(),
              let title = body["title"] as? String,
              let start = (body["start"] as? NSNumber)?.doubleValue,
              let end = (body["end"] as? NSNumber)?.doubleValue else { return false }
        let id = body["calendar"] as? String ?? ""
        guard let calendar = (id.isEmpty ? nil : store.calendar(withIdentifier: id)) ?? store.defaultCalendarForNewEvents else { return false }
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = Date(timeIntervalSince1970: start / 1000)
        event.endDate = Date(timeIntervalSince1970: max(end, start + 60_000) / 1000)
        event.notes = body["notes"] as? String
        event.calendar = calendar
        do {
            try store.save(event, span: .thisEvent)
            return true
        } catch {
            return false
        }
    }

    private static func hex(_ color: CGColor?) -> String {
        guard let c = color?.components, c.count >= 3 else { return "" }
        return String(format: "#%02x%02x%02x", Int(c[0] * 255), Int(c[1] * 255), Int(c[2] * 255))
    }
}
