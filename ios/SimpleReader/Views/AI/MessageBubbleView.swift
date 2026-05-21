import SwiftUI

/// Single message bubble — user messages right-aligned, assistant left-aligned.
/// Ports the message rendering from ChatPanel.tsx.
struct MessageBubbleView: View {
    let message: ChatMessage

    var body: some View {
        switch message.role {
        case .user:
            userMessage
        case .assistant:
            assistantMessage
        }
    }

    private var userMessage: some View {
        HStack {
            Spacer(minLength: 72)

            VStack(alignment: .trailing, spacing: 4) {
                Text("You")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

                MarkdownMessageView(content: message.content)
                    .padding(.horizontal, DesignSystem.Spacing.md)
                    .padding(.vertical, DesignSystem.Spacing.sm)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    private var assistantMessage: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text("Reader")
                .font(.caption2.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

            MarkdownMessageView(content: message.content)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
