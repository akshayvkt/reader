import Foundation

/// Secondary protection around the system voice-processing echo canceller.
///
/// Apple's voice-processing I/O remains the primary AEC. This gate only decides
/// whether an echo-cancelled microphone buffer is credible near-end speech while
/// assistant audio is coming from the speaker. It deliberately keeps a short
/// pre-roll in `VoiceSessionManager`, so confirmation latency does not clip the
/// beginning of a real barge-in.
final class VoiceEchoGuard: @unchecked Sendable {
    struct Configuration: Equatable {
        /// Gives VoiceProcessingIO time to converge when playback first starts.
        var playbackStartupHoldoff: TimeInterval = 0.25

        /// Speech must remain credible for this long before it can interrupt.
        var minimumBargeInDuration: TimeInterval = 0.18

        /// Allows very short gaps between voiced microphone buffers.
        var maximumCandidateGap: TimeInterval = 0.08

        /// Absolute floor for credible near-end speech (about -35 dBFS).
        var minimumMicrophoneRMS: Float = 0.018

        /// Residual echo should be well below the rendered speaker signal.
        var playbackLeakageRatio: Float = 0.14

        /// Covers acoustic tail and short network gaps between playback buffers.
        var playbackTailDuration: TimeInterval = 0.25
    }

    enum MicrophoneDecision: Equatable {
        /// Send this buffer normally and discard any suppressed pre-roll.
        case forward

        /// Retain this buffer as pre-roll, but do not send it yet.
        case suppress

        /// Send the retained pre-roll followed by this buffer.
        case beginBargeIn
    }

    struct Snapshot: Equatable {
        var microphoneRMS: Float
        var playbackRMS: Float
        var speechThresholdRMS: Float
        var candidateDuration: TimeInterval
    }

    private let configuration: Configuration
    private let lock = NSLock()

    private var playbackStartedAt: TimeInterval?
    private var playbackTailUntil: TimeInterval?
    private var smoothedPlaybackRMS: Float = 0
    private var candidateDuration: TimeInterval = 0
    private var candidateGap: TimeInterval = 0
    private var bargeInConfirmed = false
    private var latestSnapshot = Snapshot(
        microphoneRMS: 0,
        playbackRMS: 0,
        speechThresholdRMS: 0,
        candidateDuration: 0
    )

    init(configuration: Configuration = Configuration()) {
        self.configuration = configuration
    }

    func playbackDidStart(at time: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        lock.lock()
        defer { lock.unlock() }

        let isShortContinuation = playbackTailUntil.map { time <= $0 } ?? false
        if playbackStartedAt == nil && !isShortContinuation {
            resetCandidateLocked()
            playbackStartedAt = time
        } else if playbackStartedAt == nil {
            // A short delivery gap does not require the AEC to reconverge.
            playbackStartedAt = time - configuration.playbackStartupHoldoff
        }

        playbackTailUntil = nil
    }

    func playbackLevelDidChange(rms: Float) {
        lock.lock()
        defer { lock.unlock() }

        let boundedRMS = max(0, rms)
        if smoothedPlaybackRMS == 0 {
            smoothedPlaybackRMS = boundedRMS
        } else {
            smoothedPlaybackRMS = (smoothedPlaybackRMS * 0.75) + (boundedRMS * 0.25)
        }
    }

    /// Marks normal playout completion while retaining a short acoustic tail.
    func playbackDidEnd(at time: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        lock.lock()
        playbackStartedAt = nil
        playbackTailUntil = time + configuration.playbackTailDuration
        lock.unlock()
    }

    /// Stops all playback gating immediately after a real or explicit cancel.
    func playbackWasCancelled() {
        lock.lock()
        playbackStartedAt = nil
        playbackTailUntil = nil
        smoothedPlaybackRMS = 0
        resetCandidateLocked()
        lock.unlock()
    }

    func microphoneDecision(
        rms: Float,
        duration: TimeInterval,
        at time: TimeInterval = ProcessInfo.processInfo.systemUptime
    ) -> MicrophoneDecision {
        lock.lock()
        defer { lock.unlock() }

        let playbackIsActive = playbackStartedAt != nil
        let playbackIsInTail = playbackTailUntil.map { time <= $0 } ?? false
        guard playbackIsActive || playbackIsInTail else {
            playbackTailUntil = nil
            smoothedPlaybackRMS = 0
            resetCandidateLocked()
            return .forward
        }

        if bargeInConfirmed {
            return .forward
        }

        if let playbackStartedAt,
           time - playbackStartedAt < configuration.playbackStartupHoldoff {
            resetCandidateLocked()
            return .suppress
        }

        let threshold = max(
            configuration.minimumMicrophoneRMS,
            smoothedPlaybackRMS * configuration.playbackLeakageRatio
        )
        let boundedDuration = max(0, duration)

        if rms >= threshold {
            candidateGap = 0
            candidateDuration += boundedDuration
        } else {
            candidateGap += boundedDuration
            if candidateGap > configuration.maximumCandidateGap {
                candidateDuration = 0
                candidateGap = 0
            }
        }

        latestSnapshot = Snapshot(
            microphoneRMS: rms,
            playbackRMS: smoothedPlaybackRMS,
            speechThresholdRMS: threshold,
            candidateDuration: candidateDuration
        )

        if candidateDuration >= configuration.minimumBargeInDuration {
            bargeInConfirmed = true
            return .beginBargeIn
        }

        return .suppress
    }

    var hasConfirmedBargeIn: Bool {
        lock.lock()
        defer { lock.unlock() }
        return bargeInConfirmed
    }

    var snapshot: Snapshot {
        lock.lock()
        defer { lock.unlock() }
        return latestSnapshot
    }

    private func resetCandidateLocked() {
        candidateDuration = 0
        candidateGap = 0
        bargeInConfirmed = false
        latestSnapshot = Snapshot(
            microphoneRMS: 0,
            playbackRMS: smoothedPlaybackRMS,
            speechThresholdRMS: configuration.minimumMicrophoneRMS,
            candidateDuration: 0
        )
    }
}

/// Tracks the end of a locally confirmed barge-in so the relay can wait for
/// long utterances without turning a missing transcript into permanent silence.
struct VoiceSpeechActivityTracker {
    struct Configuration: Equatable {
        var minimumSpeechRMS: Float = 0.015
        var endSilenceDuration: TimeInterval = 0.70
    }

    private let configuration: Configuration
    private(set) var isActive = false
    private var silenceDuration: TimeInterval = 0

    init(configuration: Configuration = Configuration()) {
        self.configuration = configuration
    }

    mutating func begin() {
        isActive = true
        silenceDuration = 0
    }

    /// Returns true once, when a confirmed speech segment has ended.
    mutating func update(rms: Float, duration: TimeInterval) -> Bool {
        guard isActive else { return false }

        if rms >= configuration.minimumSpeechRMS {
            silenceDuration = 0
            return false
        }

        silenceDuration += max(0, duration)
        guard silenceDuration >= configuration.endSilenceDuration else { return false }

        reset()
        return true
    }

    mutating func reset() {
        isActive = false
        silenceDuration = 0
    }
}
