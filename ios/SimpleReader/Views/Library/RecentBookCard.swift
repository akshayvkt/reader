import SwiftUI

/// Compact card for books in the "Recent" grid.
/// Ports RecentBookCard.tsx: small cover, title (2-line clamp), thin progress bar.
struct RecentBookCard: View {
    let book: RecentBook
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                // Cover
                BookCoverView(
                    title: book.title,
                    coverData: book.coverImageData,
                    size: .small
                )
                .shadow(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)

                // Title
                Text(book.title)
                    .font(DesignSystem.Fonts.smallTitle)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(width: 100, alignment: .leading)

                // Progress bar (only if > 0)
                if book.progress > 0 {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(DesignSystem.Colors.border)
                                .frame(height: 1)

                            Rectangle()
                                .fill(DesignSystem.Colors.accent)
                                .frame(width: geo.size.width * book.progress, height: 1)
                        }
                    }
                    .frame(width: 100, height: 1)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
