import SwiftUI

/// Compact shelf item for books in the recent grid.
struct RecentBookCard: View {
    let book: RecentBook
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                BookCoverView(
                    title: book.title,
                    coverData: book.coverImageData,
                    size: .small
                )
                .shadow(color: .black.opacity(0.16), radius: 8, x: 0, y: 5)

                Text(book.title)
                    .font(DesignSystem.Fonts.smallTitle)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(width: 100, alignment: .leading)

                if book.progress > 0 {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(DesignSystem.Colors.borderSubtle)
                                .frame(height: 2)

                            Capsule()
                                .fill(DesignSystem.Colors.accent)
                                .frame(width: max(geo.size.width * book.progress, 5), height: 2)
                        }
                    }
                    .frame(width: 100, height: 2)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
