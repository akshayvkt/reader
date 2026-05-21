import Foundation
import SwiftUI
import UIKit
import ReadiumShared
import ReadiumNavigator

/// Full-screen EPUB reader with toolbar, text selection popup, and overlays.
/// Ports BookReader.tsx: reader + toolbar + simplifier + chapter nav + search + settings.
struct ReaderView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.colorScheme) private var systemColorScheme
    let book: RecentBook
    let publication: Publication

    @State private var showToolbar = true
    @State private var preferences: ReadingPreferences

    // Text selection / AI popup state
    @State private var selectedText: String?
    @State private var selectionMode: SimplifyMode = .explain
    @State private var showSelectionPopup = false

    // Panel states
    @State private var showTableOfContents = false
    @State private var showSearch = false
    @State private var showSettings = false

    // Chat state
    @State private var conversation: ConversationContext?
    @State private var presentedConversation: ConversationContext?
    @State private var chatDetent: PresentationDetent = .fraction(0.40)

    // Voice state
    @State private var voiceSession = VoiceSessionManager()
    @State private var showVoiceTranscript = false
    @State private var voiceTranscriptDetent: PresentationDetent = .fraction(0.40)

    // Current reading position
    @State private var currentLocator: Locator?
    @State private var currentChapterTitle: String?
    @State private var totalPositionCount: Int?
    @State private var navigationRequest: EPUBNavigationRequest?

    private let maxBookContextCharacters = 120_000

    init(book: RecentBook, publication: Publication) {
        self.book = book
        self.publication = publication
        self._preferences = State(initialValue: ReadingPreferences())
        self._currentLocator = State(initialValue: book.locatorJSON.flatMap { try? Locator(jsonString: $0) })
    }

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()

            // EPUB Navigator (full screen)
            EPUBNavigatorWrapper(
                publication: publication,
                initialLocator: restoreLocator(),
                preferences: ReaderDisplayPreferences(preferences, systemColorScheme: systemColorScheme),
                chromeInsets: ReaderChromeLayout.contentInsets,
                httpServer: appState.readiumService.httpServer,
                navigationRequest: navigationRequest,
                onSelectionAction: { text, mode in
                    selectedText = text
                    selectionMode = mode
                    showSelectionPopup = true
                },
                onPositionChanged: { locator in
                    currentLocator = locator
                    updateChapterTitle(from: locator)
                    saveProgress(locator)
                },
                onCenterTap: {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        showToolbar.toggle()
                    }
                }
            )
            .ignoresSafeArea()

            // Toolbar overlay
            if showToolbar {
                VStack {
                    ReaderToolbar(
                        chapterTitle: currentChapterTitle ?? book.title,
                        onBack: closeReader,
                        onTOC: { showTableOfContents = true },
                        onSearch: { showSearch = true },
                        onSettings: { showSettings = true },
                        onVoice: openReaderVoice,
                        onChat: openReaderChat,
                        isVoiceActive: voiceSession.isActive
                    )
                    .offset(y: ReaderChromeLayout.toolbarYOffset)

                    Spacer()

                    if presentedConversation == nil, !showVoiceTranscript, let pageProgressText {
                        Text(pageProgressText)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, ReaderChromeLayout.bottomControlGap)
                    }
                }
                .transition(.opacity)
            }

            if voiceSession.isActive, !showVoiceTranscript {
                VStack {
                    Spacer()

                    VoiceOverlayView(
                        session: voiceSession,
                        onTranscript: {
                            voiceTranscriptDetent = .fraction(0.40)
                            showVoiceTranscript = true
                        }
                    )
                    .padding(.bottom, ReaderChromeLayout.bottomInset + 54)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .task(id: book.id) {
            if let currentLocator {
                updateChapterTitle(from: currentLocator)
            }
            await loadPositionCount()
        }
        // Selection popup
        .overlay {
            if showSelectionPopup, let text = selectedText {
                SelectionPopupView(
                    text: text,
                    mode: selectionMode,
                    apiClient: appState.apiClient,
                    onClose: {
                        showSelectionPopup = false
                        selectedText = nil
                    },
                    onExpand: { originalText, messages in
                        let nextConversation = ConversationContext(
                            source: .selection,
                            originalText: originalText,
                            messages: messages,
                            scope: .highlight,
                            chapterText: nil, // Will be extracted when chat opens
                            bookText: nil,
                            chapterTitle: currentChapterTitle
                        )
                        conversation = nextConversation
                        showSelectionPopup = false
                        selectedText = nil
                        presentedConversation = nextConversation
                        loadReaderContexts(for: nextConversation)
                    }
                )
            }
        }
        // Table of contents
        .sheet(isPresented: $showTableOfContents) {
            TableOfContentsView(
                toc: publication.manifest.tableOfContents,
                currentHref: currentLocator?.href.string,
                onNavigate: { link in
                    navigate(to: link)
                    showTableOfContents = false
                }
            )
            .presentationDetents([.large])
        }
        // Search
        .sheet(isPresented: $showSearch) {
            SearchPanelView(
                publication: publication,
                onNavigate: { locator in
                    navigate(to: locator)
                    showSearch = false
                }
            )
                .presentationDetents([.large])
        }
        // Settings
        .sheet(isPresented: $showSettings) {
            TypographySettingsView(preferences: preferences)
                .presentationDetents([.medium])
        }
        // Chat panel
        .sheet(item: $presentedConversation) { conversation in
            ChatPanelView(
                conversation: conversation,
                apiClient: appState.apiClient,
                onClose: { presentedConversation = nil }
            )
            .presentationDetents([.fraction(0.40), .fraction(0.65), .large], selection: $chatDetent)
            .presentationDragIndicator(.visible)
            .presentationBackground(.regularMaterial)
            .presentationBackgroundInteraction(.enabled(upThrough: .fraction(0.40)))
            .presentationCornerRadius(32)
            .presentationContentInteraction(.scrolls)
        }
        .sheet(isPresented: $showVoiceTranscript) {
            VoiceTranscriptSheetView(
                session: voiceSession,
                onClose: { showVoiceTranscript = false }
            )
            .presentationDetents([.fraction(0.40), .fraction(0.70)], selection: $voiceTranscriptDetent)
            .presentationDragIndicator(.visible)
            .presentationBackground(.regularMaterial)
            .presentationBackgroundInteraction(.enabled(upThrough: .fraction(0.40)))
            .presentationCornerRadius(32)
            .presentationContentInteraction(.scrolls)
        }
        .preferredColorScheme(preferences.colorSchemeOverride)
    }

    // MARK: - Chat

    private var pageProgressText: String? {
        guard let totalPositionCount, totalPositionCount > 0 else { return nil }

        let position = currentLocator?.locations.position
            ?? currentLocator?.locations.totalProgression.map {
                max(1, min(totalPositionCount, Int(ceil($0 * Double(totalPositionCount)))))
            }
            ?? 1

        return "\(max(1, min(position, totalPositionCount))) of \(totalPositionCount)"
    }

    private func loadPositionCount() async {
        let count = await publication.positions().getOrNil()?.count
        await MainActor.run {
            totalPositionCount = count.flatMap { $0 > 0 ? $0 : nil }
        }
    }

    private func openReaderChat() {
        if let conversation {
            chatDetent = .fraction(0.40)
            presentedConversation = conversation
            if conversation.chapterText == nil || conversation.bookText == nil {
                loadReaderContexts(for: conversation)
            }
            return
        }

        let nextConversation = ConversationContext(
            source: .reader,
            originalText: nil,
            messages: [],
            scope: .chapter,
            chapterTitle: currentChapterTitle ?? "Current Chapter"
        )
        conversation = nextConversation
        chatDetent = .fraction(0.40)
        presentedConversation = nextConversation
        loadReaderContexts(for: nextConversation)
    }

    private func openReaderVoice() {
        if voiceSession.isActive {
            voiceTranscriptDetent = .fraction(0.40)
            showVoiceTranscript = true
            return
        }

        voiceSession.markPreparing()

        Task {
            let chapterData = await extractCurrentChapter()
            let voiceContext = VoiceSessionContext(
                bookTitle: book.title,
                chapterTitle: chapterData?.title ?? currentChapterTitle ?? "Current Chapter",
                scope: .chapter,
                scopeContext: chapterData?.text
            )

            await voiceSession.start(context: voiceContext)
        }
    }

    private func closeReader() {
        voiceSession.stop()
        appState.closeReader()
    }

    private func loadReaderContexts(for targetConversation: ConversationContext) {
        Task {
            let chapterData = await extractCurrentChapter()
            await MainActor.run {
                guard let currentConversation = conversation, currentConversation === targetConversation else { return }
                if let chapterData {
                    currentConversation.chapterText = chapterData.text
                    currentConversation.chapterTitle = chapterData.title
                    if currentConversation.source == .reader {
                        currentConversation.scope = .chapter
                    }
                }
            }

            let bookText = await extractBookText()
            await MainActor.run {
                guard let currentConversation = conversation, currentConversation === targetConversation else { return }
                if let bookText, !bookText.isEmpty {
                    currentConversation.bookText = bookText
                }
            }
        }
    }

    private func extractCurrentChapter() async -> (text: String, title: String)? {
        guard let link = currentReadingOrderLink(),
              let text = await extractPlainText(from: link),
              !text.isEmpty else {
            return nil
        }

        let title = currentChapterTitle
            ?? link.title
            ?? findTocTitle(in: publication.manifest.tableOfContents, matching: normalizedHref(link.href))
            ?? "Current Chapter"

        return (text, title)
    }

    private func extractBookText() async -> String? {
        var sections: [String] = []
        var totalCharacters = 0

        for link in publication.readingOrder {
            guard let text = await extractPlainText(from: link), !text.isEmpty else {
                continue
            }

            let remainingCharacters = maxBookContextCharacters - totalCharacters
            guard remainingCharacters > 0 else { break }

            let cappedText = text.count > remainingCharacters
                ? String(text.prefix(remainingCharacters))
                : text

            sections.append(cappedText)
            totalCharacters += cappedText.count

            if totalCharacters >= maxBookContextCharacters {
                break
            }
        }

        return sections.isEmpty ? nil : sections.joined(separator: "\n\n---\n\n")
    }

    private func extractPlainText(from link: ReadiumShared.Link) async -> String? {
        guard let resource = publication.get(link) else { return nil }

        do {
            let html = try await resource.readAsString().get()
            return plainText(fromHTML: html)
        } catch {
            return nil
        }
    }

    private func currentReadingOrderLink() -> ReadiumShared.Link? {
        guard let locator = currentLocator else {
            return publication.readingOrder.first
        }

        let currentHref = normalizedHref(locator.href.string)
        return publication.readingOrder.first { link in
            let linkHref = normalizedHref(link.href)
            return currentHref == linkHref
                || currentHref.hasSuffix("/\(linkHref)")
                || linkHref.hasSuffix("/\(currentHref)")
        } ?? publication.readingOrder.first
    }

    private func normalizedHref(_ href: String) -> String {
        let withoutFragment = href.split(separator: "#", maxSplits: 1).first.map(String.init) ?? href
        let withoutQuery = withoutFragment.split(separator: "?", maxSplits: 1).first.map(String.init) ?? withoutFragment
        return withoutQuery.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private func plainText(fromHTML html: String) -> String {
        var text = html
            .replacingOccurrences(of: "(?is)<script[^>]*>.*?</script>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "(?is)<style[^>]*>.*?</style>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "(?i)<br\\s*/?>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "(?i)</p\\s*>", with: "\n\n", options: .regularExpression)
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)

        let entities = [
            "&nbsp;": " ",
            "&amp;": "&",
            "&quot;": "\"",
            "&#34;": "\"",
            "&#39;": "'",
            "&apos;": "'",
            "&lt;": "<",
            "&gt;": ">",
        ]

        for (entity, replacement) in entities {
            text = text.replacingOccurrences(of: entity, with: replacement)
        }

        return text
            .replacingOccurrences(of: "[ \\t]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\n[ \\t]+", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "\\n{3,}", with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func navigate(to link: ReadiumShared.Link) {
        navigationRequest = EPUBNavigationRequest(target: .link(link))
    }

    private func navigate(to locator: Locator) {
        navigationRequest = EPUBNavigationRequest(target: .locator(locator))
    }

    // MARK: - Position Save/Restore

    private func restoreLocator() -> Locator? {
        guard let json = book.locatorJSON else { return nil }
        // Locator is NOT Codable — uses custom jsonString init
        return try? Locator(jsonString: json)
    }

    private func saveProgress(_ locator: Locator) {
        let progress = locator.locations.totalProgression ?? 0
        // Locator is NOT Codable — uses custom jsonString property
        let locatorJSON = locator.jsonString
        appState.library.updateProgress(
            bookId: book.id,
            progress: progress,
            locatorJSON: locatorJSON
        )
    }

    private func updateChapterTitle(from locator: Locator) {
        // Find the matching TOC entry
        let href = locator.href.string.split(separator: "#").first.map(String.init) ?? locator.href.string
        currentChapterTitle = findTocTitle(in: publication.manifest.tableOfContents, matching: normalizedHref(href))
    }

    private func findTocTitle(in links: [ReadiumShared.Link], matching href: String) -> String? {
        for link in links {
            // Link.href is String in Readium 3.7 (not a URL type)
            let linkHref = link.href.split(separator: "#").first.map(String.init) ?? link.href
            let normalizedLinkHref = normalizedHref(linkHref)
            if normalizedLinkHref == href
                || normalizedLinkHref.hasSuffix("/\(href)")
                || href.hasSuffix("/\(normalizedLinkHref)") {
                return link.title
            }
            if let childTitle = findTocTitle(in: link.children, matching: href) {
                return childTitle
            }
        }
        return nil
    }
}
