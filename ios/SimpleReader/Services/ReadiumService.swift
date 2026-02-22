import Foundation
import ReadiumShared
import ReadiumStreamer
import ReadiumAdapterGCDWebServer

/// Manages Readium toolkit setup: opening publications, creating navigators.
/// This is a singleton — Readium components should be reused across the app.
@Observable
class ReadiumService {
    private let httpClient: HTTPClient
    private let assetRetriever: AssetRetriever
    private let publicationOpener: PublicationOpener

    /// HTTP server required by EPUBNavigatorViewController to serve EPUB resources
    let httpServer: HTTPServer

    init() {
        httpClient = DefaultHTTPClient()
        assetRetriever = AssetRetriever(httpClient: httpClient)
        httpServer = GCDHTTPServer(assetRetriever: assetRetriever)
        // Use EPUBParser directly since we only need EPUB support
        // (DefaultPublicationParser requires a PDFDocumentFactory)
        publicationOpener = PublicationOpener(parser: EPUBParser())
    }

    /// Open an EPUB publication from a file URL.
    /// The caller must ensure security-scoped access is active.
    func openPublication(at url: URL) async throws -> Publication {
        // FileURL is the concrete type for file:// URLs in Readium
        // (AbsoluteURL is a protocol, not directly constructible)
        guard let fileURL = FileURL(url: url) else {
            throw ReadiumError.invalidURL
        }

        let asset = try await assetRetriever.retrieve(url: fileURL).get()
        let publication = try await publicationOpener.open(
            asset: asset,
            allowUserInteraction: false
        ).get()

        return publication
    }

    enum ReadiumError: LocalizedError {
        case invalidURL

        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid file URL"
            }
        }
    }
}
