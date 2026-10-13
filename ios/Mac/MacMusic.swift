import AppKit
import Foundation

/// Music or Spotify on the Mac, asked nicely through AppleScript (see
/// src/music.ts). The first time, macOS asks her whether TamaLucy may control
/// the app; after that it just plays.
@MainActor
enum MacMusic {
    private static let apps: [String: (name: String, bundle: String)] = [
        "apple": ("Music", "com.apple.Music"),
        "spotify": ("Spotify", "com.spotify.client"),
    ]

    /// Handles the music.* commands; nil for anything else.
    static func handle(_ cmd: String, _ body: [String: Any]) -> Any? {
        let player = body["player"] as? String ?? "apple"
        let app = apps[player]?.name ?? "Music"
        switch cmd {
        case "music.status":
            let installed = ["apple", "spotify"].filter { NSWorkspace.shared.urlForApplication(withBundleIdentifier: apps[$0]!.bundle) != nil }
            return ["available": true, "players": installed, "authorized": true]
        case "music.playlists": return player == "apple" ? playlists() : []
        case "music.play": return play(player, body["playlist"] as? String ?? "")
        case "music.pause": return run("tell application \"\(app)\" to pause") != nil
        default: return nil
        }
    }

    /// The Music app's playlists by name (Spotify can't list them, so she pastes a link instead).
    private static func playlists() -> [[String: Any]] {
        guard let result = run("tell application \"Music\" to get name of every user playlist") else { return [] }
        var out: [[String: Any]] = []
        if result.numberOfItems > 0 {
            for i in 1...result.numberOfItems {
                if let name = result.atIndex(i)?.stringValue, !name.isEmpty { out.append(["id": name, "name": name]) }
            }
        } else if let name = result.stringValue, !name.isEmpty {
            out.append(["id": name, "name": name])
        }
        return out
    }

    private static func play(_ player: String, _ what: String) -> Bool {
        guard !what.isEmpty else { return false }
        let script = player == "spotify"
            ? "tell application \"Spotify\"\nplay track \"\(escape(what))\"\nend tell"
            : "tell application \"Music\"\nplay playlist \"\(escape(what))\"\nend tell"
        return run(script) != nil
    }

    private static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    }

    private static func run(_ source: String) -> NSAppleEventDescriptor? {
        var error: NSDictionary?
        let result = NSAppleScript(source: source)?.executeAndReturnError(&error)
        if let error {
            NSLog("TamaLucy AppleScript: %@", error)
            return nil
        }
        return result
    }
}
