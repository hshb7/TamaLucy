import UniformTypeIdentifiers
import WebKit

/// Serves the web app bundled inside the app (the `dist` folder) at
/// tamalucy://app/… — a real origin, so modules, fonts and localStorage work
/// like on a website, and it all works offline.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "tamalucy"
    static let startURL = URL(string: "\(scheme)://app/index.html")!

    private let root: URL = {
        guard let url = Bundle.main.url(forResource: "dist", withExtension: nil) else {
            fatalError("The web app isn't in the bundle. Run `npm run build` in the repo, then build again.")
        }
        return url.standardizedFileURL
    }()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        // only ever serve files from inside dist/
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish()
            return
        }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let headers = ["Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
