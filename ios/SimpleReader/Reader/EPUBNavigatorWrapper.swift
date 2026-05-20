import SwiftUI
import UIKit
import ReadiumShared
import ReadiumNavigator

struct EPUBNavigationRequest: Equatable {
    enum Target: Equatable {
        case link(ReadiumShared.Link)
        case locator(Locator)
    }

    let id = UUID()
    let target: Target
}

/// Wraps Readium's EPUBNavigatorViewController in SwiftUI.
/// Handles navigator creation, preference updates, and delegate callbacks.
struct EPUBNavigatorWrapper: UIViewControllerRepresentable {
    let publication: Publication
    let initialLocator: Locator?
    let preferences: ReaderDisplayPreferences
    let chromeInsets: ReaderChromeInsets
    let httpServer: HTTPServer
    let navigationRequest: EPUBNavigationRequest?

    /// Called when user selects text and taps Explain/ELI5
    var onSelectionAction: (String, SimplifyMode) -> Void

    /// Called when reading position changes (for progress tracking)
    var onPositionChanged: (Locator) -> Void

    /// Called when user taps center of page (toggle toolbar)
    var onCenterTap: () -> Void

    func makeUIViewController(context: Context) -> ReaderHostingController {
        // Build Readium preferences from our model
        let epubPrefs = buildEPUBPreferences()

        // Configure custom editing actions — keep defaults (copy, share, lookup) + add ours
        let config = EPUBNavigatorViewController.Configuration(
            preferences: epubPrefs,
            editingActions: EditingAction.defaultActions + [
                EditingAction(title: "Explain", action: #selector(ReaderHostingController.explainSelection)),
                EditingAction(title: "ELI5", action: #selector(ReaderHostingController.eli5Selection)),
            ]
        )

        let navigator = try! EPUBNavigatorViewController(
            publication: publication,
            initialLocation: initialLocator,
            config: config,
            httpServer: httpServer
        )

        navigator.delegate = context.coordinator
        context.coordinator.chromeInsets = chromeInsets

        let hostingVC = ReaderHostingController(navigator: navigator)
        hostingVC.onSelectionAction = { text, mode in
            onSelectionAction(text, mode)
        }
        hostingVC.onCenterTap = onCenterTap

        context.coordinator.navigator = navigator

        return hostingVC
    }

    func updateUIViewController(_ controller: ReaderHostingController, context: Context) {
        context.coordinator.chromeInsets = chromeInsets

        // Apply updated preferences when they change
        let epubPrefs = buildEPUBPreferences()
        controller.navigator.submitPreferences(epubPrefs)

        guard let request = navigationRequest,
              context.coordinator.lastNavigationRequestID != request.id else {
            return
        }

        context.coordinator.lastNavigationRequestID = request.id
        Task { @MainActor in
            switch request.target {
            case .link(let link):
                _ = await controller.navigator.go(to: link)
            case .locator(let locator):
                _ = await controller.navigator.go(to: locator)
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self, chromeInsets: chromeInsets)
    }

    // MARK: - Build Readium Preferences

    private func buildEPUBPreferences() -> EPUBPreferences {
        var prefs = EPUBPreferences()
        prefs.fontSize = preferences.fontSize.readiumMultiplier
        prefs.lineHeight = preferences.lineSpacing
        prefs.pageMargins = 1.12
        prefs.publisherStyles = false

        // Map our font family to Readium's font family
        if let fontFamily = preferences.fontFamily.readiumFontFamily {
            prefs.fontFamily = fontFamily
        }

        // Map theme
        switch preferences.resolvedColorScheme {
        case .light:
            prefs.theme = .light
        case .dark:
            prefs.theme = .dark
        @unknown default:
            prefs.theme = .light
        }

        return prefs
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, EPUBNavigatorDelegate {
        let parent: EPUBNavigatorWrapper
        weak var navigator: EPUBNavigatorViewController?
        var lastNavigationRequestID: UUID?
        var chromeInsets: ReaderChromeInsets

        init(parent: EPUBNavigatorWrapper, chromeInsets: ReaderChromeInsets) {
            self.parent = parent
            self.chromeInsets = chromeInsets
        }

        // MARK: - NavigatorDelegate (required)

        func navigator(_ navigator: any Navigator, presentError error: NavigatorError) {
            // Log errors for now — can surface to UI later
            print("Navigator error: \(error.localizedDescription)")
        }

        func navigator(_ navigator: any Navigator, locationDidChange locator: Locator) {
            parent.onPositionChanged(locator)
        }

        // MARK: - VisualNavigatorDelegate (tap handling)

        func navigatorContentInset(_ navigator: VisualNavigator) -> UIEdgeInsets? {
            let navigatorView = (navigator as? UIViewController)?.view
            let safeAreaInsets = navigatorView?.window?.safeAreaInsets
                ?? navigatorView?.safeAreaInsets
                ?? .zero

            return UIEdgeInsets(
                top: safeAreaInsets.top + chromeInsets.top,
                left: safeAreaInsets.left,
                bottom: safeAreaInsets.bottom + chromeInsets.bottom,
                right: safeAreaInsets.right
            )
        }

        func navigator(_ navigator: VisualNavigator, didTapAt point: CGPoint) {
            parent.onCenterTap()
        }
    }
}
