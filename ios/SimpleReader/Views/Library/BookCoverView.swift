import SwiftUI

/// Displays a book cover image, or a colored placeholder with the title.
/// Ports BookCover.tsx: deterministic color from title hash, same 8 colors.
struct BookCoverView: View {
    let title: String
    let coverData: Data?
    var size: CoverSize = .small

    enum CoverSize {
        case small, large

        var width: CGFloat {
            switch self {
            case .small: return 100
            case .large: return 120
            }
        }

        var height: CGFloat { width * 1.5 } // 2:3 aspect ratio

        var titleFont: Font {
            switch self {
            case .small: return .system(size: 12, weight: .medium)
            case .large: return .system(size: 14, weight: .medium)
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
                .cornerRadius(DesignSystem.CornerRadius.small)
        } else {
            // Placeholder with deterministic color
            ZStack(alignment: .bottomLeading) {
                placeholderColor
                    .frame(width: size.width, height: size.height)

                Text(title)
                    .font(size.titleFont)
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .padding(10)
            }
            .cornerRadius(DesignSystem.CornerRadius.small)
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
