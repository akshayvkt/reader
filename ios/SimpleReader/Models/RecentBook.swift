import Foundation

/// Book metadata model — mirrors types/library.ts from the web app.
/// Stored in a JSON file in the app's Documents directory.
struct RecentBook: Codable, Identifiable, Equatable {
    /// Unique identifier derived from file content hash
    let id: String

    /// Book title extracted from EPUB metadata
    var title: String

    /// Book author extracted from EPUB metadata
    var author: String

    /// Cover image as PNG data (extracted from EPUB)
    var coverImageData: Data?

    /// Last time this book was opened
    var lastOpened: Date

    /// Reading progress 0.0 to 1.0
    var progress: Double

    /// Readium Locator serialized as JSON string for position restore
    var locatorJSON: String?

    /// Security-scoped bookmark data for persistent file access
    var bookmarkData: Data

    static func == (lhs: RecentBook, rhs: RecentBook) -> Bool {
        lhs.id == rhs.id
    }
}
