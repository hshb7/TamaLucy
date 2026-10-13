import Foundation
import MediaPlayer

/// Apple Music on the iPhone (see src/music.ts): one of her own playlists
/// starts with the timer and pauses when time's up. Uses the system player,
/// so the music carries on when the phone locks mid-session.
@MainActor
enum MusicBridge {
    /// Handles the music.* commands; nil for anything else.
    static func handle(_ cmd: String, _ body: [String: Any]) async -> Any? {
        switch cmd {
        case "music.status":
            return ["available": true, "players": ["apple"], "authorized": MPMediaLibrary.authorizationStatus() == .authorized]
        case "music.playlists": return await playlists()
        case "music.play": return play(body["playlist"] as? String ?? "")
        case "music.pause":
            MPMusicPlayerController.systemMusicPlayer.pause()
            return true
        default: return nil
        }
    }

    private static func authorize() async -> Bool {
        if MPMediaLibrary.authorizationStatus() == .authorized { return true }
        let status = await withCheckedContinuation { done in
            MPMediaLibrary.requestAuthorization { done.resume(returning: $0) }
        }
        return status == .authorized
    }

    private static func playlists() async -> [[String: Any]] {
        guard await authorize() else { return [] }
        return (MPMediaQuery.playlists().collections ?? []).compactMap { c -> [String: Any]? in
            guard let p = c as? MPMediaPlaylist,
                  let name = p.value(forProperty: MPMediaPlaylistPropertyName) as? String, !name.isEmpty else { return nil }
            return ["id": String(p.persistentID), "name": name, "count": p.count]
        }
    }

    private static func play(_ id: String) -> Bool {
        guard let pid = UInt64(id) else { return false }
        let query = MPMediaQuery.playlists()
        query.addFilterPredicate(MPMediaPropertyPredicate(value: NSNumber(value: pid), forProperty: MPMediaPlaylistPropertyPersistentID))
        guard let list = query.collections?.first else { return false }
        let player = MPMusicPlayerController.systemMusicPlayer
        player.setQueue(with: list)
        player.play()
        return true
    }
}
