import SwiftUI
import UIKit

// MARK: - Design System
// Ports the color palette and typography from globals.css

enum DesignSystem {

    // MARK: - Colors (from globals.css CSS custom properties)

    enum Colors {
        // Adaptive colors that switch with system appearance
        static let background = Color("Background")
        static let backgroundMuted = Color("BackgroundMuted")
        static let surface = Color("Surface")
        static let foreground = Color("Foreground")
        static let foregroundMuted = Color("ForegroundMuted")
        static let foregroundSubtle = Color("ForegroundSubtle")
        static let accent = Color("Accent")
        static let accentHover = Color("AccentHover")
        static let accentLight = Color("AccentLight")
        static let accentSubtle = Color("AccentSubtle")
        static let border = Color("Border")
        static let borderSubtle = Color("BorderSubtle")

        // Fixed colors for when we need explicit light/dark values
        enum Light {
            static let background = Color(hex: "FAF7F2")
            static let backgroundMuted = Color(hex: "F5F0E8")
            static let surface = Color(hex: "FFFCF7")
            static let foreground = Color(hex: "2D2A26")
            static let foregroundMuted = Color(hex: "6B6560")
            static let foregroundSubtle = Color(hex: "9A9590")
            static let accent = Color(hex: "C4785C")
            static let accentHover = Color(hex: "B36A4E")
            static let accentLight = Color(hex: "E8C4B5")
            static let accentSubtle = Color(hex: "F5E6DE")
            static let link = Color(hex: "2E7D6B")
            static let border = Color(hex: "E8E2D9")
            static let borderSubtle = Color(hex: "F0EBE3")
        }

        enum Dark {
            static let background = Color(hex: "1F1D1A")
            static let backgroundMuted = Color(hex: "3A3632")
            static let surface = Color(hex: "292724")
            static let foreground = Color(hex: "EDE9E3")
            static let foregroundMuted = Color(hex: "B0AAA0")
            static let foregroundSubtle = Color(hex: "7A756C")
            static let accent = Color(hex: "D4907A")
            static let accentHover = Color(hex: "E0A08C")
            static let accentLight = Color(hex: "3D3530")
            static let accentSubtle = Color(hex: "2E2A27")
            static let link = Color(hex: "C9A892")
            static let border = Color(hex: "3A3632")
            static let borderSubtle = Color(hex: "2F2C29")
        }

        // 8 deterministic cover placeholder colors (from BookCover.tsx)
        static let coverPlaceholders: [Color] = [
            Color(hex: "8B7355"), // warm brown
            Color(hex: "6B8E7B"), // sage teal
            Color(hex: "7B6B8E"), // dusty purple
            Color(hex: "A69070"), // camel
            Color(hex: "6B7B5E"), // olive green
            Color(hex: "8E6B7B"), // mauve
            Color(hex: "5E6B7B"), // slate blue
            Color(hex: "7B7B5E"), // khaki
        ]
    }

    // MARK: - Fonts

    enum Fonts {
        static func libreBaskerville(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
            switch weight {
            case .bold:
                return .custom("LibreBaskerville-Bold", size: size)
            default:
                return .custom("LibreBaskerville-Regular", size: size)
            }
        }

        static func libreBaskervilleItalic(_ size: CGFloat) -> Font {
            .custom("LibreBaskerville-Italic", size: size)
        }

        static let title = libreBaskerville(28, weight: .regular)
        static let heading = libreBaskerville(20, weight: .regular)
        static let cardTitle = libreBaskerville(18, weight: .regular)
        static let smallTitle = libreBaskerville(15, weight: .regular)
    }

    // MARK: - Spacing

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
    }

    // MARK: - Corner Radius

    enum CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
    }
}

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - UIColor Hex Extension (for Readium decoration tints)

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: 1
        )
    }
}
