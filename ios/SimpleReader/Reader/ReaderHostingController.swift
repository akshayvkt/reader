import UIKit
import ReadiumNavigator
import ReadiumShared

/// UIViewController that hosts the Readium EPUBNavigatorViewController.
/// Sits in the responder chain so custom EditingAction selectors work.
///
/// This is the bridge between UIKit (Readium) and SwiftUI (our app).
/// Custom text selection actions ("Explain", "ELI5") target methods on this controller.
class ReaderHostingController: UIViewController {

    let navigator: EPUBNavigatorViewController

    /// Callback when user taps "Explain" or "ELI5" on selected text
    var onSelectionAction: ((String, SimplifyMode) -> Void)?

    /// Callback when user taps in the center of the page (toggle toolbar)
    var onCenterTap: (() -> Void)?

    init(navigator: EPUBNavigatorViewController) {
        self.navigator = navigator
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        // Black background fills the gaps around the navigator (status bar, home indicator area)
        view.backgroundColor = .black

        addChild(navigator)
        view.addSubview(navigator.view)
        navigator.didMove(toParent: self)

        // Pin navigator within safe area + extra padding so EPUB text is never behind
        // the floating toolbar (top) or page indicator (bottom).
        navigator.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            navigator.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 44),
            navigator.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navigator.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            navigator.view.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -30),
        ])
    }

    // MARK: - Custom Editing Actions

    /// Called when user taps "Explain" in the text selection menu
    @objc func explainSelection() {
        guard let selection = (navigator as? SelectableNavigator)?.currentSelection,
              let text = selection.locator.text.highlight, !text.isEmpty else { return }
        onSelectionAction?(text, .explain)
    }

    /// Called when user taps "ELI5" in the text selection menu
    @objc func eli5Selection() {
        guard let selection = (navigator as? SelectableNavigator)?.currentSelection,
              let text = selection.locator.text.highlight, !text.isEmpty else { return }
        onSelectionAction?(text, .eli5)
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if action == #selector(explainSelection) || action == #selector(eli5Selection) {
            return (navigator as? SelectableNavigator)?.currentSelection != nil
        }
        return super.canPerformAction(action, withSender: sender)
    }
}
