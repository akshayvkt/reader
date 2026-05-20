import Foundation
import SwiftUI
import ReadiumNavigator

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
        self.fontFamily = FontFamily(storedValue: defaults.string(forKey: Self.fontKey)) ?? .iowanOldStyle
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

    /// Font options backed by iOS/Readium-supported font families.
    enum FontFamily: String, CaseIterable, Codable {
        case iowanOldStyle = "Iowan Old Style"
        case athelas = "Athelas"
        case georgia = "Georgia"
        case system = "System"
        case arial = "Arial"
        case timesNewRoman = "Times New Roman"
        case openDyslexic = "OpenDyslexic"

        init?(storedValue: String?) {
            switch storedValue {
            case "Charter":
                self = .iowanOldStyle
            case "Merriweather":
                self = .athelas
            case let value?:
                self.init(rawValue: value)
            case nil:
                return nil
            }
        }

        /// The CSS/Readium font family name
        var readiumName: String {
            switch self {
            case .iowanOldStyle: return "Iowan Old Style"
            case .athelas: return "Athelas"
            case .georgia: return "Georgia"
            case .system: return "-apple-system"
            case .arial: return "Arial"
            case .timesNewRoman: return "Times New Roman"
            case .openDyslexic: return "OpenDyslexic"
            }
        }

        var readiumFontFamily: ReadiumNavigator.FontFamily? {
            switch self {
            case .iowanOldStyle:
                return .iowanOldStyle
            case .athelas:
                return .athelas
            case .georgia:
                return .georgia
            case .system:
                return nil
            case .arial:
                return .arial
            case .timesNewRoman:
                return ReadiumNavigator.FontFamily(rawValue: "Times New Roman")
            case .openDyslexic:
                return .openDyslexic
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

        /// Convert size level to Readium's font size multiplier.
        /// Use a wider scale than raw point values so each step is visible.
        var readiumMultiplier: Double {
            switch self {
            case .small: return 0.90
            case .medium: return 1.00
            case .large: return 1.15
            case .extraLarge: return 1.32
            case .larger: return 1.52
            case .largest: return 1.75
            }
        }

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

struct ReaderDisplayPreferences: Equatable {
    let fontFamily: ReadingPreferences.FontFamily
    let fontSize: ReadingPreferences.FontSizeLevel
    let lineSpacing: Double
    let theme: ReadingPreferences.ThemeMode
    let resolvedColorScheme: ColorScheme

    init(_ preferences: ReadingPreferences, systemColorScheme: ColorScheme) {
        fontFamily = preferences.fontFamily
        fontSize = preferences.fontSize
        lineSpacing = preferences.lineSpacing.clamped(to: 1.0 ... 2.0)
        theme = preferences.theme

        switch preferences.theme {
        case .auto:
            resolvedColorScheme = systemColorScheme
        case .light:
            resolvedColorScheme = .light
        case .dark:
            resolvedColorScheme = .dark
        }
    }
}

private extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self {
        min(max(self, limits.lowerBound), limits.upperBound)
    }
}
