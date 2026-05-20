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
        NavigationStack {
            VStack(spacing: 0) {
                // Scope selector
                ScopeSelectorView(
                    selectedScope: $conversation.scope,
                    hasHighlightContext: hasHighlight,
                    hasChapterContext: conversation.chapterText != nil,
                    hasBookContext: conversation.bookText != nil
                )
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .padding(.vertical, DesignSystem.Spacing.md)

                Divider()

                // Messages
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

                            // Message list
                            ForEach(conversation.messages) { message in
                                MessageBubbleView(message: message)
                                    .id(message.id)
                            }

                            // Thinking indicator
                            if isSending {
                                HStack(spacing: 4) {
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
                    }
                    .onChange(of: conversation.messages.count) { _, _ in
                        if let lastId = conversation.messages.last?.id {
                            withAnimation {
                                proxy.scrollTo(lastId, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()

                // Input bar
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
                .padding(DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
            }
            .background(DesignSystem.Colors.background)
            .navigationTitle("Chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onClose() }
                        .foregroundStyle(DesignSystem.Colors.accent)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isInputFocused = true
            }
        }
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
