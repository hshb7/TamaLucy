import SwiftUI
import WebKit

/// The web app in the window, talking to `FocusCenter` through the same
/// bridge as the iPhone app (see src/native.ts).
struct MacWebView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: AppSchemeHandler.scheme)
        config.userContentController.add(WeakMessageHandler(context.coordinator), name: "tamalucy")
        // lets the web app word things for a Mac ("on this Mac", menu bar…)
        config.userContentController.addUserScript(
            WKUserScript(source: "window.__tamalucyPlatform = 'mac'", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()

        let web = FoxWebView(frame: .zero, configuration: config)
        web.underPageBackgroundColor = NSColor(red: 1, green: 0.957, blue: 0.91, alpha: 1)
        if #available(macOS 13.3, *) {
            // Safari → Develop → this Mac → TamaLucy, handy while testing
            web.isInspectable = true
        }
        context.coordinator.web = web
        FocusCenter.shared.emit = { [weak web] name in
            web?.evaluateJavaScript("window.__tamalucyNative && window.__tamalucyNative.emit('\(name)')", completionHandler: nil)
        }
        web.load(URLRequest(url: AppSchemeHandler.startURL))
        return web
    }

    func updateNSView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        weak var web: WKWebView?

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let id = (body["id"] as? NSNumber)?.intValue,
                  let cmd = body["cmd"] as? String else { return }
            Task { @MainActor in
                let result = await FocusCenter.shared.handle(cmd, body)
                let data = try? JSONSerialization.data(withJSONObject: ["r": result])
                let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{\"r\":null}"
                self.web?.evaluateJavaScript("window.__tamalucyNative && window.__tamalucyNative.reply(\(id), (\(json)).r)", completionHandler: nil)
            }
        }
    }
}

/// Hands its window to FocusCenter (for "keep on top" and reopening).
final class FoxWebView: WKWebView {
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let window { FocusCenter.shared.attach(window) }
    }
}

/// WKUserContentController keeps its handlers alive; this avoids a retain cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
