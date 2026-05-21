import SwiftUI

struct MarkdownMessageView: View {
    let content: String

    private var blocks: [MarkdownBlock] {
        MarkdownBlockParser.parse(content)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            ForEach(blocks) { block in
                blockView(block)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block.kind {
        case .paragraph(let text):
            Text(inlineMarkdown(text))
                .font(.subheadline)
                .foregroundStyle(DesignSystem.Colors.foreground)
                .textSelection(.enabled)

        case .heading(let level, let text):
            Text(inlineMarkdown(text))
                .font(headingFont(for: level))
                .foregroundStyle(DesignSystem.Colors.foreground)
                .padding(.top, level <= 2 ? DesignSystem.Spacing.sm : DesignSystem.Spacing.xs)
                .textSelection(.enabled)

        case .unorderedList(let items):
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                        Text("•")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(DesignSystem.Colors.foreground)
                        Text(inlineMarkdown(item))
                            .font(.subheadline)
                            .foregroundStyle(DesignSystem.Colors.foreground)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }

        case .orderedList(let items):
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: DesignSystem.Spacing.sm) {
                        Text("\(item.number).")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(DesignSystem.Colors.foreground)
                            .frame(minWidth: 22, alignment: .trailing)
                        Text(inlineMarkdown(item.text))
                            .font(.subheadline)
                            .foregroundStyle(DesignSystem.Colors.foreground)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }

        case .code(let text):
            ScrollView(.horizontal, showsIndicators: false) {
                Text(text)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .padding(DesignSystem.Spacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .background(DesignSystem.Colors.backgroundMuted, in: RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.small, style: .continuous))
        }
    }

    private func headingFont(for level: Int) -> Font {
        switch level {
        case 1:
            return .headline.weight(.bold)
        case 2:
            return .subheadline.weight(.bold)
        default:
            return .subheadline.weight(.semibold)
        }
    }

    private func inlineMarkdown(_ string: String) -> AttributedString {
        (try? AttributedString(
            markdown: string,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(string)
    }
}

private struct MarkdownBlock: Identifiable {
    struct OrderedItem {
        let number: Int
        let text: String
    }

    enum Kind {
        case paragraph(String)
        case heading(level: Int, text: String)
        case unorderedList([String])
        case orderedList([OrderedItem])
        case code(String)
    }

    let id = UUID()
    let kind: Kind
}

private enum MarkdownBlockParser {
    static func parse(_ raw: String) -> [MarkdownBlock] {
        let lines = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .components(separatedBy: "\n")

        var blocks: [MarkdownBlock] = []
        var index = 0

        while index < lines.count {
            let line = lines[index]

            if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                index += 1
                continue
            }

            if isFence(line) {
                let code = collectFencedCode(from: lines, index: &index)
                appendCode(code, to: &blocks)
                continue
            }

            if isIndentedCode(line) {
                let code = collectIndentedCode(from: lines, index: &index)
                appendCode(code, to: &blocks)
                continue
            }

            if let heading = heading(from: line) {
                blocks.append(MarkdownBlock(kind: .heading(level: heading.level, text: heading.text)))
                index += 1
                continue
            }

            if unorderedBulletText(from: line) != nil {
                let items = collectUnorderedList(from: lines, index: &index)
                blocks.append(MarkdownBlock(kind: .unorderedList(items)))
                continue
            }

            if orderedBullet(from: line) != nil {
                let items = collectOrderedList(from: lines, index: &index)
                blocks.append(MarkdownBlock(kind: .orderedList(items)))
                continue
            }

            let paragraph = collectParagraph(from: lines, index: &index)
            if !paragraph.isEmpty {
                blocks.append(MarkdownBlock(kind: .paragraph(paragraph)))
            }
        }

        return blocks
    }

    private static func appendCode(_ code: String, to blocks: inout [MarkdownBlock]) {
        let trimmed = code.trimmingCharacters(in: .newlines)
        guard !trimmed.isEmpty else { return }
        blocks.append(MarkdownBlock(kind: .code(trimmed)))
    }

    private static func collectFencedCode(from lines: [String], index: inout Int) -> String {
        index += 1
        var codeLines: [String] = []

        while index < lines.count {
            let line = lines[index]
            if isFence(line) {
                index += 1
                break
            }
            codeLines.append(line)
            index += 1
        }

        return codeLines.joined(separator: "\n")
    }

    private static func collectIndentedCode(from lines: [String], index: inout Int) -> String {
        var codeLines: [String] = []

        while index < lines.count {
            let line = lines[index]
            if line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                codeLines.append("")
                index += 1
                continue
            }
            guard isIndentedCode(line) else { break }
            let indentation = line.hasPrefix("\t") ? 1 : min(4, line.count)
            codeLines.append(String(line.dropFirst(indentation)))
            index += 1
        }

        return codeLines.joined(separator: "\n")
    }

    private static func collectUnorderedList(from lines: [String], index: inout Int) -> [String] {
        var items: [String] = []

        while index < lines.count {
            guard let item = unorderedBulletText(from: lines[index]) else { break }
            items.append(item)
            index += 1
        }

        return items
    }

    private static func collectOrderedList(from lines: [String], index: inout Int) -> [MarkdownBlock.OrderedItem] {
        var items: [MarkdownBlock.OrderedItem] = []

        while index < lines.count {
            guard let item = orderedBullet(from: lines[index]) else { break }
            items.append(item)
            index += 1
        }

        return items
    }

    private static func collectParagraph(from lines: [String], index: inout Int) -> String {
        var paragraphLines: [String] = []

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)

            if trimmed.isEmpty ||
                isFence(line) ||
                isIndentedCode(line) ||
                heading(from: line) != nil ||
                unorderedBulletText(from: line) != nil ||
                orderedBullet(from: line) != nil {
                break
            }

            paragraphLines.append(trimmed)
            index += 1
        }

        return paragraphLines.joined(separator: " ")
    }

    private static func isFence(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespaces).hasPrefix("```")
    }

    private static func isIndentedCode(_ line: String) -> Bool {
        line.hasPrefix("    ") || line.hasPrefix("\t")
    }

    private static func heading(from line: String) -> (level: Int, text: String)? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let level = trimmed.prefix { $0 == "#" }.count
        guard (1...6).contains(level) else { return nil }

        let start = trimmed.index(trimmed.startIndex, offsetBy: level)
        guard start < trimmed.endIndex, trimmed[start].isWhitespace else { return nil }

        let textStart = trimmed.index(after: start)
        let text = String(trimmed[textStart...]).trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : (level, text)
    }

    private static func unorderedBulletText(from line: String) -> String? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let prefixes = ["- ", "* ", "• "]

        for prefix in prefixes where trimmed.hasPrefix(prefix) {
            let text = String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespaces)
            return text.isEmpty ? nil : text
        }

        return nil
    }

    private static func orderedBullet(from line: String) -> MarkdownBlock.OrderedItem? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard let dotIndex = trimmed.firstIndex(of: ".") else { return nil }

        let numberText = String(trimmed[..<dotIndex])
        guard let number = Int(numberText) else { return nil }

        let afterDot = trimmed.index(after: dotIndex)
        guard afterDot < trimmed.endIndex, trimmed[afterDot].isWhitespace else { return nil }

        let textStart = trimmed.index(after: afterDot)
        let text = String(trimmed[textStart...]).trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : MarkdownBlock.OrderedItem(number: number, text: text)
    }
}
