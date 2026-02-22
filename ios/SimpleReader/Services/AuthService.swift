import Foundation

/// Manages authentication state — JWT token storage and user info.
/// Skipping Google Sign-In integration for now; provides manual token management.
///
/// Ports the auth logic from AuthContext.tsx (client-side JWT decode, no server verification).
@Observable
class AuthService {
    private static let tokenKey = "auth_token"

    var user: UserInfo?
    var token: String?
    var isLoading: Bool = true

    var isAuthenticated: Bool { user != nil && token != nil }

    struct UserInfo {
        let email: String
        let name: String
        let picture: String?
    }

    init() {
        restoreSession()
    }

    /// Check Keychain for existing token on app launch
    func restoreSession() {
        isLoading = true
        defer { isLoading = false }

        guard let storedToken = KeychainHelper.load(forKey: Self.tokenKey) else {
            return
        }

        if let decoded = decodeJWT(storedToken) {
            self.token = storedToken
            self.user = decoded
        } else {
            // Token expired or invalid — clear it
            KeychainHelper.delete(forKey: Self.tokenKey)
        }
    }

    /// Store a JWT token (called after OAuth flow completes)
    func setToken(_ jwt: String) {
        if let decoded = decodeJWT(jwt) {
            KeychainHelper.save(token: jwt, forKey: Self.tokenKey)
            self.token = jwt
            self.user = decoded
        }
    }

    /// Clear auth state
    func signOut() {
        KeychainHelper.delete(forKey: Self.tokenKey)
        token = nil
        user = nil
    }

    /// Client-side JWT decode — matches AuthContext.tsx decodeToken()
    /// Does NOT verify the signature (server verified at creation time).
    private func decodeJWT(_ token: String) -> UserInfo? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }

        // Decode the payload (part 1)
        var base64 = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        // Pad to multiple of 4
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        guard let payloadData = Data(base64Encoded: base64) else { return nil }

        struct JWTPayload: Decodable {
            let email: String
            let name: String
            let picture: String?
            let exp: TimeInterval
        }

        guard let payload = try? JSONDecoder().decode(JWTPayload.self, from: payloadData) else {
            return nil
        }

        // Check expiration
        if Date().timeIntervalSince1970 > payload.exp {
            return nil
        }

        return UserInfo(email: payload.email, name: payload.name, picture: payload.picture)
    }
}
