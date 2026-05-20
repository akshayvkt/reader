import SwiftUI

/// "Continue" row for the most recently opened book.
struct HeroBookCard: View {
    let book: RecentBook
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.lg) {
                BookCoverView(
                    title: book.title,
                    coverData: book.coverImageData,
                    size: .large
                )
                .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 8)

                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(book.title)
                        .font(DesignSystem.Fonts.cardTitle)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    Text(book.author)
                        .font(.subheadline)
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                        .lineLimit(1)

                    Spacer(minLength: DesignSystem.Spacing.lg)

                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(DesignSystem.Colors.borderSubtle)
                                    .frame(height: 3)

                                Capsule()
                                    .fill(DesignSystem.Colors.accent)
                                    .frame(width: max(geo.size.width * book.progress, book.progress > 0 ? 6 : 0), height: 3)
                            }
                        }
                        .frame(height: 3)

                        HStack(spacing: DesignSystem.Spacing.xs) {
                            Text(book.progress > 0 ? "\(Int(book.progress * 100))%" : "Start")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(DesignSystem.Colors.foregroundMuted)

                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                        }
                    }
                }
            }
            .padding(DesignSystem.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DesignSystem.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
