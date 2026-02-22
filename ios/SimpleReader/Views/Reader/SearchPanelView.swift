import SwiftUI
import ReadiumShared

/// Full-text search panel.
/// Ports BookReader.tsx search: debounced input, results with chapter + excerpt, navigation.
struct SearchPanelView: View {
    let publication: Publication

    @State private var query = ""
    @State private var results: [SearchResultItem] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    @Environment(\.dismiss) private var dismiss

    struct SearchResultItem: Identifiable {
        let id = UUID()
        let locator: Locator
        let chapterTitle: String?
        let excerpt: String
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search input
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

                    TextField("Search in book...", text: $query)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()

                    if !query.isEmpty {
                        Button {
                            query = ""
                            results = []
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                        }
                    }
                }
                .padding(DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                .cornerRadius(DesignSystem.CornerRadius.small)
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .padding(.top, DesignSystem.Spacing.md)

                // Results
                if isSearching {
                    Spacer()
                    ProgressView("Searching...")
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                    Spacer()
                } else if results.isEmpty && query.count >= 3 {
                    Spacer()
                    Text("No results found")
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(results) { result in
                                Button {
                                    // TODO: Navigate to result via coordinator
                                    dismiss()
                                } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        if let chapter = result.chapterTitle {
                                            Text(chapter)
                                                .font(.caption.weight(.medium))
                                                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                                        }
                                        Text(result.excerpt)
                                            .font(.subheadline)
                                            .foregroundStyle(DesignSystem.Colors.foreground)
                                            .lineLimit(3)
                                    }
                                    .padding(.horizontal, DesignSystem.Spacing.lg)
                                    .padding(.vertical, DesignSystem.Spacing.md)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                                .buttonStyle(.plain)

                                Divider()
                                    .padding(.leading, DesignSystem.Spacing.lg)
                            }
                        }
                    }
                }
            }
            .background(DesignSystem.Colors.background)
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(DesignSystem.Colors.accent)
                }
            }
            .onChange(of: query) { _, newValue in
                debounceSearch(query: newValue)
            }
        }
    }

    // MARK: - Search

    private func debounceSearch(query: String) {
        searchTask?.cancel()

        guard query.count >= 3 else {
            results = []
            return
        }

        searchTask = Task {
            // 300ms debounce
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }

            await performSearch(query: query)
        }
    }

    @MainActor
    private func performSearch(query: String) async {
        isSearching = true
        defer { isSearching = false }

        do {
            let iterator = try await publication.search(query: query).get()
            var allResults: [SearchResultItem] = []

            while let collection = try await iterator.next() {
                for locator in collection.locators {
                    let excerpt = [
                        locator.text.before,
                        locator.text.highlight,
                        locator.text.after
                    ].compactMap { $0 }.joined()

                    allResults.append(SearchResultItem(
                        locator: locator,
                        chapterTitle: locator.title,
                        excerpt: excerpt.isEmpty ? (locator.text.highlight ?? "") : excerpt
                    ))

                    if allResults.count >= 50 { break }
                }
                if allResults.count >= 50 { break }
            }

            results = allResults
        } catch {
            results = []
        }
    }
}
