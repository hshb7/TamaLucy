// The Mac's widgets: her fox on the desktop and in Notification Center (the
// same widget as the iPhone's, FoxWidget.swift). The Dynamic Island's part is
// played by the notch island in the app itself (Mac/NotchIsland.swift).
import SwiftUI
import WidgetKit

@main
struct TamaLucyMacWidgets: WidgetBundle {
    var body: some Widget {
        FoxWidget()
    }
}
