import SwiftUI
import UniformTypeIdentifiers

/// Main home screen with recent books library.
/// Ports page.tsx home section: hero card, recent grid, add button, empty state.
struct LibraryView: View {
    @Environment(AppState.self) private var appState
    @State private var showFilePicker = false
    @State private var importError: String?

    private let columns = [
        GridItem(.adaptive(minimum: 110, maximum: 130), spacing: DesignSystem.Spacing.lg)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xxl) {
                    if appState.library.books.isEmpty {
                        emptyState
                    } else {
                        booksContent
                    }
                }
                .padding(.horizontal, DesignSystem.Spacing.xl)
                .padding(.top, DesignSystem.Spacing.md)
            }
            .background(DesignSystem.Colors.background)
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text("Reader")
                        .font(DesignSystem.Fonts.heading)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showFilePicker = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                            Text("Add Book")
                        }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(DesignSystem.Colors.accent)
                    }
                }
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: [UTType(filenameExtension: "epub") ?? .data],
                allowsMultipleSelection: false
            ) { result in
                handleFileImport(result)
            }
            .alert("Import Error", isPresented: .init(
                get: { importError != nil },
                set: { if !$0 { importError = nil } }
            )) {
                Button("OK") { importError = nil }
            } message: {
                Text(importError ?? "")
            }
            .alert("Open Book Error", isPresented: .init(
                get: { appState.readerError != nil },
                set: { if !$0 { appState.readerError = nil } }
            )) {
                Button("OK") { appState.readerError = nil }
            } message: {
                Text(appState.readerError ?? "")
            }
        }
    }

    // MARK: - Books Content

    @ViewBuilder
    private var booksContent: some View {
        // Hero card for most recent book
        if let mostRecent = appState.library.mostRecent {
            HeroBookCard(book: mostRecent) {
                appState.openBook(mostRecent)
            }
        }

        // Recent books grid
        if !appState.library.recentBooks.isEmpty {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                Text("Recent")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                    .textCase(.uppercase)
                    .tracking(0.5)

                LazyVGrid(columns: columns, spacing: DesignSystem.Spacing.xl) {
                    ForEach(appState.library.recentBooks) { book in
                        RecentBookCard(book: book) {
                            appState.openBook(book)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Spacer().frame(height: 100)

            Image(systemName: "book.pages")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(DesignSystem.Colors.accent)
                .frame(width: 80, height: 80)
                .background(DesignSystem.Colors.accentSubtle)
                .cornerRadius(DesignSystem.CornerRadius.large)

            Text("Add your book")
                .font(DesignSystem.Fonts.heading)
                .foregroundStyle(DesignSystem.Colors.foreground)

            Text("EPUB files")
                .font(.subheadline)
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)

            Button {
                showFilePicker = true
            } label: {
                Text("Browse Files")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.accent)
                    .padding(.horizontal, DesignSystem.Spacing.xxl)
                    .padding(.vertical, DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.accentSubtle)
                    .cornerRadius(DesignSystem.CornerRadius.medium)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - File Import

    private func handleFileImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            Task {
                do {
                    let book = try await BookImporter.importBook(
                        from: url,
                        using: appState.readiumService
                    )
                    await MainActor.run {
                        appState.library.addBook(book)
                        appState.openBook(book)
                    }
                } catch {
                    await MainActor.run {
                        importError = error.localizedDescription
                    }
                }
            }
        case .failure(let error):
            importError = error.localizedDescription
        }
    }
}
