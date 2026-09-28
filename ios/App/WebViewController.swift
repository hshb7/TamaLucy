import UIKit
import WebKit

/// Hosts the web app and relays its messages to `FocusBridge`.
///
/// JS → native: `webkit.messageHandlers.tamalucy.postMessage({ id, cmd, ...args })`
/// native → JS: `window.__tamalucyNative.reply(id, result)` (see src/native.ts)
final class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    private lazy var bridge = FocusBridge(host: self)

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: AppSchemeHandler.scheme)
        config.userContentController.add(WeakMessageHandler(self), name: "tamalucy")
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()

        webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 1, green: 0.957, blue: 0.91, alpha: 1)
        // the page handles the notch and home indicator itself (env(safe-area-inset-*))
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.navigationDelegate = self
        if #available(iOS 16.4, *) {
            // lets you inspect it from Safari → Develop while testing
            webView.isInspectable = true
        }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: AppSchemeHandler.startURL))
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let id = (body["id"] as? NSNumber)?.intValue,
              let cmd = body["cmd"] as? String else { return }
        Task { @MainActor in
            let result = await bridge.handle(cmd, body)
            reply(id, result)
        }
    }

    private func reply(_ id: Int, _ result: Any) {
        let data = try? JSONSerialization.data(withJSONObject: ["r": result])
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{\"r\":null}"
        webView.evaluateJavaScript("window.__tamalucyNative && window.__tamalucyNative.reply(\(id), (\(json)).r)")
    }

    // Links out of the app (none today, but just in case) open in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.navigationType == .linkActivated, let url = action.request.url, url.scheme == "https" || url.scheme == "http" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
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
