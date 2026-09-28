// The fox in the Dynamic Island (and on the lock screen) while she focuses.
import ActivityKit
import SwiftUI
import WidgetKit

@main
struct TamaLucyWidgets: WidgetBundle {
    var body: some Widget {
        FocusLiveActivity()
    }
}

private let cream = Color(red: 1, green: 0.957, blue: 0.91)
private let cocoa = Color(red: 0.29, green: 0.165, blue: 0.133)
private let pink = Color(red: 0.96, green: 0.6, blue: 0.65)

struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(cream)
                .activitySystemActionForegroundColor(cocoa)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Fox(done: context.state.done)
                        .frame(width: 52, height: 34)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Countdown(state: context.state)
                        .font(.title2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(pink)
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
                        Progress(context: context).padding(.horizontal, 8)
                    }
                }
            } compactLeading: {
                Fox(done: context.state.done).frame(width: 30, height: 20)
            } compactTrailing: {
                Countdown(state: context.state)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(pink)
                    .frame(maxWidth: 42)
            } minimal: {
                Fox(done: context.state.done).frame(width: 22, height: 16)
            }
            .keylineTint(pink)
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<FocusAttributes>

    var body: some View {
        HStack(spacing: 14) {
            Fox(done: context.state.done).frame(width: 64, height: 40)
            VStack(alignment: .leading, spacing: 6) {
                Text(title(context))
                    .font(.headline)
                    .foregroundStyle(cocoa)
                    .lineLimit(1)
                if context.state.done {
                    Text("done! come back for your reward ✿")
                        .font(.subheadline)
                        .foregroundStyle(cocoa.opacity(0.7))
                } else {
                    Progress(context: context)
                }
            }
            Spacer(minLength: 8)
            Countdown(state: context.state)
                .font(.title.monospacedDigit().weight(.bold))
                .foregroundStyle(cocoa)
        }
        .padding(16)
        .fontDesign(.rounded)
    }
}

/// The pixel fox, kept sharp at any size.
private struct Fox: View {
    let done: Bool

    var body: some View {
        Image(done ? "FoxHappy" : "FoxStudy")
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

    var body: some View {
        ProgressView(timerInterval: context.attributes.startedAt...max(context.attributes.startedAt, context.state.endsAt), countsDown: false) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .tint(pink)
    }
}

private func title(_ context: ActivityViewContext<FocusAttributes>) -> String {
    context.attributes.label.isEmpty ? "studying with \(context.attributes.foxName)" : context.attributes.label
}
