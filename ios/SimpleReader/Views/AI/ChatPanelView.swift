import SwiftUI

/// Full chat panel with scope switching and conversation history.
/// Ports ChatPanel.tsx: scope pills, messages with markdown, input bar.
struct ChatPanelView: View {
    @Bindable var conversation: ConversationContext
    let apiClient: APIClient
    let onClose: () -> Void

    @State private var input = ""
    @State private var isSending = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            header

            ScopeSelectorView(
                selectedScope: $conversation.scope,
                hasHighlightContext: hasHighlight,
                hasChapterContext: conversation.chapterText != nil,
                hasBookContext: conversation.bookText != nil
            )
            .padding(.horizontal, DesignSystem.Spacing.lg)
            .padding(.top, DesignSystem.Spacing.xs)

            messagesView

            inputBar
        }
        .background {
            DesignSystem.Colors.background.opacity(0.88)
                .ignoresSafeArea()
        }
    }

    private var header: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Chat")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)

                Text(scopeStatusText)
                    .font(.caption)
                    .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                    .lineLimit(1)
            }

            Spacer()

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .frame(width: 32, height: 32)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close chat")
        }
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .padding(.top, DesignSystem.Spacing.md)
        .padding(.bottom, DesignSystem.Spacing.xs)
    }

    private var messagesView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.lg) {
                    if hasHighlight, let originalText = conversation.originalText {
                        HStack(alignment: .top) {
                            Rectangle()
                                .fill(DesignSystem.Colors.accent)
                                .frame(width: 2)
                            Text(originalText)
                                .font(.subheadline)
                                .italic()
                                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                        }
                        .padding(.bottom, DesignSystem.Spacing.sm)
                    }

                    if conversation.messages.isEmpty {
                        emptyState
                    }

                    ForEach(conversation.messages) { message in
                        MessageBubbleView(message: message)
                            .id(message.id)
                    }

                    if isSending {
                        HStack(spacing: DesignSystem.Spacing.xs) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Thinking...")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                        }
                        .id("thinking")
                    }
                }
                .padding(DesignSystem.Spacing.lg)
                .padding(.top, DesignSystem.Spacing.xs)
            }
            .onChange(of: conversation.messages.count) { _, _ in
                if let lastId = conversation.messages.last?.id {
                    withAnimation {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: activeScopeIsReady ? "message" : "hourglass")
                .font(.title2)
                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)

            Text(activeScopeIsReady ? "Ask about this \(scopeLabel)." : scopeStatusText)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 160)
    }

    private var inputBar: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            TextField(inputPlaceholder, text: $input, axis: .vertical)
                .font(.subheadline)
                .textFieldStyle(.plain)
                .lineLimit(1...4)
                .focused($isInputFocused)
                .disabled(isSending || !activeScopeIsReady)
                .onSubmit { sendMessage() }

            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                     ? DesignSystem.Colors.foregroundSubtle
                                     : DesignSystem.Colors.accent)
            }
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending || !activeScopeIsReady)
        }
        .padding(.horizontal, DesignSystem.Spacing.md)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .padding(.bottom, DesignSystem.Spacing.sm)
    }

    // MARK: - Send Message

    private var hasHighlight: Bool {
        !(conversation.originalText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var activeScopeIsReady: Bool {
        switch conversation.scope {
        case .highlight:
            return hasHighlight
        case .chapter:
            return conversation.chapterText != nil
        case .book:
            return conversation.bookText != nil
        }
    }

    private var inputPlaceholder: String {
        guard activeScopeIsReady else {
            switch conversation.scope {
            case .highlight: return "Loading highlight..."
            case .chapter: return "Loading chapter..."
            case .book: return "Loading book..."
            }
        }
        return hasHighlight ? "Ask about this text..." : "Ask a question..."
    }

    private var scopeLabel: String {
        switch conversation.scope {
        case .highlight: return "highlight"
        case .chapter: return "chapter"
        case .book: return "book"
        }
    }

    private var scopeStatusText: String {
        switch conversation.scope {
        case .highlight:
            return hasHighlight ? "Highlight" : "Loading highlight..."
        case .chapter:
            return conversation.chapterText == nil ? "Loading chapter..." : conversation.chapterTitle ?? "Current chapter"
        case .book:
            return conversation.bookText == nil ? "Loading book..." : "Whole book"
        }
    }

    private func sendMessage() {
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isSending, activeScopeIsReady else { return }

        let conversationHistory = conversation.messages
        conversation.addMessage(role: .user, content: question)
        input = ""
        isSending = true

        // Determine scope context (matches ChatPanel.tsx lines 119-143)
        let scopeContext: String? = {
            switch conversation.scope {
            case .highlight: return nil
            case .chapter: return conversation.chapterText
            case .book: return conversation.bookText
            }
        }()

        Task {
            do {
                let result = try await apiClient.followUp(
                    text: question,
                    originalText: conversation.originalText,
                    conversationHistory: conversationHistory,
                    scope: conversation.scope,
                    scopeContext: scopeContext,
                    chapterTitle: conversation.chapterTitle
                )
                conversation.addMessage(role: .assistant, content: result)
            } catch {
                conversation.addMessage(role: .assistant, content: "Failed to get response. Please try again.")
            }
            isSending = false
        }
    }
}
