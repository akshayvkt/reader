import SwiftUI
import UniformTypeIdentifiers

/// Main home screen with recent books library.
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
                .padding(.top, DesignSystem.Spacing.sm)
                .padding(.bottom, DesignSystem.Spacing.xxxl)
            }
            .background(DesignSystem.Colors.background)
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showFilePicker = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(DesignSystem.Colors.foreground)
                    }
                    .accessibilityLabel("Add Book")
                }
            }
            .tint(DesignSystem.Colors.accent)
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
        if let mostRecent = appState.library.mostRecent {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                Text("Continue")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)

                HeroBookCard(book: mostRecent) {
                    appState.openBook(mostRecent)
                }
            }
        }

        if !appState.library.recentBooks.isEmpty {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                Text("Recent Books")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)

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
        VStack(spacing: DesignSystem.Spacing.md) {
            Spacer().frame(height: 180)

            Image(systemName: "books.vertical.fill")
                .font(.system(size: 52, weight: .regular))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(DesignSystem.Colors.accent)
                .frame(width: 92, height: 92)

            Text("No Books")
                .font(.title2.weight(.semibold))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .padding(.top, DesignSystem.Spacing.sm)

            Text("EPUB files")
                .font(.body)
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)

            Button {
                showFilePicker = true
            } label: {
                Label("Add Book", systemImage: "plus")
                    .font(.headline)
                    .padding(.horizontal, DesignSystem.Spacing.xl)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .tint(DesignSystem.Colors.accent)
            .padding(.top, DesignSystem.Spacing.sm)

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
