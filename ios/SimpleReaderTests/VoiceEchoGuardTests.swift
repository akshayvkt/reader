import XCTest
#if SWIFT_PACKAGE
@testable import SimpleReaderVoiceCore
#else
@testable import SimpleReader
#endif

final class VoiceEchoGuardTests: XCTestCase {
    func testMicrophoneIsHeldOnlyDuringPlaybackStartup() {
        let guardState = VoiceEchoGuard(
            configuration: .init(playbackStartupHoldoff: 0.30)
        )

        guardState.playbackDidStart(at: 10)

        XCTAssertFalse(guardState.shouldForwardMicrophone(at: 10.29))
        XCTAssertTrue(guardState.shouldForwardMicrophone(at: 10.30))
        XCTAssertTrue(guardState.shouldForwardMicrophone(at: 15))
    }

    func testAdditionalAudioBuffersDoNotRestartTheHoldoff() {
        let guardState = VoiceEchoGuard(
            configuration: .init(playbackStartupHoldoff: 0.30)
        )

        guardState.playbackDidStart(at: 10)
        guardState.playbackDidStart(at: 10.25)

        XCTAssertTrue(guardState.shouldForwardMicrophone(at: 10.31))
    }

    func testMicrophoneReopensWhenPlaybackEnds() {
        let guardState = VoiceEchoGuard(
            configuration: .init(playbackStartupHoldoff: 0.30)
        )

        guardState.playbackDidStart(at: 10)
        XCTAssertFalse(guardState.shouldForwardMicrophone(at: 10.10))

        guardState.playbackDidEnd()
        XCTAssertTrue(guardState.shouldForwardMicrophone(at: 10.11))
    }

    func testASecondResponseGetsItsOwnStartupGuard() {
        let guardState = VoiceEchoGuard(
            configuration: .init(playbackStartupHoldoff: 0.30)
        )

        guardState.playbackDidStart(at: 10)
        guardState.playbackDidEnd()
        guardState.playbackDidStart(at: 20)

        XCTAssertFalse(guardState.shouldForwardMicrophone(at: 20.10))
        XCTAssertTrue(guardState.shouldForwardMicrophone(at: 20.30))
    }
}
