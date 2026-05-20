import Foundation
import SwiftUI

/// Typography and theme settings — persisted in UserDefaults.
/// Matches the 7 fonts, 6 sizes, and spacing range from BookReader.tsx.
@Observable
class ReadingPreferences {
    private static let fontKey = "reader-font-preference"
    private static let sizeKey = "reader-font-size"
    private static let spacingKey = "reader-line-spacing"
    private static let themeKey = "reader-theme"

    var fontFamily: FontFamily {
        didSet { UserDefaults.standard.set(fontFamily.rawValue, forKey: Self.fontKey) }
    }

    var fontSize: FontSizeLevel {
        didSet { UserDefaults.standard.set(fontSize.rawValue, forKey: Self.sizeKey) }
    }

    var lineSpacing: Double {
        didSet { UserDefaults.standard.set(lineSpacing, forKey: Self.spacingKey) }
    }

    var theme: ThemeMode {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: Self.themeKey) }
    }

    init() {
        let defaults = UserDefaults.standard
        self.fontFamily = FontFamily(rawValue: defaults.string(forKey: Self.fontKey) ?? "") ?? .charter
        self.fontSize = FontSizeLevel(rawValue: defaults.integer(forKey: Self.sizeKey)) ?? .medium
        self.lineSpacing = defaults.object(forKey: Self.spacingKey) != nil
            ? defaults.double(forKey: Self.spacingKey)
            : 1.55
        self.theme = ThemeMode(rawValue: defaults.string(forKey: Self.themeKey) ?? "") ?? .auto
    }

    // MARK: - Font Size Controls (matching web's A/A buttons)

    var canIncrease: Bool { fontSize != FontSizeLevel.allCases.last }
    var canDecrease: Bool { fontSize != FontSizeLevel.allCases.first }

    func increase() {
        let all = FontSizeLevel.allCases
        guard let idx = all.firstIndex(of: fontSize), idx + 1 < all.count else { return }
        fontSize = all[idx + 1]
    }

    func decrease() {
        let all = FontSizeLevel.allCases
        guard let idx = all.firstIndex(of: fontSize), idx > 0 else { return }
        fontSize = all[idx - 1]
    }

    var sizeIndex: Int {
        FontSizeLevel.allCases.firstIndex(of: fontSize) ?? 2
    }

    /// SwiftUI ColorScheme override based on theme preference
    var colorSchemeOverride: ColorScheme? {
        switch theme {
        case .auto: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    // MARK: - Types

    /// 7 font options matching BookReader.tsx lines 19-27
    enum FontFamily: String, CaseIterable, Codable {
        case charter = "Charter"
        case merriweather = "Merriweather"
        case georgia = "Georgia"
        case system = "System Default"
        case arial = "Arial"
        case timesNewRoman = "Times New Roman"
        case openDyslexic = "OpenDyslexic"

        /// The CSS/Readium font family name
        var readiumName: String {
            switch self {
            case .charter: return "Charter"
            case .merriweather: return "Merriweather"
            case .georgia: return "Georgia"
            case .system: return "-apple-system"
            case .arial: return "Arial"
            case .timesNewRoman: return "Times New Roman"
            case .openDyslexic: return "OpenDyslexic"
            }
        }
    }

    /// 6 size levels matching BookReader.tsx lines 36-43
    enum FontSizeLevel: Int, CaseIterable, Codable, Comparable {
        case small = 14
        case medium = 16
        case large = 18
        case extraLarge = 20
        case larger = 22
        case largest = 24

        var label: String {
            switch self {
            case .small: return "Small"
            case .medium: return "Medium"
            case .large: return "Large"
            case .extraLarge: return "Extra Large"
            case .larger: return "Larger"
            case .largest: return "Largest"
            }
        }

        var points: CGFloat { CGFloat(rawValue) }

        /// Convert pixel size to Readium's font size multiplier.
        /// Readium uses 1.0 = 100% (default ~16px base), so 18px → 1.125
        var readiumMultiplier: Double { Double(rawValue) / 16.0 }

        static func < (lhs: FontSizeLevel, rhs: FontSizeLevel) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    enum ThemeMode: String, CaseIterable, Codable {
        case auto = "Auto"
        case light = "Light"
        case dark = "Dark"
    }
}
