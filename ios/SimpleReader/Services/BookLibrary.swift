import Foundation

/// Manages the list of recent books — persisted as a JSON file.
/// Ports lib/libraryStorage.ts: max 12 books, add/update/get operations.
@Observable
class BookLibrary {
    private static let maxBooks = 12
    private static let fileName = "recent-books.json"

    var books: [RecentBook] = []

    init() {
        books = Self.load()
    }

    // MARK: - Public API

    /// Add a book to the library (or move it to the front if it already exists)
    func addBook(_ book: RecentBook) {
        // Remove existing entry with same ID (deduplication)
        books.removeAll { $0.id == book.id }

        // Prepend (most recent first)
        books.insert(book, at: 0)

        // Cap at max
        if books.count > Self.maxBooks {
            books = Array(books.prefix(Self.maxBooks))
        }

        save()
    }

    /// Update reading progress for a book
    func updateProgress(bookId: String, progress: Double, locatorJSON: String? = nil) {
        guard let index = books.firstIndex(where: { $0.id == bookId }) else { return }

        books[index].progress = min(max(progress, 0), 1)
        books[index].lastOpened = Date()

        if let locator = locatorJSON {
            books[index].locatorJSON = locator
        }

        save()
    }

    /// Get a book by its ID
    func getBook(byId id: String) -> RecentBook? {
        books.first { $0.id == id }
    }

    /// The most recently opened book (for the hero card)
    var mostRecent: RecentBook? {
        books.first
    }

    /// All books except the most recent (for the grid)
    var recentBooks: [RecentBook] {
        Array(books.dropFirst())
    }

    // MARK: - Persistence

    private static var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent(fileName)
    }

    private static func load() -> [RecentBook] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? JSONDecoder().decode([RecentBook].self, from: data)) ?? []
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(books) else { return }
        try? data.write(to: Self.fileURL, options: .atomic)
    }
}
