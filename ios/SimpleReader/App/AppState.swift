import SwiftUI
import ReadiumShared

/// Root application state — owns all services and manages screen navigation.
/// All views access this via @Environment(AppState.self).
@Observable
class AppState {

    // MARK: - Services

    let readiumService = ReadiumService()
    let library = BookLibrary()
    let preferences = ReadingPreferences()
    let apiClient = APIClient()

    // MARK: - Navigation

    enum Screen {
        case loading
        case library
        case reader(book: RecentBook, publication: Publication)
    }

    var currentScreen: Screen = .loading
    var readerError: String?

    // MARK: - Lifecycle

    /// Called on app launch — show the local library.
    func onLaunch() {
        currentScreen = .library
    }

    // MARK: - Book Navigation

    /// Open a book from the library
    func openBook(_ book: RecentBook) {
        // Resolve the security-scoped bookmark
        guard let url = BookImporter.resolveBookmark(book.bookmarkData) else {
            readerError = "File not found: \"\(book.title)\" may have been moved or deleted. Please add it again."
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
                readerError = "Could not open \"\(book.title)\". The file may have been moved or deleted."
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
