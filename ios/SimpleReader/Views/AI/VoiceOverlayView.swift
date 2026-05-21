import SwiftUI

struct VoiceOverlayView: View {
    @Bindable var session: VoiceSessionManager
    var onTranscript: () -> Void

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            VoiceWaveformView(phase: session.phase)
                .frame(width: 42, height: 24)

            Button(action: onTranscript) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(session.phase.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(DesignSystem.Colors.foreground)

                    Text(subtitle)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                        .lineLimit(1)
                }
                .frame(maxWidth: 168, alignment: .leading)
            }
            .buttonStyle(.plain)

            Button(action: session.stop) {
                Image(systemName: "stop.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .frame(width: 30, height: 30)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Stop voice")
        }
        .padding(.leading, DesignSystem.Spacing.md)
        .padding(.trailing, DesignSystem.Spacing.sm)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(.white.opacity(0.38), lineWidth: 0.6)
        }
        .shadow(color: .black.opacity(0.10), radius: 18, x: 0, y: 10)
        .onTapGesture(perform: onTranscript)
    }

    private var subtitle: String {
        if case .error(let message) = session.phase {
            return message
        }

        if !session.latestAssistantText.isEmpty {
            return session.latestAssistantText
        }

        if !session.latestUserText.isEmpty {
            return session.latestUserText
        }

        return "Speak anytime"
    }
}

struct VoiceTranscriptSheetView: View {
    @Bindable var session: VoiceSessionManager
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.lg) {
                        if session.transcript.isEmpty {
                            emptyState
                        } else {
                            ForEach(session.transcript) { entry in
                                VoiceTranscriptRow(entry: entry)
                                    .id(entry.id)
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.xl)
                    .padding(.vertical, DesignSystem.Spacing.lg)
                }
                .onChange(of: session.transcript.count) { _, _ in
                    if let lastID = session.transcript.last?.id {
                        withAnimation(.easeOut(duration: 0.18)) {
                            proxy.scrollTo(lastID, anchor: .bottom)
                        }
                    }
                }
            }

            footer
        }
        .background {
            DesignSystem.Colors.background.opacity(0.84)
                .ignoresSafeArea()
        }
    }

    private var header: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            VoiceWaveformView(phase: session.phase)
                .frame(width: 54, height: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(session.phase.label)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)

                Text("Speak anytime")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.foregroundMuted)
            }

            Spacer()

            Button(action: session.stop) {
                Image(systemName: "stop.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .frame(width: 34, height: 34)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Stop voice")

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .frame(width: 34, height: 34)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close transcript")
        }
        .padding(.horizontal, DesignSystem.Spacing.xl)
        .padding(.top, DesignSystem.Spacing.md)
        .padding(.bottom, DesignSystem.Spacing.sm)
    }

    private var emptyState: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "waveform")
                .font(.title3.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

            Text("Listening")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 140)
    }

    private var footer: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "mic.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)

            Text(footerText)
                .font(.caption.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                .lineLimit(1)

            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(.horizontal, DesignSystem.Spacing.xl)
        .padding(.bottom, DesignSystem.Spacing.sm)
    }

    private var footerText: String {
        switch session.phase {
        case .speaking:
            return "Speak over the answer to interrupt"
        case .listening:
            return "Mic is open"
        case .connecting, .preparing:
            return "Starting voice"
        case .error(let message):
            return message
        case .idle:
            return "Voice stopped"
        }
    }
}

private struct VoiceTranscriptRow: View {
    let entry: VoiceTranscriptEntry

    var body: some View {
        HStack(alignment: .top) {
            if entry.role == .user {
                Spacer(minLength: 36)
                Text(entry.text)
                    .font(.body)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .padding(.horizontal, DesignSystem.Spacing.md)
                    .padding(.vertical, DesignSystem.Spacing.sm)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            } else {
                Text(entry.text)
                    .font(.body)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Spacer(minLength: 36)
            }
        }
    }
}

private struct VoiceWaveformView: View {
    let phase: VoiceSessionPhase

    private var isAnimated: Bool {
        switch phase {
        case .listening, .speaking, .connecting:
            return true
        default:
            return false
        }
    }

    var body: some View {
        TimelineView(.animation) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<5, id: \.self) { index in
                    Capsule()
                        .fill(barColor)
                        .frame(width: 4, height: barHeight(index: index, time: time))
                        .animation(.easeInOut(duration: 0.16), value: phase.label)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var barColor: Color {
        switch phase {
        case .speaking:
            return DesignSystem.Colors.accent
        case .error:
            return DesignSystem.Colors.foregroundSubtle
        default:
            return DesignSystem.Colors.foreground
        }
    }

    private func barHeight(index: Int, time: TimeInterval) -> CGFloat {
        guard isAnimated else { return 8 }

        let base: CGFloat = phase == .speaking ? 14 : 10
        let amplitude: CGFloat = phase == .speaking ? 12 : 8
        let offset = Double(index) * 0.72
        let value = (sin((time * 4.6) + offset) + 1) / 2
        return base + (CGFloat(value) * amplitude)
    }
}
