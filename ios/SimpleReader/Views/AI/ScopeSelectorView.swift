import SwiftUI

/// Scope selector pills: Highlight / Chapter / Whole Book.
/// Ports the scope selector from ChatPanel.tsx.
/// Disabled pills when context is not available.
struct ScopeSelectorView: View {
    @Binding var selectedScope: ContextScope
    let hasHighlightContext: Bool
    let hasChapterContext: Bool
    let hasBookContext: Bool

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            scopeButton(.highlight, label: "Highlight", enabled: hasHighlightContext)
            scopeButton(.chapter, label: "Chapter", enabled: hasChapterContext)
            scopeButton(.book, label: "Whole Book", enabled: hasBookContext)
        }
    }

    private func scopeButton(_ scope: ContextScope, label: String, enabled: Bool) -> some View {
        Button {
            if enabled {
                selectedScope = scope
            }
        } label: {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(
                    selectedScope == scope
                        ? .white
                        : enabled
                            ? DesignSystem.Colors.foreground
                            : DesignSystem.Colors.foregroundSubtle
                )
                .padding(.horizontal, DesignSystem.Spacing.md)
                .padding(.vertical, DesignSystem.Spacing.sm)
                .background(
                    selectedScope == scope
                        ? DesignSystem.Colors.accent
                        : enabled
                            ? DesignSystem.Colors.backgroundMuted
                            : DesignSystem.Colors.backgroundMuted.opacity(0.5)
                )
                .cornerRadius(20)
        }
        .disabled(!enabled)
        .buttonStyle(.plain)
    }
}
