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
        static let accent = Color("AccentColor")
        static let accentHover = Color("AccentHover")
        static let accentLight = Color("AccentLight")
        static let accentSubtle = Color("AccentSubtle")
        static let border = Color("Border")
        static let borderSubtle = Color("BorderSubtle")

        // Fixed colors for when we need explicit light/dark values
        enum Light {
            static let background = Color(hex: "F7F7F5")
            static let backgroundMuted = Color(hex: "EFEFED")
            static let surface = Color(hex: "FFFFFF")
            static let foreground = Color(hex: "111111")
            static let foregroundMuted = Color(hex: "5F5F63")
            static let foregroundSubtle = Color(hex: "9B9BA1")
            static let accent = Color(hex: "FF8A00")
            static let accentHover = Color(hex: "E57900")
            static let accentLight = Color(hex: "FFD59A")
            static let accentSubtle = Color(hex: "FFF0DA")
            static let link = Color(hex: "0A84FF")
            static let border = Color(hex: "D9D9DD")
            static let borderSubtle = Color(hex: "ECECEF")
        }

        enum Dark {
            static let background = Color(hex: "000000")
            static let backgroundMuted = Color(hex: "1C1C1E")
            static let surface = Color(hex: "1C1C1E")
            static let foreground = Color(hex: "F5F5F7")
            static let foregroundMuted = Color(hex: "B8B8BE")
            static let foregroundSubtle = Color(hex: "7F7F86")
            static let accent = Color(hex: "FF9F0A")
            static let accentHover = Color(hex: "FFB340")
            static let accentLight = Color(hex: "4A3217")
            static let accentSubtle = Color(hex: "2B2117")
            static let link = Color(hex: "0A84FF")
            static let border = Color(hex: "343438")
            static let borderSubtle = Color(hex: "252529")
        }

        // 8 deterministic cover placeholder colors (from BookCover.tsx)
        static let coverPlaceholders: [Color] = [
            Color(hex: "C25B4E"),
            Color(hex: "2F7D6E"),
            Color(hex: "6456A3"),
            Color(hex: "B7772D"),
            Color(hex: "4D7A3F"),
            Color(hex: "A94375"),
            Color(hex: "366D9F"),
            Color(hex: "7B7A34"),
        ]
    }

    // MARK: - Fonts

    enum Fonts {
        static let title = Font.system(.largeTitle, design: .default).weight(.bold)
        static let heading = Font.system(.title3, design: .default).weight(.semibold)
        static let cardTitle = Font.system(.headline, design: .default)
        static let smallTitle = Font.system(.subheadline, design: .default).weight(.medium)
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
