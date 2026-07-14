import Foundation

/// Gives the system echo canceller a brief window to converge when assistant
/// playback begins. Microphone audio flows normally after this one-time guard,
/// so the user can still barge in while a response is playing.
final class VoiceEchoGuard: @unchecked Sendable {
    struct Configuration: Equatable {
        var playbackStartupHoldoff: TimeInterval = 0.30
    }

    private let configuration: Configuration
    private let lock = NSLock()
    private var playbackStartedAt: TimeInterval?

    init(configuration: Configuration = Configuration()) {
        self.configuration = configuration
    }

    func playbackDidStart(at time: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        lock.lock()
        defer { lock.unlock() }

        // Audio arrives as many small buffers. Preserve the beginning of the
        // overall response instead of restarting the holdoff for every buffer.
        if playbackStartedAt == nil {
            playbackStartedAt = time
        }
    }

    func playbackDidEnd() {
        lock.lock()
        playbackStartedAt = nil
        lock.unlock()
    }

    func shouldForwardMicrophone(at time: TimeInterval = ProcessInfo.processInfo.systemUptime) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard let playbackStartedAt else {
            return true
        }

        return time - playbackStartedAt >= configuration.playbackStartupHoldoff
    }
}
