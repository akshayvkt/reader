import SwiftUI

/// "Continue Reading" hero card for the most recently opened book.
/// Ports HeroBookCard.tsx: large cover, title in Libre Baskerville, progress bar, "Resume" CTA.
struct HeroBookCard: View {
    let book: RecentBook
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.xl) {
                // Cover
                BookCoverView(
                    title: book.title,
                    coverData: book.coverImageData,
                    size: .large
                )
                .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)

                // Info
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    Text("Continue Reading")
                        .font(.caption)
                        .foregroundStyle(DesignSystem.Colors.accent)
                        .textCase(.uppercase)
                        .tracking(0.5)

                    Text(book.title)
                        .font(DesignSystem.Fonts.cardTitle)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    Text(book.author)
                        .font(.subheadline)
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                        .lineLimit(1)

                    Spacer()

                    // Progress bar
                    VStack(alignment: .leading, spacing: 4) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(DesignSystem.Colors.border)
                                    .frame(height: 1.5)

                                Rectangle()
                                    .fill(DesignSystem.Colors.accent)
                                    .frame(width: geo.size.width * book.progress, height: 1.5)
                            }
                        }
                        .frame(height: 1.5)

                        Text("\(Int(book.progress * 100))%")
                            .font(.caption2)
                            .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                    }

                    // Resume CTA
                    HStack(spacing: 4) {
                        Text("Resume")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(DesignSystem.Colors.accent)
                        Image(systemName: "arrow.right")
                            .font(.caption)
                            .foregroundStyle(DesignSystem.Colors.accent)
                    }
                }
            }
            .padding(DesignSystem.Spacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DesignSystem.Colors.surface)
            .cornerRadius(DesignSystem.CornerRadius.large)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.large)
                    .stroke(DesignSystem.Colors.border, lineWidth: 0.5)
            )
            .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
        }
        .buttonStyle(.plain)
    }
}
