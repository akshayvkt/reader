import Foundation
import UIKit
import CryptoKit
import ReadiumShared
import ReadiumStreamer

/// Handles importing EPUB files: extracts metadata, cover, creates security-scoped bookmarks.
/// Ports the book import logic from page.tsx handleFileUpload().
enum BookImporter {

    /// Import an EPUB from a file URL (from document picker).
    /// Creates a security-scoped bookmark and extracts metadata.
    static func importBook(from url: URL, using readiumService: ReadiumService) async throws -> RecentBook {
        // Start accessing the security-scoped resource
        let accessing = url.startAccessingSecurityScopedResource()
        defer {
            if accessing {
                url.stopAccessingSecurityScopedResource()
            }
        }

        // Create security-scoped bookmark for persistent access
        let bookmarkData = try url.bookmarkData(
            options: .minimalBookmark,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )

        // Open the publication to read metadata
        let publication = try await readiumService.openPublication(at: url)

        // Extract metadata
        let title = publication.metadata.title ?? url.deletingPathExtension().lastPathComponent
        let author = publication.metadata.authors.first?.name ?? "Unknown Author"

        // Extract cover image — cover() returns ReadResult<UIImage?>
        var coverData: Data?
        if let cover = try? await publication.cover().get() {
            coverData = cover.pngData()
        }

        // Generate a stable ID from file content hash
        let fileData = try Data(contentsOf: url)
        let hash = SHA256.hash(data: fileData)
        let id = hash.compactMap { String(format: "%02x", $0) }.joined()

        return RecentBook(
            id: String(id.prefix(16)),
            title: title,
            author: author,
            coverImageData: coverData,
            lastOpened: Date(),
            progress: 0,
            locatorJSON: nil,
            bookmarkData: bookmarkData
        )
    }

    /// Resolve a security-scoped bookmark back to a file URL.
    /// Returns nil if the bookmark is stale and can't be resolved.
    static func resolveBookmark(_ bookmarkData: Data) -> URL? {
        var isStale = false
        guard let url = try? URL(
            resolvingBookmarkData: bookmarkData,
            bookmarkDataIsStale: &isStale
        ) else {
            return nil
        }

        if isStale {
            // Bookmark is stale but still resolved — could recreate it
            return url
        }

        return url
    }
}
