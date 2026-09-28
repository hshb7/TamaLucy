// TamaLucy for iPhone: the same app as the website (bundled from ../dist),
// in a full-screen web view, plus the native bits a website can't do:
// the Dynamic Island, blocking distracting apps, and the Taptic Engine.
import SwiftUI

@main
struct TamaLucyApp: App {
    var body: some Scene {
        WindowGroup {
            WebView()
                .ignoresSafeArea()
                .background(Color(red: 1, green: 0.957, blue: 0.91))
        }
    }
}

struct WebView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController { WebViewController() }
    func updateUIViewController(_ controller: WebViewController, context: Context) {}
}
