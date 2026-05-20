import SwiftUI

/// Displays a book cover image, or a colored placeholder with the title.
struct BookCoverView: View {
    let title: String
    let coverData: Data?
    var size: CoverSize = .small

    enum CoverSize {
        case small, large

        var width: CGFloat {
            switch self {
            case .small: return 102
            case .large: return 118
            }
        }

        var height: CGFloat { width * 1.5 } // 2:3 aspect ratio

        var titleFont: Font {
            switch self {
            case .small: return .system(size: 12, weight: .semibold)
            case .large: return .system(size: 14, weight: .semibold)
            }
        }
    }

    var body: some View {
        if let data = coverData, let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size.width, height: size.height)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        } else {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(
                    colors: [placeholderColor.opacity(0.92), placeholderColor],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(width: size.width, height: size.height)

                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Rectangle()
                        .fill(.white.opacity(0.42))
                        .frame(width: size.width * 0.42, height: 2)
                    Rectangle()
                        .fill(.white.opacity(0.28))
                        .frame(width: size.width * 0.28, height: 2)
                    Spacer()
                }
                .padding(10)

                Text(title)
                    .font(size.titleFont)
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .padding(10)
            }
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        }
    }

    /// Deterministic color from title hash — matches BookCover.tsx generateColor()
    private var placeholderColor: Color {
        let colors = DesignSystem.Colors.coverPlaceholders
        var hash = 0
        for char in title.unicodeScalars {
            hash = Int(char.value) &+ ((hash << 5) &- hash)
        }
        let index = abs(hash) % colors.count
        return colors[index]
    }
}
