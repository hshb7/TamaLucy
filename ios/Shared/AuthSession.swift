import AuthenticationServices
import Foundation

/// "Sign in with …" for the apps: the provider's page opens in the system's
/// sign-in sheet (Safari's cookies, so she's often already signed in there),
/// and the callback (tamalucy://app/?code=…) comes back to the web app as the
/// answer to `auth.open`. Google refuses to sign in inside an app's web view;
/// this sheet is the way it allows.
@MainActor
enum AuthSession {
    private static var current: ASWebAuthenticationSession?

    static func handle(_ cmd: String, _ body: [String: Any]) async -> Any? {
        guard cmd == "auth.open" else { return nil }
        guard let text = body["url"] as? String, let url = URL(string: text) else { return "" }
        return await withCheckedContinuation { (cont: CheckedContinuation<String, Never>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "tamalucy") { callback, _ in
                cont.resume(returning: callback?.absoluteString ?? "")
                Task { @MainActor in current = nil }
            }
            session.presentationContextProvider = Presenter.shared
            session.prefersEphemeralWebBrowserSession = false
            current = session
            if !session.start() { cont.resume(returning: "") }
        }
    }
}

private final class Presenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = Presenter()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if os(iOS)
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap { $0.windows }.first { $0.isKeyWindow } ?? scenes.first?.windows.first ?? ASPresentationAnchor()
        #else
        return NSApplication.shared.keyWindow ?? NSApplication.shared.windows.first ?? ASPresentationAnchor()
        #endif
    }
}
