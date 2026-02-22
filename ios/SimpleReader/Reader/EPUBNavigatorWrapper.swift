import SwiftUI
import ReadiumShared
import ReadiumNavigator

/// Wraps Readium's EPUBNavigatorViewController in SwiftUI.
/// Handles navigator creation, preference updates, and delegate callbacks.
struct EPUBNavigatorWrapper: UIViewControllerRepresentable {
    let publication: Publication
    let initialLocator: Locator?
    let preferences: ReadingPreferences

    /// Called when user selects text and taps Explain/ELI5
    var onSelectionAction: (String, SimplifyMode) -> Void

    /// Called when reading position changes (for progress tracking)
    var onPositionChanged: (Locator) -> Void

    /// Called when user taps center of page (toggle toolbar)
    var onCenterTap: () -> Void

    func makeUIViewController(context: Context) -> ReaderHostingController {
        // Build Readium preferences from our model
        let epubPrefs = buildEPUBPreferences()

        // Configure custom editing actions for text selection menu
        let config = EPUBNavigatorViewController.Configuration(
            preferences: epubPrefs,
            editingActions: [
                EditingAction(title: "Explain", action: #selector(ReaderHostingController.explainSelection)),
                EditingAction(title: "ELI5", action: #selector(ReaderHostingController.eli5Selection)),
            ]
        )

        let navigator = try! EPUBNavigatorViewController(
            publication: publication,
            initialLocation: initialLocator,
            config: config
        )

        navigator.delegate = context.coordinator

        let hostingVC = ReaderHostingController(navigator: navigator)
        hostingVC.onSelectionAction = { text, mode in
            onSelectionAction(text, mode)
        }
        hostingVC.onCenterTap = onCenterTap

        context.coordinator.navigator = navigator

        return hostingVC
    }

    func updateUIViewController(_ controller: ReaderHostingController, context: Context) {
        // Apply updated preferences when they change
        let epubPrefs = buildEPUBPreferences()
        controller.navigator.submitPreferences(epubPrefs)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    // MARK: - Build Readium Preferences

    private func buildEPUBPreferences() -> EPUBPreferences {
        var prefs = EPUBPreferences()
        prefs.fontSize = preferences.fontSize.points
        prefs.lineHeight = preferences.lineSpacing

        // Map our font family to Readium's font family
        if preferences.fontFamily != .system {
            prefs.fontFamily = FontFamily(rawValue: preferences.fontFamily.readiumName)
        }

        // Map theme
        switch preferences.theme {
        case .light:
            prefs.theme = .light
        case .dark:
            prefs.theme = .dark
        case .auto:
            break // Let Readium follow system
        }

        return prefs
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, EPUBNavigatorDelegate {
        let parent: EPUBNavigatorWrapper
        weak var navigator: EPUBNavigatorViewController?

        init(parent: EPUBNavigatorWrapper) {
            self.parent = parent
        }

        // MARK: - NavigatorDelegate

        func navigator(_ navigator: any Navigator, locationDidChange locator: Locator) {
            parent.onPositionChanged(locator)
        }
    }
}
