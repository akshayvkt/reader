import Foundation

enum VoiceSessionPhase: Equatable {
    case idle
    case preparing
    case connecting
    case listening
    case speaking
    case error(String)

    var label: String {
        switch self {
        case .idle:
            return "Voice"
        case .preparing:
            return "Preparing"
        case .connecting:
            return "Connecting"
        case .listening:
            return "Listening"
        case .speaking:
            return "Speaking"
        case .error:
            return "Voice unavailable"
        }
    }
}

enum VoiceTranscriptRole: String, Codable {
    case user
    case assistant
}

struct VoiceTranscriptEntry: Identifiable, Equatable {
    let id = UUID()
    var role: VoiceTranscriptRole
    var text: String
    var timestamp = Date()
}

struct VoiceSessionContext: Encodable {
    var bookTitle: String
    var chapterTitle: String
    var scope: ContextScope
    var scopeContext: String?

    enum CodingKeys: String, CodingKey {
        case type
        case bookTitle
        case chapterTitle
        case scope
        case scopeContext
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode("setup", forKey: .type)
        try container.encode(bookTitle, forKey: .bookTitle)
        try container.encode(chapterTitle, forKey: .chapterTitle)
        try container.encode(scope.rawValue, forKey: .scope)
        try container.encodeIfPresent(scopeContext, forKey: .scopeContext)
    }
}
