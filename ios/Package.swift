// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "SimpleReaderVoiceCore",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .library(name: "SimpleReaderVoiceCore", targets: ["SimpleReaderVoiceCore"]),
    ],
    targets: [
        .target(
            name: "SimpleReaderVoiceCore",
            path: "SimpleReader/Services",
            exclude: [
                "APIClient.swift",
                "BookImporter.swift",
                "BookLibrary.swift",
                "ReadiumService.swift",
                "VoiceSessionManager.swift",
            ],
            sources: ["VoiceEchoGuard.swift"]
        ),
        .testTarget(
            name: "SimpleReaderVoiceCoreTests",
            dependencies: ["SimpleReaderVoiceCore"],
            path: "SimpleReaderTests",
            sources: ["VoiceEchoGuardTests.swift"]
        ),
    ]
)
