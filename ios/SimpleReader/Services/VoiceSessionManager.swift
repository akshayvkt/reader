import AVFoundation
import Foundation
import Observation

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
    @ObservationIgnored private var isPlaybackActive = false
    @ObservationIgnored private var playbackStartedAt: Date?
    @ObservationIgnored private var scheduledPlaybackBufferCount = 0

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

        isStopping = false
        transcript = []
        latestUserText = ""
        latestAssistantText = ""
        phase = .preparing

        do {
            try await requestMicrophoneAccess()
            try configureAudioSession()
            try configureAudioGraph()
            try await connect(endpoint: endpoint, context: context)
        } catch {
            stopAudio()
            phase = .error(error.localizedDescription)
        }
    }

    func stop() {
        isStopping = true

        if let data = #"{"type":"stop"}"#.data(using: .utf8),
           let text = String(data: data, encoding: .utf8) {
            webSocketTask?.send(.string(text)) { _ in }
        }

        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        stopAudio()
        phase = .idle
    }

    func clearError() {
        if case .error = phase {
            phase = .idle
        }
    }

    // MARK: - Connection

    private func connect(endpoint: URL, context: VoiceSessionContext) async throws {
        phase = .connecting

        let session = URLSession(configuration: .default)
        let task = session.webSocketTask(with: endpoint)
        urlSession = session
        webSocketTask = task
        task.resume()

        receiveNext()

        let data = try JSONEncoder().encode(context)
        guard let setupString = String(data: data, encoding: .utf8) else {
            throw VoiceSessionError.invalidSetup
        }

        try await send(.string(setupString))
    }

    private func send(_ message: URLSessionWebSocketTask.Message) async throws {
        guard let task = webSocketTask else {
            throw VoiceSessionError.notConnected
        }

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

    private func receiveNext() {
        guard let task = webSocketTask else { return }

        task.receive { [weak self] result in
            DispatchQueue.main.async {
                self?.handleReceive(result)
            }
        }
    }

    private func handleReceive(_ result: Result<URLSessionWebSocketTask.Message, Error>) {
        guard !isStopping else { return }

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
            receiveNext()

        case .failure(let error):
            if !isStopping {
                stopAudio()
                phase = .error(error.localizedDescription)
            }
        }
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
            flushPlayback()
            phase = .listening

        case "turn_complete":
            phase = .listening

        case "error":
            let message = payload["message"] as? String ?? "Voice session failed"
            stopAudio()
            phase = .error(message)

        default:
            break
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
        let granted = await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }

        guard granted else {
            throw VoiceSessionError.microphoneDenied
        }
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
        )
        try session.setActive(true)
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

        inputNode.installTap(onBus: 0, bufferSize: 2_048, format: inputFormat) { [weak self] buffer, _ in
            guard let self,
                  let converter = self.captureConverter,
                  let outputFormat = self.captureOutputFormat else {
                return
            }

            self.audioQueue.async {
                self.convertAndSend(buffer, converter: converter, outputFormat: outputFormat)
            }
        }

        engine.prepare()
        if !engine.isRunning {
            try engine.start()
        }
    }

    private func convertAndSend(
        _ buffer: AVAudioPCMBuffer,
        converter: AVAudioConverter,
        outputFormat: AVAudioFormat
    ) {
        guard webSocketTask != nil else { return }

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
        if isPlaybackActive,
           let playbackStartedAt,
           Date().timeIntervalSince(playbackStartedAt) < playbackMicHoldoff {
            return
        }

        let data = Data(
            bytes: samples,
            count: sampleCount * MemoryLayout<Int16>.size
        )

        webSocketTask?.send(.data(data)) { _ in }
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

    private var playbackMicHoldoff: TimeInterval {
        #if targetEnvironment(simulator)
        return 0.22
        #else
        return 0
        #endif
    }

    // MARK: - Playback

    private func configureAudioGraph() throws {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        let inputNode = engine.inputNode
        let outputNode = engine.outputNode

        try? inputNode.setVoiceProcessingEnabled(true)
        try? outputNode.setVoiceProcessingEnabled(true)

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
        engine.prepare()
        try engine.start()

        audioEngine = engine
        playerNode = player
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
        scheduledPlaybackBufferCount += 1
        isPlaybackActive = true
        playbackStartedAt = Date()
        playerNode.scheduleBuffer(buffer) { [weak self] in
            DispatchQueue.main.async {
                guard let self else { return }
                self.scheduledPlaybackBufferCount = max(0, self.scheduledPlaybackBufferCount - 1)
                if self.scheduledPlaybackBufferCount == 0 {
                    self.isPlaybackActive = false
                    self.playbackStartedAt = nil
                    if self.phase == .speaking {
                        self.phase = .listening
                    }
                }
            }
        }
        if !playerNode.isPlaying {
            playerNode.play()
        }

        phase = .speaking
    }

    private func flushPlayback() {
        scheduledPlaybackBufferCount = 0
        isPlaybackActive = false
        playbackStartedAt = nil
        playerNode?.stop()
    }

    private func stopAudio() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        captureConverter = nil
        captureOutputFormat = nil

        playerNode?.stop()
        playerNode = nil
        scheduledPlaybackBufferCount = 0
        isPlaybackActive = false
        playbackStartedAt = nil

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
