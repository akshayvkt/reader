import SwiftUI

/// Typography settings panel: font picker, size A/A buttons, line spacing, theme.
/// Ports the settings menu from BookReader.tsx.
struct TypographySettingsView: View {
    @Bindable var preferences: ReadingPreferences
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Theme
                Section("Theme") {
                    HStack(spacing: 4) {
                        ForEach(ReadingPreferences.ThemeMode.allCases, id: \.self) { mode in
                            themeButton(for: mode)
                        }
                    }
                    .padding(3)
                    .background(DesignSystem.Colors.backgroundMuted, in: Capsule())
                    .listRowBackground(DesignSystem.Colors.surface)
                }

                // Font
                Section("Font") {
                    Picker("Font Family", selection: $preferences.fontFamily) {
                        ForEach(ReadingPreferences.FontFamily.allCases, id: \.self) { font in
                            Text(font.rawValue).tag(font)
                        }
                    }
                    .listRowBackground(DesignSystem.Colors.surface)
                }

                // Size
                Section("Size") {
                    VStack(spacing: 12) {
                        HStack {
                            Button {
                                preferences.decrease()
                            } label: {
                                Text("A")
                                    .font(.body)
                                    .foregroundStyle(preferences.canDecrease
                                        ? DesignSystem.Colors.foreground
                                        : DesignSystem.Colors.foregroundSubtle)
                                    .frame(width: 44, height: 36)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(!preferences.canDecrease)

                            Spacer()

                            Text("\(Int(preferences.fontSize.readiumMultiplier * 100))%")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(DesignSystem.Colors.foreground)

                            Spacer()

                            Button {
                                preferences.increase()
                            } label: {
                                Text("A")
                                    .font(.title2)
                                    .foregroundStyle(preferences.canIncrease
                                        ? DesignSystem.Colors.foreground
                                        : DesignSystem.Colors.foregroundSubtle)
                                    .frame(width: 44, height: 36)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(!preferences.canIncrease)
                        }

                        Slider(
                            value: fontSizeIndex,
                            in: 0...Double(ReadingPreferences.FontSizeLevel.allCases.count - 1),
                            step: 1
                        )
                        .tint(DesignSystem.Colors.accent)

                        HStack(spacing: 6) {
                            ForEach(0..<ReadingPreferences.FontSizeLevel.allCases.count, id: \.self) { i in
                                Circle()
                                    .fill(i == preferences.sizeIndex
                                          ? DesignSystem.Colors.accent
                                          : DesignSystem.Colors.border)
                                    .frame(width: 6, height: 6)
                            }
                        }
                    }
                    .listRowBackground(DesignSystem.Colors.surface)
                }

                // Line spacing
                Section("Line Spacing") {
                    VStack {
                        HStack {
                            Text("Tight")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                            Spacer()
                            Text(String(format: "%.1f", preferences.lineSpacing))
                                .font(.caption.weight(.medium))
                                .foregroundStyle(DesignSystem.Colors.foreground)
                            Spacer()
                            Text("Relaxed")
                                .font(.caption)
                                .foregroundStyle(DesignSystem.Colors.foregroundSubtle)
                        }

                        Slider(
                            value: $preferences.lineSpacing,
                            in: 1.0...2.0,
                            step: 0.1
                        )
                        .tint(DesignSystem.Colors.accent)
                    }
                    .listRowBackground(DesignSystem.Colors.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(DesignSystem.Colors.background)
            .navigationTitle("Reading Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(DesignSystem.Colors.accent)
                }
            }
        }
    }

    private var fontSizeIndex: Binding<Double> {
        Binding {
            Double(preferences.sizeIndex)
        } set: { value in
            let all = ReadingPreferences.FontSizeLevel.allCases
            let index = max(0, min(all.count - 1, Int(value.rounded())))
            preferences.fontSize = all[index]
        }
    }

    private func themeButton(for mode: ReadingPreferences.ThemeMode) -> some View {
        let isSelected = preferences.theme == mode

        return Button {
            preferences.theme = mode
        } label: {
            Text(mode.rawValue)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected
                ? DesignSystem.Colors.accent
                : DesignSystem.Colors.foreground)
                .frame(maxWidth: .infinity, minHeight: 34)
                .background {
                    if isSelected {
                        Capsule()
                            .fill(DesignSystem.Colors.surface)
                            .shadow(color: .black.opacity(0.06), radius: 6, x: 0, y: 2)
                    }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityValue(isSelected ? "Selected" : "")
    }
}
