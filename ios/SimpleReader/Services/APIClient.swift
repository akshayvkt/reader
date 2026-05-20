import Foundation

/// Networking layer for the AI simplification backend and dictionary API.
/// Ports the API calls from Simplifier.tsx and ChatPanel.tsx.
///
/// All requests go to the existing Render backend.
@Observable
class APIClient {
    private let baseURL = URL(string: "https://reader-g6kh.onrender.com")!

    var isLoading = false

    // MARK: - Simplify (Explain / ELI5)

    /// Initial text simplification — matches Simplifier.tsx simplifyText()
    /// POST /api/simplify with {text, mode}
    func simplify(text: String, mode: SimplifyMode) async throws -> String {
        let body: [String: Any] = [
            "text": text,
            "mode": mode.rawValue,
        ]
        return try await postSimplify(body: body)
    }

    // MARK: - Follow-up

    /// Follow-up question — matches ChatPanel.tsx sendMessage()
    /// POST /api/simplify with full conversation context
    func followUp(
        text: String,
        originalText: String?,
        conversationHistory: [ChatMessage],
        scope: ContextScope? = nil,
        scopeContext: String? = nil,
        chapterTitle: String? = nil
    ) async throws -> String {
        var body: [String: Any] = [
            "text": text,
            "mode": SimplifyMode.followup.rawValue,
            "conversationHistory": conversationHistory.map { msg in
                ["role": msg.role.rawValue, "content": msg.content]
            },
        ]

        if let originalText, !originalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            body["originalText"] = originalText
        }
        if let scope = scope {
            body["scope"] = scope.rawValue
        }
        if let context = scopeContext {
            body["scopeContext"] = context
        }
        if let title = chapterTitle {
            body["chapterTitle"] = title
        }

        return try await postSimplify(body: body)
    }

    // MARK: - Dictionary Lookup

    /// Dictionary API for single words — matches Simplifier.tsx fetchDictionaryDefinition()
    /// Returns formatted definition or nil if word not found.
    func lookupWord(_ word: String) async -> String? {
        let urlString = "https://api.dictionaryapi.dev/api/v2/entries/en/\(word.lowercased())"
        guard let url = URL(string: urlString) else { return nil }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return nil
            }

            // Parse the dictionary API response
            guard let entries = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                  let firstEntry = entries.first,
                  let meanings = firstEntry["meanings"] as? [[String: Any]] else {
                return nil
            }

            // Format up to 2 meanings (same as web app)
            var definitions: [String] = []
            for meaning in meanings.prefix(2) {
                guard let partOfSpeech = meaning["partOfSpeech"] as? String,
                      let defs = meaning["definitions"] as? [[String: Any]],
                      let firstDef = defs.first,
                      let definition = firstDef["definition"] as? String else {
                    continue
                }
                definitions.append("\(partOfSpeech): \(definition)")
            }

            return definitions.isEmpty ? nil : definitions.joined(separator: "; ")
        } catch {
            return nil
        }
    }

    // MARK: - Private

    private func postSimplify(body: [String: Any]) async throws -> String {
        let url = baseURL.appendingPathComponent("api/simplify")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let simplified = json["simplified"] as? String else {
            throw APIError.parseError
        }

        return simplified
    }

    enum APIError: LocalizedError {
        case invalidResponse
        case serverError(statusCode: Int)
        case parseError

        var errorDescription: String? {
            switch self {
            case .invalidResponse:
                return "Invalid response from server"
            case .serverError(let code):
                return "Server error (\(code))"
            case .parseError:
                return "Failed to parse response"
            }
        }
    }
}
