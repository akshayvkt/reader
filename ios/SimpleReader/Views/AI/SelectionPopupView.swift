import SwiftUI

/// Floating popup near text selection showing AI explanation.
/// Ports Simplifier.tsx: Explain/ELI5 buttons → response → follow-up input → expand.
///
/// Flow:
/// 1. User selects text → taps "Explain" or "ELI5" from edit menu
/// 2. This popup appears with the response (or dictionary definition for single words)
/// 3. User can ask follow-up questions inline
/// 4. User can expand to full ChatPanel
struct SelectionPopupView: View {
    let text: String
    let mode: SimplifyMode
    let apiClient: APIClient
    let onClose: () -> Void
    let onExpand: (String, [ChatMessage]) -> Void

    @State private var response: String?
    @State private var isLoading = true
    @State private var messages: [ChatMessage] = []
    @State private var followUpInput = ""
    @State private var isSendingFollowUp = false
    @State private var isTextExpanded = false

    private let textTruncateLength = 100

    var body: some View {
        ZStack {
            // Dimmed backdrop
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            // Popup card
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                // Header with expand button
                if response != nil {
                    HStack {
                        Spacer()
                        Button {
                            onExpand(text, messages)
                        } label: {
                            Image(systemName: "arrow.up.left.and.arrow.down.right")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                                .padding(6)
                                .background(DesignSystem.Colors.backgroundMuted)
                                .cornerRadius(4)
                        }
                    }
                }

                // Selected text (truncated)
                if response != nil {
                    selectedTextView
                }

                // Content
                if isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                            .padding(.vertical, DesignSystem.Spacing.xl)
                        Spacer()
                    }
                } else if let response = response {
                    messagesView
                } else {
                    Text("Failed to get explanation. Please try again.")
                        .font(.subheadline)
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                }

                // Follow-up input
                if response != nil {
                    followUpInputView
                }
            }
            .padding(DesignSystem.Spacing.lg)
            .background(DesignSystem.Colors.surface)
            .cornerRadius(DesignSystem.CornerRadius.medium)
            .shadow(color: .black.opacity(0.15), radius: 20, x: 0, y: 8)
            .padding(.horizontal, DesignSystem.Spacing.xl)
            .frame(maxWidth: 400)
        }
        .task {
            await fetchExplanation()
        }
    }

    // MARK: - Selected Text

    private var selectedTextView: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                Rectangle()
                    .fill(DesignSystem.Colors.accent)
                    .frame(width: 2)

                VStack(alignment: .leading) {
                    Text(displayText)
                        .font(.subheadline)
                        .italic()
                        .foregroundStyle(DesignSystem.Colors.foregroundMuted)

                    if text.count > textTruncateLength {
                        Button(isTextExpanded ? "see less" : "see more") {
                            isTextExpanded.toggle()
                        }
                        .font(.caption)
                        .foregroundStyle(DesignSystem.Colors.accent)
                    }
                }
            }
        }
    }

    private var displayText: String {
        if isTextExpanded || text.count <= textTruncateLength {
            return text
        }
        return String(text.prefix(textTruncateLength)) + "..."
    }

    // MARK: - Messages

    @ViewBuilder
    private var messagesView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                    if index > 0 {
                        Text(message.role == .user ? "You:" : "Reader:")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                    }

                    Text(markdownToAttributed(message.content))
                        .font(.subheadline)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }

                if isSendingFollowUp {
                    HStack(spacing: 4) {
                        ProgressView()
                            .scaleEffect(0.7)
                        Text("Thinking...")
                            .font(.caption)
                            .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                    }
                }
            }
        }
        .frame(maxHeight: 300)
    }

    // MARK: - Follow-up Input

    private var followUpInputView: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            TextField("Ask a follow-up...", text: $followUpInput)
                .font(.subheadline)
                .textFieldStyle(.plain)
                .disabled(isSendingFollowUp)
                .onSubmit { sendFollowUp() }

            Button(action: sendFollowUp) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title3)
                    .foregroundStyle(followUpInput.isEmpty
                                    ? DesignSystem.Colors.foregroundSubtle
                                    : DesignSystem.Colors.accent)
            }
            .disabled(followUpInput.isEmpty || isSendingFollowUp)
        }
        .padding(DesignSystem.Spacing.sm)
        .background(DesignSystem.Colors.backgroundMuted)
        .cornerRadius(DesignSystem.CornerRadius.small)
    }

    // MARK: - API Calls

    private func fetchExplanation() async {
        isLoading = true

        // Single-word explain mode: try dictionary first (matches Simplifier.tsx)
        if mode == .explain && !text.contains(" ") {
            if let definition = await apiClient.lookupWord(text) {
                response = definition
                messages = [ChatMessage(role: .assistant, content: definition)]
                isLoading = false
                return
            }
        }

        // Call AI
        do {
            let result = try await apiClient.simplify(text: text, mode: mode)
            response = result
            messages = [ChatMessage(role: .assistant, content: result)]
        } catch {
            response = nil
        }

        isLoading = false
    }

    private func sendFollowUp() {
        let question = followUpInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isSendingFollowUp else { return }

        messages.append(ChatMessage(role: .user, content: question))
        followUpInput = ""
        isSendingFollowUp = true

        Task {
            do {
                let result = try await apiClient.followUp(
                    text: question,
                    originalText: text,
                    conversationHistory: messages
                )
                messages.append(ChatMessage(role: .assistant, content: result))
            } catch {
                messages.append(ChatMessage(role: .assistant, content: "Failed to get response. Please try again."))
            }
            isSendingFollowUp = false
        }
    }

    // MARK: - Markdown Helper

    private func markdownToAttributed(_ string: String) -> AttributedString {
        (try? AttributedString(markdown: string, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(string)
    }
}
