import Foundation

/// Holds the full state of a chat conversation — mirrors ChatContext.tsx
@Observable
class ConversationContext {
    var originalText: String
    var chapterText: String?
    var bookText: String?
    var chapterTitle: String?
    var messages: [ChatMessage]
    var scope: ContextScope

    init(
        originalText: String,
        messages: [ChatMessage] = [],
        scope: ContextScope = .highlight,
        chapterText: String? = nil,
        bookText: String? = nil,
        chapterTitle: String? = nil
    ) {
        self.originalText = originalText
        self.messages = messages
        self.scope = scope
        self.chapterText = chapterText
        self.bookText = bookText
        self.chapterTitle = chapterTitle
    }

    func addMessage(role: ChatMessage.MessageRole, content: String) {
        let message = ChatMessage(role: role, content: content)
        messages.append(message)
    }
}
