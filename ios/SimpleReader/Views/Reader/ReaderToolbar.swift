import SwiftUI

/// Top toolbar for the reader — back, chapter title, TOC, search, settings.
/// Ports the header from BookReader.tsx: auto-hiding, glass-morphic background.
struct ReaderToolbar: View {
    let chapterTitle: String
    var onBack: () -> Void
    var onTOC: () -> Void
    var onSearch: () -> Void
    var onSettings: () -> Void

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            // Back button
            Button(action: onBack) {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.foreground)
            }

            // Chapter title
            Text(chapterTitle)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .lineLimit(1)
                .frame(maxWidth: .infinity)

            // Action buttons
            HStack(spacing: DesignSystem.Spacing.lg) {
                Button(action: onTOC) {
                    Image(systemName: "list.bullet")
                        .font(.body)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }

                Button(action: onSearch) {
                    Image(systemName: "magnifyingglass")
                        .font(.body)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }

                Button(action: onSettings) {
                    Image(systemName: "gearshape")
                        .font(.body)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.xl)
        .padding(.vertical, DesignSystem.Spacing.md)
    }
}
