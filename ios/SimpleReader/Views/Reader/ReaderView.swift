import SwiftUI
import ReadiumShared
import ReadiumNavigator

/// Full-screen EPUB reader with toolbar, text selection popup, and overlays.
/// Ports BookReader.tsx: reader + toolbar + simplifier + chapter nav + search + settings.
struct ReaderView: View {
    @Environment(AppState.self) private var appState
    let book: RecentBook
    let publication: Publication

    @State private var showToolbar = false
    @State private var preferences: ReadingPreferences

    // Text selection / AI popup state
    @State private var selectedText: String?
    @State private var selectionMode: SimplifyMode = .explain
    @State private var showSelectionPopup = false

    // Panel states
    @State private var showTableOfContents = false
    @State private var showSearch = false
    @State private var showSettings = false
    @State private var showChat = false

    // Chat state
    @State private var conversation: ConversationContext?

    // Current reading position
    @State private var currentLocator: Locator?
    @State private var currentChapterTitle: String?

    init(book: RecentBook, publication: Publication) {
        self.book = book
        self.publication = publication
        self._preferences = State(initialValue: ReadingPreferences())
    }

    var body: some View {
        ZStack {
            // EPUB Navigator (full screen)
            EPUBNavigatorWrapper(
                publication: publication,
                initialLocator: restoreLocator(),
                preferences: preferences,
                httpServer: appState.readiumService.httpServer,
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
                    withAnimation(.easeInOut(duration: 0.2)) {
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
                        onBack: { appState.closeReader() },
                        onTOC: { showTableOfContents = true },
                        onSearch: { showSearch = true },
                        onSettings: { showSettings = true }
                    )
                    Spacer()

                    // Bottom page indicator (Apple Books style)
                    if let progress = currentLocator?.locations.totalProgression {
                        Text("\(Int(progress * 100))%")
                            .font(.caption)
                            .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                            .frame(maxWidth: .infinity)
                            .padding(.bottom, DesignSystem.Spacing.sm)
                    }
                }
                .transition(.opacity)
            }
        }
        .statusBarHidden(!showToolbar)
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
                        conversation = ConversationContext(
                            originalText: originalText,
                            messages: messages,
                            chapterText: nil, // Will be extracted when chat opens
                            bookText: nil,
                            chapterTitle: currentChapterTitle
                        )
                        showSelectionPopup = false
                        selectedText = nil
                        showChat = true
                    }
                )
            }
        }
        // Table of contents
        .sheet(isPresented: $showTableOfContents) {
            TableOfContentsView(
                toc: publication.manifest.tableOfContents,
                currentHref: currentLocator?.href.string,
                onNavigate: { _ in
                    // Navigation handled via coordinator
                    showTableOfContents = false
                }
            )
            .presentationDetents([.large])
        }
        // Search
        .sheet(isPresented: $showSearch) {
            SearchPanelView(publication: publication)
                .presentationDetents([.large])
        }
        // Settings
        .sheet(isPresented: $showSettings) {
            TypographySettingsView(preferences: preferences)
                .presentationDetents([.medium])
        }
        // Chat panel
        .sheet(isPresented: $showChat) {
            if let conversation = conversation {
                ChatPanelView(
                    conversation: conversation,
                    apiClient: appState.apiClient,
                    onClose: { showChat = false }
                )
                .presentationDetents([.large])
            }
        }
        .preferredColorScheme(preferences.colorSchemeOverride)
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
        currentChapterTitle = findTocTitle(in: publication.manifest.tableOfContents, matching: href)
    }

    private func findTocTitle(in links: [ReadiumShared.Link], matching href: String) -> String? {
        for link in links {
            // Link.href is String in Readium 3.7 (not a URL type)
            let linkHref = link.href.split(separator: "#").first.map(String.init) ?? link.href
            if linkHref == href {
                return link.title
            }
            if let childTitle = findTocTitle(in: link.children, matching: href) {
                return childTitle
            }
        }
        return nil
    }
}
