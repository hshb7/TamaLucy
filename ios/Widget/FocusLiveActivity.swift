// The fox in the Dynamic Island (and on the lock screen) while she focuses,
// in the colours and outfit from her widget style (see FoxWidget.swift).
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct TamaLucyWidgets: WidgetBundle {
    var body: some Widget {
        FoxWidget()
        FocusLiveActivity()
    }
}

/// Her widget style, or the app's own colours until she has one.
private struct Style {
    var background = Color(red: 1, green: 0.957, blue: 0.91)
    var ink = Color(red: 0.29, green: 0.165, blue: 0.133)
    var accent = Color(red: 0.96, green: 0.6, blue: 0.65)
    var accentOnBlack = Color(red: 0.96, green: 0.6, blue: 0.65)
    /// The fox in her outfit, studying and then happy.
    var study: UIImage?
    var happy: UIImage?

    static func load() -> Style {
        var style = Style(study: FoxCardStore.image("foxStudy"), happy: FoxCardStore.image("foxHappy"))
        if let card = FoxCardStore.load() {
            style.background = Color(hex: card.card)
            style.ink = Color(hex: card.ink)
            style.accent = Color(hex: card.accent)
            if Color.luminance(hex: card.accent) > 0.2 { style.accentOnBlack = style.accent }
        }
        return style
    }
}

struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusAttributes.self) { context in
            let style = Style.load()
            return LockScreenView(context: context, style: style)
                .activityBackgroundTint(style.background)
                .activitySystemActionForegroundColor(style.ink)
        } dynamicIsland: { context in
            let style = Style.load()
            // the Dynamic Island is black, so a dark highlight gives way to pink
            let accent = style.accentOnBlack
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Fox(done: context.state.done, style: style)
                        .frame(width: 52, height: 34)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(state: context.state)
                        .font(.title2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(accent)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(title(context))
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.done {
                        Text("done! come back for your reward ✿")
                            .font(.subheadline)
                    } else {
                        Progress(context: context, tint: accent).padding(.horizontal, 8)
                    }
                }
            } compactLeading: {
                Fox(done: context.state.done, style: style).frame(width: 30, height: 20)
            } compactTrailing: {
                Countdown(state: context.state)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(accent)
                    .frame(maxWidth: 42)
            } minimal: {
                Fox(done: context.state.done, style: style).frame(width: 22, height: 16)
            }
            .keylineTint(accent)
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<FocusAttributes>
    let style: Style

    var body: some View {
        HStack(spacing: 14) {
            Fox(done: context.state.done, style: style).frame(width: 64, height: 40)
            VStack(alignment: .leading, spacing: 6) {
                Text(title(context))
                    .font(.pixel(17))
                    .foregroundStyle(style.ink)
                    .lineLimit(1)
                if context.state.done {
                    Text("done! come back for your reward ✿")
                        .font(.subheadline)
                        .foregroundStyle(style.ink.opacity(0.7))
                } else {
                    Progress(context: context, tint: style.accent)
                }
            }
            Spacer(minLength: 8)
            Countdown(state: context.state)
                .font(.title.monospacedDigit().weight(.bold))
                .foregroundStyle(style.ink)
        }
        .padding(16)
        .fontDesign(.rounded)
    }
}

/// The pixel fox (in her outfit, once the app has drawn it), kept sharp at any size.
private struct Fox: View {
    let done: Bool
    let style: Style

    var body: some View {
        let dressed = done ? style.happy : style.study
        (dressed.map { Image(uiImage: $0) } ?? Image(done ? "FoxHappy" : "FoxStudy"))
            .resizable()
            .interpolation(.none)
            .aspectRatio(contentMode: .fit)
    }
}

/// Counts down by itself; the app doesn't need to update it every second.
private struct Countdown: View {
    let state: FocusAttributes.ContentState

    var body: some View {
        let now = Date.now
        if state.done || state.endsAt <= now {
            Text("done!")
        } else {
            Text(timerInterval: now...state.endsAt, countsDown: true)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct Progress: View {
    let context: ActivityViewContext<FocusAttributes>
    let tint: Color

    var body: some View {
        ProgressView(timerInterval: context.attributes.startedAt...max(context.attributes.startedAt, context.state.endsAt), countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .tint(tint)
    }
}

private func title(_ context: ActivityViewContext<FocusAttributes>) -> String {
    context.attributes.label.isEmpty ? "studying with \(context.attributes.foxName)" : context.attributes.label
}
