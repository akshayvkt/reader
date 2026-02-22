import SwiftUI

/// Single message bubble — user messages right-aligned, assistant left-aligned.
/// Ports the message rendering from ChatPanel.tsx.
struct MessageBubbleView: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.role == .user ? "You" : "Reader")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

                Text(markdownToAttributed(message.content))
                    .font(.subheadline)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .padding(.horizontal, DesignSystem.Spacing.md)
                    .padding(.vertical, DesignSystem.Spacing.sm)
                    .background(
                        message.role == .user
                            ? DesignSystem.Colors.backgroundMuted
                            : Color.clear
                    )
                    .cornerRadius(DesignSystem.CornerRadius.medium)
            }

            if message.role == .assistant {
                Spacer(minLength: 60)
            }
        }
    }

    private func markdownToAttributed(_ string: String) -> AttributedString {
        (try? AttributedString(markdown: string, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(string)
    }
}
