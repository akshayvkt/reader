import SwiftUI
import ReadiumShared

/// Root application state — owns all services and manages screen navigation.
/// All views access this via @Environment(AppState.self).
@Observable
class AppState {

    // MARK: - Services

    let authService: AuthService
    let readiumService = ReadiumService()
    let library = BookLibrary()
    let preferences = ReadingPreferences()
    let apiClient: APIClient

    init() {
        let auth = AuthService()
        self.authService = auth
        self.apiClient = APIClient(authService: auth)
    }

    // MARK: - Navigation

    enum Screen {
        case loading
        case login
        case library
        case reader(book: RecentBook, publication: Publication)
    }

    var currentScreen: Screen = .loading

    // MARK: - Lifecycle

    /// Called on app launch — check auth and show appropriate screen
    func onLaunch() {
        // Skip auth for now — go straight to library
        currentScreen = .library
    }

    /// Skip auth and go to library (temporary, until Google Sign-In is wired up)
    func skipAuth() {
        currentScreen = .library
    }

    // MARK: - Book Navigation

    /// Open a book from the library
    func openBook(_ book: RecentBook) {
        // Resolve the security-scoped bookmark
        guard let url = BookImporter.resolveBookmark(book.bookmarkData) else {
            // TODO: Show error — bookmark is stale
            return
        }

        let accessing = url.startAccessingSecurityScopedResource()

        Task { @MainActor in
            do {
                let publication = try await readiumService.openPublication(at: url)

                // Update last opened time
                library.updateProgress(bookId: book.id, progress: book.progress)

                currentScreen = .reader(book: book, publication: publication)
            } catch {
                // TODO: Show error
                print("Failed to open book: \(error)")
                if accessing {
                    url.stopAccessingSecurityScopedResource()
                }
            }
        }
    }

    /// Close the reader and return to library
    func closeReader() {
        currentScreen = .library
    }
}
