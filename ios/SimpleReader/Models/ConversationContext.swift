import Foundation

/// Holds the full state of a chat conversation — mirrors ChatContext.tsx
@Observable
class ConversationContext {
    enum Source: String, Codable {
        case selection
        case reader
    }

    var source: Source
    var originalText: String?
    var chapterText: String?
    var bookText: String?
    var chapterTitle: String?
    var messages: [ChatMessage]
    var scope: ContextScope

    init(
        source: Source = .selection,
        originalText: String? = nil,
        messages: [ChatMessage] = [],
        scope: ContextScope = .highlight,
        chapterText: String? = nil,
        bookText: String? = nil,
        chapterTitle: String? = nil
    ) {
        self.source = source
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
