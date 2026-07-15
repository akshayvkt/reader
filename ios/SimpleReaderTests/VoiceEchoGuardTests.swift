import XCTest
#if SWIFT_PACKAGE
@testable import SimpleReaderVoiceCore
#else
@testable import SimpleReader
#endif

final class VoiceEchoGuardTests: XCTestCase {
    private let configuration = VoiceEchoGuard.Configuration(
        playbackStartupHoldoff: 0.25,
        minimumBargeInDuration: 0.18,
        maximumCandidateGap: 0.08,
        minimumMicrophoneRMS: 0.018,
        playbackLeakageRatio: 0.14,
        playbackTailDuration: 0.25
    )

    func testMicrophoneFlowsNormallyOutsidePlayback() {
        let guardState = VoiceEchoGuard(configuration: configuration)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 10),
            .forward
        )
    }

    func testPlaybackStartupIsSuppressedWhileAECConverges() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.2, duration: 0.04, at: 10.24),
            .suppress
        )
    }

    func testAdditionalPlaybackBuffersDoNotRestartStartupHoldoff() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackDidStart(at: 10.20)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 10.26),
            .suppress
        )
        XCTAssertEqual(guardState.snapshot.speechThresholdRMS, 0.018, accuracy: 0.0001)
    }

    func testResidualEchoBelowPlaybackRelativeThresholdCannotInterrupt() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackLevelDidChange(rms: 0.20)

        // Dynamic threshold is 0.028, above this 0.02 residual.
        for index in 0..<10 {
            XCTAssertEqual(
                guardState.microphoneDecision(
                    rms: 0.02,
                    duration: 0.04,
                    at: 10.30 + (Double(index) * 0.04)
                ),
                .suppress
            )
        }

        XCTAssertFalse(guardState.hasConfirmedBargeIn)
    }

    func testSustainedNearEndSpeechOpensGateAndPreservesBargeInState() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackLevelDidChange(rms: 0.10)

        for index in 0..<4 {
            XCTAssertEqual(
                guardState.microphoneDecision(
                    rms: 0.08,
                    duration: 0.04,
                    at: 10.30 + (Double(index) * 0.04)
                ),
                .suppress
            )
        }

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.08, duration: 0.04, at: 10.46),
            .beginBargeIn
        )
        XCTAssertTrue(guardState.hasConfirmedBargeIn)
        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 10.50),
            .forward
        )
    }

    func testShortNoiseBurstDoesNotOpenGate() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.08, duration: 0.08, at: 10.30),
            .suppress
        )
        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.10, at: 10.38),
            .suppress
        )
        XCTAssertFalse(guardState.hasConfirmedBargeIn)
    }

    func testAcousticTailIsSuppressedThenMicrophoneReopens() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackDidEnd(at: 11)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 11.20),
            .suppress
        )
        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 11.26),
            .forward
        )
    }

    func testCancelImmediatelyReopensMicrophone() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackWasCancelled()

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 10.01),
            .forward
        )
    }

    func testPlaybackResumingInsideTailDoesNotRestartHoldoff() {
        let guardState = VoiceEchoGuard(configuration: configuration)
        guardState.playbackDidStart(at: 10)
        guardState.playbackDidEnd(at: 11)
        guardState.playbackDidStart(at: 11.10)

        XCTAssertEqual(
            guardState.microphoneDecision(rms: 0.001, duration: 0.04, at: 11.11),
            .suppress
        )
        XCTAssertEqual(guardState.snapshot.speechThresholdRMS, 0.018, accuracy: 0.0001)
    }

    func testSpeechActivityTrackerWaitsThroughNaturalPauses() {
        var tracker = VoiceSpeechActivityTracker(
            configuration: .init(minimumSpeechRMS: 0.015, endSilenceDuration: 0.70)
        )
        tracker.begin()

        XCTAssertFalse(tracker.update(rms: 0.08, duration: 0.20))
        XCTAssertFalse(tracker.update(rms: 0.001, duration: 0.40))
        XCTAssertFalse(tracker.update(rms: 0.05, duration: 0.10))
        XCTAssertFalse(tracker.update(rms: 0.001, duration: 0.40))
        XCTAssertTrue(tracker.isActive)
    }

    func testSpeechActivityTrackerReportsEndOnlyOnce() {
        var tracker = VoiceSpeechActivityTracker(
            configuration: .init(minimumSpeechRMS: 0.015, endSilenceDuration: 0.70)
        )
        tracker.begin()

        XCTAssertFalse(tracker.update(rms: 0.001, duration: 0.40))
        XCTAssertTrue(tracker.update(rms: 0.001, duration: 0.30))
        XCTAssertFalse(tracker.update(rms: 0.001, duration: 1.0))
        XCTAssertFalse(tracker.isActive)
    }
}
