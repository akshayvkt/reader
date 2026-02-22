import Foundation

/// A single message in a conversation — mirrors types/chat.ts
struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date

    enum MessageRole: String, Codable {
        case user
        case assistant
    }

    init(role: MessageRole, content: String) {
        self.id = UUID()
        self.role = role
        self.content = content
        self.timestamp = Date()
    }
}

/// Which level of context to send with AI requests
enum ContextScope: String, Codable {
    case highlight
    case chapter
    case book
}

/// The mode for the /api/simplify endpoint
enum SimplifyMode: String, Codable {
    case explain
    case eli5
    case followup
}
