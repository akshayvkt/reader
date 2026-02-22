import SwiftUI

/// Login screen — ports LoginScreen.tsx.
/// BookOpen icon, "Simple Reader" title in Libre Baskerville,
/// "Continue with Google" button, privacy note.
///
/// Note: Google Sign-In integration is deferred. For now this shows
/// the login UI and can be wired up later.
struct LoginView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo
            Image(systemName: "book.pages")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(DesignSystem.Colors.accent)
                .frame(width: 80, height: 80)
                .background(DesignSystem.Colors.accentSubtle)
                .cornerRadius(DesignSystem.CornerRadius.large)
                .padding(.bottom, DesignSystem.Spacing.xxxl)

            // Title
            Text("Simple Reader")
                .font(DesignSystem.Fonts.title)
                .foregroundStyle(DesignSystem.Colors.foreground)
                .padding(.bottom, DesignSystem.Spacing.md)

            // Subtitle
            Text("Read deeply. Understand fully.")
                .font(.body)
                .foregroundStyle(DesignSystem.Colors.foregroundMuted)
                .padding(.bottom, 40)

            // Sign in button
            Button {
                // TODO: Wire up Google Sign-In
                // For now, skip auth and go straight to library
                appState.skipAuth()
            } label: {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    // Google "G" icon placeholder
                    Image(systemName: "g.circle.fill")
                        .font(.title3)
                        .foregroundStyle(DesignSystem.Colors.foreground)

                    Text("Continue with Google")
                        .font(.body.weight(.medium))
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.lg)
                .background(DesignSystem.Colors.surface)
                .cornerRadius(DesignSystem.CornerRadius.medium)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.medium)
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.04), radius: 8, x: 0, y: 2)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, DesignSystem.Spacing.xxl)

            // Privacy note
            Text("Your books stay on your device. We only use your email to identify you.")
                .font(.caption)
                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                .multilineTextAlignment(.center)
                .padding(.top, DesignSystem.Spacing.xxl)
                .padding(.horizontal, DesignSystem.Spacing.xxxl)

            Spacer()
        }
        .frame(maxWidth: 384)
        .frame(maxWidth: .infinity)
        .background(DesignSystem.Colors.background)
    }
}
