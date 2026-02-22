import SwiftUI
import ReadiumShared

/// Slide-in table of contents sidebar.
/// Ports ChapterNav.tsx: recursive chapter rendering, current highlighted, navigation.
struct TableOfContentsView: View {
    let toc: [Link]
    let currentHref: String?
    let onNavigate: (Link) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(toc.enumerated()), id: \.offset) { index, link in
                        TocItemRow(
                            link: link,
                            currentHref: currentHref,
                            depth: 0,
                            onNavigate: { link in
                                onNavigate(link)
                                dismiss()
                            }
                        )
                    }
                }
                .padding(.vertical, DesignSystem.Spacing.sm)
            }
            .background(DesignSystem.Colors.background)
            .navigationTitle("Contents")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(DesignSystem.Colors.accent)
                }
            }
        }
    }
}

// MARK: - Recursive TOC Item Row

private struct TocItemRow: View {
    let link: Link
    let currentHref: String?
    let depth: Int
    let onNavigate: (Link) -> Void

    private var isCurrent: Bool {
        guard let currentHref = currentHref else { return false }
        let linkHref = link.href.string.split(separator: "#").first.map(String.init) ?? link.href.string
        let currentBase = currentHref.split(separator: "#").first.map(String.init) ?? currentHref
        return linkHref == currentBase
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                onNavigate(link)
            } label: {
                HStack {
                    if isCurrent {
                        Rectangle()
                            .fill(DesignSystem.Colors.accent)
                            .frame(width: 3)
                            .padding(.vertical, 4)
                    }

                    Text(link.title ?? "Untitled")
                        .font(depth == 0
                              ? .system(size: 15, weight: .medium)
                              : .system(size: 14, weight: .regular))
                        .foregroundStyle(isCurrent
                                         ? DesignSystem.Colors.accent
                                         : DesignSystem.Colors.foreground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, CGFloat(depth) * 16 + (isCurrent ? 0 : 3))
                        .padding(.vertical, DesignSystem.Spacing.md)
                        .padding(.horizontal, DesignSystem.Spacing.xl)
                }
                .background(isCurrent ? DesignSystem.Colors.accentSubtle : .clear)
            }
            .buttonStyle(.plain)

            // Render children recursively
            ForEach(Array(link.children.enumerated()), id: \.offset) { _, child in
                TocItemRow(
                    link: child,
                    currentHref: currentHref,
                    depth: depth + 1,
                    onNavigate: onNavigate
                )
            }
        }
    }
}
