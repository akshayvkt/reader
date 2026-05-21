import SwiftUI

/// Top toolbar for the reader.
struct ReaderToolbar: View {
    let chapterTitle: String
    var onBack: () -> Void
    var onTOC: () -> Void
    var onSearch: () -> Void
    var onSettings: () -> Void
    var onVoice: () -> Void
    var onChat: () -> Void
    var isVoiceActive: Bool = false

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            LiquidGlassIconButton(
                systemName: "chevron.left",
                accessibilityLabel: "Back",
                size: ReaderChromeLayout.toolbarButtonSize,
                action: onBack
            )

            Text(chapterTitle)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            HStack(spacing: DesignSystem.Spacing.xs) {
                ReaderToolbarMenuButton(
                    onTOC: onTOC,
                    onSearch: onSearch,
                    onSettings: onSettings
                )
                LiquidGlassIconButton(
                    systemName: isVoiceActive ? "waveform.circle.fill" : "mic.fill",
                    accessibilityLabel: isVoiceActive ? "Open voice transcript" : "Start voice",
                    size: ReaderChromeLayout.toolbarButtonSize,
                    font: .body.weight(.semibold),
                    foreground: isVoiceActive ? DesignSystem.Colors.accent : DesignSystem.Colors.foreground,
                    action: onVoice
                )
                LiquidGlassIconButton(
                    systemName: "message.fill",
                    accessibilityLabel: "Open chat",
                    size: ReaderChromeLayout.toolbarButtonSize,
                    font: .body.weight(.semibold),
                    foreground: DesignSystem.Colors.accent,
                    action: onChat
                )
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.xl)
        .padding(.vertical, ReaderChromeLayout.toolbarVerticalPadding)
    }
}

struct ReaderChromeInsets: Equatable {
    /// Extra reader inset beyond the device safe area.
    let top: CGFloat
    let bottom: CGFloat
}

enum ReaderChromeLayout {
    static let toolbarButtonSize: CGFloat = 36
    static let toolbarVerticalPadding = DesignSystem.Spacing.xs
    static let toolbarTextGap: CGFloat = 14
    static let toolbarYOffset: CGFloat = -6

    static let bottomControlGap: CGFloat = 2
    static let progressHeight: CGFloat = 18

    static var toolbarHeight: CGFloat {
        toolbarButtonSize + (toolbarVerticalPadding * 2)
    }

    static var bottomInset: CGFloat {
        progressHeight + bottomControlGap
    }

    static var contentInsets: ReaderChromeInsets {
        ReaderChromeInsets(
            top: toolbarHeight + toolbarTextGap,
            bottom: bottomInset
        )
    }
}

private struct ReaderToolbarMenuButton: View {
    var onTOC: () -> Void
    var onSearch: () -> Void
    var onSettings: () -> Void

    @ViewBuilder
    var body: some View {
        if #available(iOS 26.0, *) {
            menuButton
                .buttonStyle(.glass)
        } else {
            menuButton
                .buttonStyle(LiquidGlassFallbackButtonStyle())
        }
    }

    private var menuButton: some View {
        Menu {
            Button(action: onTOC) {
                Label("Table of contents", systemImage: "list.bullet")
            }
            Button(action: onSearch) {
                Label("Search", systemImage: "magnifyingglass")
            }
            Button(action: onSettings) {
                Label("Reading settings", systemImage: "textformat.size")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .frame(
                    width: ReaderChromeLayout.toolbarButtonSize,
                    height: ReaderChromeLayout.toolbarButtonSize
                )
                .contentShape(Circle())
        }
        .buttonBorderShape(.circle)
        .accessibilityLabel("Reader actions")
    }
}

struct LiquidGlassIconButton: View {
    let systemName: String
    let accessibilityLabel: String
    var size: CGFloat = ReaderChromeLayout.toolbarButtonSize
    var font: Font = .body.weight(.medium)
    var foreground: Color = DesignSystem.Colors.foreground
    var prominent: Bool = false
    var action: () -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            if prominent {
                baseButton
                    .buttonStyle(.glassProminent)
            } else {
                baseButton
                    .buttonStyle(.glass)
            }
        } else {
            baseButton
                .buttonStyle(LiquidGlassFallbackButtonStyle())
        }
    }

    private var baseButton: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(font)
                .foregroundStyle(foreground)
                .frame(width: size, height: size)
                .contentShape(Circle())
        }
        .buttonBorderShape(.circle)
        .accessibilityLabel(accessibilityLabel)
    }
}

private struct LiquidGlassFallbackButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(.ultraThinMaterial, in: Circle())
            .overlay {
                Circle()
                    .stroke(.white.opacity(0.42), lineWidth: 0.7)
            }
            .shadow(color: .black.opacity(0.08), radius: 10, x: 0, y: 4)
            .opacity(configuration.isPressed ? 0.55 : 1)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}
