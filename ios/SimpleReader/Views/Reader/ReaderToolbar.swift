import SwiftUI

/// Top toolbar for the reader.
struct ReaderToolbar: View {
    let chapterTitle: String
    var onBack: () -> Void
    var onTOC: () -> Void
    var onSearch: () -> Void
    var onSettings: () -> Void

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            LiquidGlassIconButton(
                systemName: "chevron.left",
                accessibilityLabel: "Back",
                action: onBack
            )

            Text(chapterTitle)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            HStack(spacing: DesignSystem.Spacing.xs) {
                LiquidGlassIconButton(
                    systemName: "list.bullet",
                    accessibilityLabel: "Table of contents",
                    action: onTOC
                )

                LiquidGlassIconButton(
                    systemName: "magnifyingglass",
                    accessibilityLabel: "Search",
                    action: onSearch
                )

                LiquidGlassIconButton(
                    systemName: "textformat.size",
                    accessibilityLabel: "Reading settings",
                    action: onSettings
                )
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.xl)
        .padding(.vertical, DesignSystem.Spacing.xs)
    }
}

struct LiquidGlassIconButton: View {
    let systemName: String
    let accessibilityLabel: String
    var size: CGFloat = 36
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
