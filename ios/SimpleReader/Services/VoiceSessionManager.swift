import AVFoundation
import Foundation
import Observation
import OSLog

@Observable
final class VoiceSessionManager {
    var phase: VoiceSessionPhase = .idle
    var transcript: [VoiceTranscriptEntry] = []
    var latestUserText = ""
    var latestAssistantText = ""

    var isActive: Bool {
        switch phase {
        case .idle:
            return false
        default:
            return true
        }
    }

    var canShowTranscript: Bool {
        !transcript.isEmpty || isActive
    }

    @ObservationIgnored private var webSocketTask: URLSessionWebSocketTask?
    @ObservationIgnored private var urlSession: URLSession?
    @ObservationIgnored private var audioEngine: AVAudioEngine?
    @ObservationIgnored private var captureConverter: AVAudioConverter?
    @ObservationIgnored private var captureOutputFormat: AVAudioFormat?
    @ObservationIgnored private var playerNode: AVAudioPlayerNode?
    @ObservationIgnored private let audioQueue = DispatchQueue(label: "com.dysun.simplereader.voice-audio")
    @ObservationIgnored private var isStopping = false
    @ObservationIgnored private var sessionGeneration = 0
    @ObservationIgnored private var scheduledPlaybackBufferCount = 0
    @ObservationIgnored private var playbackGeneration = 0
    @ObservationIgnored private var isPlaybackPausedForInterruption = false
    @ObservationIgnored private let echoGuard = VoiceEchoGuard()
    @ObservationIgnored private var microphonePreRoll: [(data: Data, duration: TimeInterval)] = []
    @ObservationIgnored private var microphonePreRollDuration: TimeInterval = 0
    @ObservationIgnored private var localSpeechTracker = VoiceSpeechActivityTracker()

    private let maximumMicrophonePreRollDuration: TimeInterval = 0.45
    private static let logger = Logger(subsystem: "com.dysun.simplereader", category: "Voice")

    private static var defaultEndpoint: URL {
        if let override = ProcessInfo.processInfo.environment["SIMPLEREADER_VOICE_WS_URL"],
           let url = URL(string: override) {
            return url
        }

        return URL(string: "wss://reader-g6kh.onrender.com/api/voice/ws")!
    }

    func markPreparing() {
        guard !isActive else { return }
        phase = .preparing
    }

    func start(context: VoiceSessionContext, endpoint: URL = VoiceSessionManager.defaultEndpoint) async {
        guard !isActive || phase == .preparing else { return }

        sessionGeneration &+= 1
        let generation = sessionGeneration
        isStopping = false
        transcript = []
        latestUserText = ""
        latestAssistantText = ""
        phase = .preparing

        do {
            try await requestMicrophoneAccess()
            guard isCurrentSession(generation) else { return }
            try configureAudioSession()
            try configureAudioGraph()
            try await connect(endpoint: endpoint, context: context, generation: generation)
        } catch {
            guard isCurrentSession(generation) else { return }
            closeConnection(sendStop: false)
            stopAudio()
            phase = .error(error.localizedDescription)
        }
    }

    func stop() {
        isStopping = true
        sessionGeneration &+= 1
        closeConnection(sendStop: true)
        stopAudio()
        phase = .idle
    }

    func clearError() {
        if case .error = phase {
            phase = .idle
        }
    }

    // MARK: - Connection

    private func isCurrentSession(_ generation: Int) -> Bool {
        !isStopping && generation == sessionGeneration
    }

    private func connect(
        endpoint: URL,
        context: VoiceSessionContext,
        generation: Int
    ) async throws {
        phase = .connecting

        let session = URLSession(configuration: .default)
        let task = session.webSocketTask(with: endpoint)
        urlSession = session
        webSocketTask = task
        task.resume()

        receiveNext(task: task, generation: generation)

        let data = try JSONEncoder().encode(context)
        guard let setupString = String(data: data, encoding: .utf8) else {
            throw VoiceSessionError.invalidSetup
        }

        try await send(.string(setupString), using: task)

        guard isCurrentSession(generation), webSocketTask === task else {
            task.cancel(with: .goingAway, reason: nil)
            throw CancellationError()
        }
    }

    private func send(
        _ message: URLSessionWebSocketTask.Message,
        using task: URLSessionWebSocketTask
    ) async throws {
        let _: Void = try await withCheckedThrowingContinuation { continuation in
            task.send(message) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    private func receiveNext(task: URLSessionWebSocketTask, generation: Int) {
        task.receive { [weak self] result in
            DispatchQueue.main.async {
                self?.handleReceive(result, task: task, generation: generation)
            }
        }
    }

    private func handleReceive(
        _ result: Result<URLSessionWebSocketTask.Message, Error>,
        task: URLSessionWebSocketTask,
        generation: Int
    ) {
        guard isCurrentSession(generation), webSocketTask === task else { return }

        switch result {
        case .success(let message):
            switch message {
            case .data(let data):
                playAudio(data)
            case .string(let text):
                handleServerEvent(text)
            @unknown default:
                break
            }
            if isCurrentSession(generation), webSocketTask === task {
                receiveNext(task: task, generation: generation)
            }

        case .failure(let error):
            closeConnection(sendStop: false)
            stopAudio()
            phase = .error(error.localizedDescription)
        }
    }

    private func closeConnection(sendStop: Bool) {
        if sendStop,
           let data = #"{"type":"stop"}"#.data(using: .utf8),
           let text = String(data: data, encoding: .utf8) {
            webSocketTask?.send(.string(text)) { _ in }
        }

        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
    }

    private func handleServerEvent(_ text: String) {
        guard let data = text.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = payload["type"] as? String else {
            return
        }

        switch type {
        case "connecting":
            phase = .connecting

        case "ready":
            do {
                try startMicrophoneStreaming()
                phase = .listening
            } catch {
                phase = .error(error.localizedDescription)
            }

        case "transcript":
            guard let roleValue = payload["role"] as? String,
                  let role = VoiceTranscriptRole(rawValue: roleValue),
                  let text = payload["text"] as? String else {
                return
            }
            appendTranscript(role: role, text: text)

        case "interrupted":
            let interruptionID = payload["interruptionId"] as? Int
            let locallyConfirmedSpeech = echoGuard.hasConfirmedBargeIn

            if locallyConfirmedSpeech {
                let snapshot = echoGuard.snapshot
                Self.logger.info(
                    "Confirmed local barge-in micRMS=\(snapshot.microphoneRMS, privacy: .public) playbackRMS=\(snapshot.playbackRMS, privacy: .public) threshold=\(snapshot.speechThresholdRMS, privacy: .public)"
                )
                flushPlayback()
                sendInterruptionVerdict(
                    interruptionID: interruptionID,
                    verdict: "speech"
                )
            } else {
                Self.logger.notice("Pausing playback while interruption is validated")
                pausePlaybackForInterruption()
                sendInterruptionVerdict(
                    interruptionID: interruptionID,
                    verdict: "unknown"
                )
            }
            phase = .listening

        case "interruption_confirmed":
            flushPlayback()
            phase = .listening

        case "false_interruption":
            Self.logger.notice("Resuming after false interruption")
            resumePlaybackAfterFalseInterruption()

        case "turn_complete":
            if scheduledPlaybackBufferCount == 0 {
                phase = .listening
            }

        case "error":
            let message = payload["message"] as? String ?? "Voice session failed"
            closeConnection(sendStop: false)
            stopAudio()
            phase = .error(message)

        default:
            break
        }
    }

    private func sendInterruptionVerdict(
        interruptionID: Int?,
        verdict: String,
        using specifiedTask: URLSessionWebSocketTask? = nil
    ) {
        guard let task = specifiedTask ?? webSocketTask,
              task.state == .running else { return }

        var payload: [String: Any] = [
            "type": "interruption_verdict",
            "verdict": verdict,
        ]
        if let interruptionID {
            payload["interruptionId"] = interruptionID
        }

        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else {
            return
        }

        task.send(.string(text)) { error in
            if let error {
                Self.logger.error("Could not report interruption verdict: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func appendTranscript(role: VoiceTranscriptRole, text: String) {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }

        switch role {
        case .user:
            latestUserText = normalized
        case .assistant:
            latestAssistantText = normalized
        }

        if let lastIndex = transcript.indices.last,
           transcript[lastIndex].role == role {
            transcript[lastIndex].text = normalized
            transcript[lastIndex].timestamp = Date()
        } else {
            transcript.append(VoiceTranscriptEntry(role: role, text: normalized))
        }
    }

    // MARK: - Capture

    private func requestMicrophoneAccess() async throws {
        let granted = await AVAudioApplication.requestRecordPermission()

        guard granted else {
            throw VoiceSessionError.microphoneDenied
        }
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            // HFP provides a matched input/output route for full-duplex voice.
            // A2DP is output-only and can break the route assumptions used by
            // the system echo canceller.
            options: [.defaultToSpeaker, .allowBluetoothHFP]
        )
        try session.setActive(true)

        let inputs = session.currentRoute.inputs.map(\.portType.rawValue).joined(separator: ",")
        let outputs = session.currentRoute.outputs.map(\.portType.rawValue).joined(separator: ",")
        Self.logger.info(
            "Audio session active input=\(inputs, privacy: .public) output=\(outputs, privacy: .public) rate=\(session.sampleRate, privacy: .public)"
        )
    }

    private func startMicrophoneStreaming() throws {
        let engine: AVAudioEngine
        if let existingEngine = audioEngine {
            engine = existingEngine
        } else {
            try configureAudioGraph()
            guard let configuredEngine = audioEngine else {
                throw VoiceSessionError.audioConfigurationFailed
            }
            engine = configuredEngine
        }

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        guard let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 16_000,
            channels: 1,
            interleaved: false
        ),
              let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            throw VoiceSessionError.audioConfigurationFailed
        }

        captureConverter = converter
        captureOutputFormat = outputFormat

        guard let voiceTask = webSocketTask else {
            throw VoiceSessionError.notConnected
        }

        inputNode.installTap(onBus: 0, bufferSize: 2_048, format: inputFormat) { [weak self] buffer, _ in
            guard let self,
                  let converter = self.captureConverter,
                  let outputFormat = self.captureOutputFormat,
                  let bufferCopy = self.copyAudioBuffer(buffer) else {
                return
            }

            self.audioQueue.async {
                self.convertAndSend(
                    bufferCopy,
                    converter: converter,
                    outputFormat: outputFormat,
                    task: voiceTask
                )
            }
        }

        engine.prepare()
        if !engine.isRunning {
            try engine.start()
        }
    }

    private func copyAudioBuffer(_ source: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let copy = AVAudioPCMBuffer(
            pcmFormat: source.format,
            frameCapacity: source.frameLength
        ) else {
            return nil
        }

        copy.frameLength = source.frameLength
        let sourceBuffers = UnsafeMutableAudioBufferListPointer(source.mutableAudioBufferList)
        let destinationBuffers = UnsafeMutableAudioBufferListPointer(copy.mutableAudioBufferList)
        guard sourceBuffers.count == destinationBuffers.count else { return nil }

        for index in sourceBuffers.indices {
            let sourceBuffer = sourceBuffers[index]
            let byteCount = Int(sourceBuffer.mDataByteSize)
            guard let sourceData = sourceBuffer.mData,
                  let destinationData = destinationBuffers[index].mData,
                  byteCount <= Int(destinationBuffers[index].mDataByteSize) else {
                return nil
            }

            destinationData.copyMemory(from: sourceData, byteCount: byteCount)
            destinationBuffers[index].mDataByteSize = sourceBuffer.mDataByteSize
        }

        return copy
    }

    private func convertAndSend(
        _ buffer: AVAudioPCMBuffer,
        converter: AVAudioConverter,
        outputFormat: AVAudioFormat,
        task: URLSessionWebSocketTask
    ) {
        guard task.state == .running else { return }

        let ratio = outputFormat.sampleRate / buffer.format.sampleRate
        let frameCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 32
        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCapacity) else {
            return
        }

        var didProvideInput = false
        var conversionError: NSError?
        let inputBlock: AVAudioConverterInputBlock = { _, status in
            if didProvideInput {
                status.pointee = .noDataNow
                return nil
            }

            didProvideInput = true
            status.pointee = .haveData
            return buffer
        }

        let conversionStatus = converter.convert(
            to: outputBuffer,
            error: &conversionError,
            withInputFrom: inputBlock
        )

        guard conversionStatus != .error,
              outputBuffer.frameLength > 0,
              let samples = outputBuffer.int16ChannelData?.pointee else {
            return
        }

        let sampleCount = Int(outputBuffer.frameLength)
        let data = Data(
            bytes: samples,
            count: sampleCount * MemoryLayout<Int16>.size
        )
        let duration = Double(sampleCount) / outputFormat.sampleRate
        let microphoneRMS = rms(samples: samples, count: sampleCount)
        updateLocalBargeInActivity(
            microphoneRMS: microphoneRMS,
            duration: duration,
            task: task
        )

        switch echoGuard.microphoneDecision(rms: microphoneRMS, duration: duration) {
        case .suppress:
            retainMicrophonePreRoll(data, duration: duration)

        case .beginBargeIn:
            localSpeechTracker.begin()
            let preRoll = drainMicrophonePreRoll()
            for frame in preRoll {
                task.send(.data(frame)) { _ in }
            }
            task.send(.data(data)) { _ in }

        case .forward:
            discardMicrophonePreRoll()
            task.send(.data(data)) { _ in }
        }
    }

    private func updateLocalBargeInActivity(
        microphoneRMS: Float,
        duration: TimeInterval,
        task: URLSessionWebSocketTask
    ) {
        guard localSpeechTracker.update(rms: microphoneRMS, duration: duration) else { return }
        sendInterruptionVerdict(
            interruptionID: nil,
            verdict: "speech_ended",
            using: task
        )
    }

    private func resetLocalBargeInActivity() {
        localSpeechTracker.reset()
    }

    private func rms(samples: UnsafePointer<Int16>, count: Int) -> Float {
        guard count > 0 else { return 0 }

        var sum: Float = 0
        for index in 0..<count {
            let sample = Float(samples[index]) / Float(Int16.max)
            sum += sample * sample
        }
        return sqrt(sum / Float(count))
    }

    private func retainMicrophonePreRoll(_ data: Data, duration: TimeInterval) {
        microphonePreRoll.append((data: data, duration: duration))
        microphonePreRollDuration += duration

        while microphonePreRollDuration > maximumMicrophonePreRollDuration,
              !microphonePreRoll.isEmpty {
            let discarded = microphonePreRoll.removeFirst()
            microphonePreRollDuration = max(0, microphonePreRollDuration - discarded.duration)
        }
    }

    private func drainMicrophonePreRoll() -> [Data] {
        let frames = microphonePreRoll.map(\.data)
        discardMicrophonePreRoll()
        return frames
    }

    private func discardMicrophonePreRoll() {
        microphonePreRoll = []
        microphonePreRollDuration = 0
    }

    // MARK: - Playback

    private func configureAudioGraph() throws {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        let inputNode = engine.inputNode
        let outputNode = engine.outputNode

        try enableVoiceProcessing(inputNode: inputNode, outputNode: outputNode)

        guard let playbackFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 24_000,
            channels: 1,
            interleaved: false
        ) else {
            throw VoiceSessionError.audioConfigurationFailed
        }

        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: playbackFormat)
        player.installTap(onBus: 0, bufferSize: 256, format: nil) { [weak echoGuard] buffer, _ in
            echoGuard?.playbackLevelDidChange(rms: Self.rms(buffer: buffer))
        }
        engine.prepare()
        try engine.start()

        audioEngine = engine
        playerNode = player

        Self.logger.info(
            "Voice processing enabled input=\(inputNode.isVoiceProcessingEnabled, privacy: .public) output=\(outputNode.isVoiceProcessingEnabled, privacy: .public) inputFormat=\(inputNode.outputFormat(forBus: 0).description, privacy: .public) outputFormat=\(outputNode.inputFormat(forBus: 0).description, privacy: .public)"
        )
    }

    private func enableVoiceProcessing(
        inputNode: AVAudioInputNode,
        outputNode: AVAudioOutputNode
    ) throws {
        // Enabling either I/O node configures both sides of the duplex graph.
        // Verify both below so an unsupported route cannot silently lose AEC.
        try inputNode.setVoiceProcessingEnabled(true)

        if !inputNode.isVoiceProcessingEnabled || !outputNode.isVoiceProcessingEnabled {
            throw VoiceSessionError.audioConfigurationFailed
        }

        inputNode.isVoiceProcessingBypassed = false
        inputNode.isVoiceProcessingAGCEnabled = true
    }

    private static func rms(buffer: AVAudioPCMBuffer) -> Float {
        guard let channels = buffer.floatChannelData,
              buffer.frameLength > 0 else {
            return 0
        }

        let frameCount = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        guard channelCount > 0 else { return 0 }

        var sum: Float = 0
        for channelIndex in 0..<channelCount {
            let channel = channels[channelIndex]
            for frameIndex in 0..<frameCount {
                let sample = channel[frameIndex]
                sum += sample * sample
            }
        }

        return sqrt(sum / Float(frameCount * channelCount))
    }

    private func playAudio(_ data: Data) {
        guard let playerNode,
              let audioEngine,
              let playbackFormat = AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: 24_000,
                channels: 1,
                interleaved: false
              ) else {
            return
        }

        let sampleCount = data.count / MemoryLayout<Int16>.size
        guard sampleCount > 0,
              let buffer = AVAudioPCMBuffer(
                pcmFormat: playbackFormat,
                frameCapacity: AVAudioFrameCount(sampleCount)
              ),
              let channel = buffer.floatChannelData?.pointee else {
            return
        }

        var samples = [Int16](repeating: 0, count: sampleCount)
        _ = samples.withUnsafeMutableBytes { rawBuffer in
            data.copyBytes(to: rawBuffer)
        }

        for index in 0..<sampleCount {
            channel[index] = Float(samples[index]) / Float(Int16.max)
        }
        buffer.frameLength = AVAudioFrameCount(sampleCount)

        if !audioEngine.isRunning {
            try? audioEngine.start()
        }

        playerNode.volume = 0.82
        if scheduledPlaybackBufferCount == 0 {
            audioQueue.async { [weak self] in
                self?.resetLocalBargeInActivity()
            }
            echoGuard.playbackDidStart()
        }

        let generation = playbackGeneration
        scheduledPlaybackBufferCount += 1
        playerNode.scheduleBuffer(buffer, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, self.playbackGeneration == generation else { return }
                self.scheduledPlaybackBufferCount = max(0, self.scheduledPlaybackBufferCount - 1)
                if self.scheduledPlaybackBufferCount == 0 {
                    self.echoGuard.playbackDidEnd()
                    if self.phase == .speaking && !self.isPlaybackPausedForInterruption {
                        self.phase = .listening
                    }
                }
            }
        }
        if !playerNode.isPlaying && !isPlaybackPausedForInterruption {
            playerNode.play()
        }

        if !isPlaybackPausedForInterruption {
            phase = .speaking
        }
    }

    private func flushPlayback() {
        playbackGeneration &+= 1
        scheduledPlaybackBufferCount = 0
        isPlaybackPausedForInterruption = false
        echoGuard.playbackWasCancelled()
        playerNode?.stop()
        audioQueue.async { [weak self] in
            self?.discardMicrophonePreRoll()
        }
    }

    private func pausePlaybackForInterruption() {
        isPlaybackPausedForInterruption = scheduledPlaybackBufferCount > 0
        if isPlaybackPausedForInterruption {
            playerNode?.pause()
        }
        echoGuard.playbackWasCancelled()
        audioQueue.async { [weak self] in
            self?.discardMicrophonePreRoll()
        }
    }

    private func resumePlaybackAfterFalseInterruption() {
        isPlaybackPausedForInterruption = false
        audioQueue.async { [weak self] in
            self?.resetLocalBargeInActivity()
        }
        guard scheduledPlaybackBufferCount > 0 else {
            phase = .listening
            return
        }

        echoGuard.playbackDidStart()
        playerNode?.play()
        phase = .speaking
    }

    private func stopAudio() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        captureConverter = nil
        captureOutputFormat = nil

        playerNode?.removeTap(onBus: 0)
        playerNode?.stop()
        playerNode = nil
        playbackGeneration &+= 1
        scheduledPlaybackBufferCount = 0
        isPlaybackPausedForInterruption = false
        echoGuard.playbackWasCancelled()
        audioQueue.sync {
            discardMicrophonePreRoll()
            resetLocalBargeInActivity()
        }

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

enum VoiceSessionError: LocalizedError {
    case microphoneDenied
    case audioConfigurationFailed
    case invalidSetup
    case notConnected

    var errorDescription: String? {
        switch self {
        case .microphoneDenied:
            return "Microphone access is needed for voice conversation."
        case .audioConfigurationFailed:
            return "Could not configure audio for voice conversation."
        case .invalidSetup:
            return "Could not start the voice session."
        case .notConnected:
            return "Voice session is not connected."
        }
    }
}
