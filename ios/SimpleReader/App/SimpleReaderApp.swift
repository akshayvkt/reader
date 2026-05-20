import SwiftUI

/// Main app entry point.
/// Manages root navigation between library and reader screens.
@main
struct SimpleReaderApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
                switch appState.currentScreen {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(DesignSystem.Colors.background)

                case .library:
                    LibraryView()
                        .environment(appState)

                case .reader(let book, let publication):
                    ReaderView(book: book, publication: publication)
                        .environment(appState)
                }
            }
            .tint(DesignSystem.Colors.accent)
            .preferredColorScheme(appState.preferences.colorSchemeOverride)
            .task {
                appState.onLaunch()
            }
        }
    }
}
