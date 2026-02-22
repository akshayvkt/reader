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
                    Picker("Theme", selection: $preferences.theme) {
                        ForEach(ReadingPreferences.ThemeMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
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
                    HStack {
                        // Decrease button
                        Button {
                            preferences.decrease()
                        } label: {
                            Text("A")
                                .font(.body)
                                .foregroundStyle(preferences.canDecrease
                                    ? DesignSystem.Colors.foreground
                                    : DesignSystem.Colors.foregroundSubtle)
                        }
                        .disabled(!preferences.canDecrease)

                        Spacer()

                        // Dot indicators
                        HStack(spacing: 6) {
                            ForEach(0..<ReadingPreferences.FontSizeLevel.allCases.count, id: \.self) { i in
                                Circle()
                                    .fill(i == preferences.sizeIndex
                                          ? DesignSystem.Colors.accent
                                          : DesignSystem.Colors.border)
                                    .frame(width: 6, height: 6)
                            }
                        }

                        Spacer()

                        // Increase button
                        Button {
                            preferences.increase()
                        } label: {
                            Text("A")
                                .font(.title2)
                                .foregroundStyle(preferences.canIncrease
                                    ? DesignSystem.Colors.foreground
                                    : DesignSystem.Colors.foregroundSubtle)
                        }
                        .disabled(!preferences.canIncrease)
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
                            in: 1.2...2.2,
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
}
