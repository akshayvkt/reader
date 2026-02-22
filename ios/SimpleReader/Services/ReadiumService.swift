import Foundation
import ReadiumShared
import ReadiumStreamer
import ReadiumNavigator
import ReadiumAdapterGCDWebServer

/// Manages Readium toolkit setup: opening publications, creating navigators.
/// This is a singleton — Readium components should be reused across the app.
@Observable
class ReadiumService {
    private let httpClient: HTTPClient
    private let assetRetriever: AssetRetriever
    private let publicationOpener: PublicationOpener

    init() {
        httpClient = DefaultHTTPClient()
        assetRetriever = AssetRetriever(httpClient: httpClient)
        publicationOpener = PublicationOpener(
            parser: DefaultPublicationParser(
                httpClient: httpClient,
                assetRetriever: assetRetriever,
                pdfFactory: nil
            )
        )
    }

    /// Open an EPUB publication from a file URL.
    /// The caller must ensure security-scoped access is active.
    func openPublication(at url: URL) async throws -> Publication {
        let absoluteURL = url.absoluteURL

        guard let readiumURL = try? AbsoluteURL(url: absoluteURL) else {
            throw ReadiumError.invalidURL
        }

        let asset = try await assetRetriever.retrieve(url: readiumURL).get()
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
