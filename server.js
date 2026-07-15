const http = require('http');
const next = require('next');
const { GoogleAuth } = require('google-auth-library');
const { WebSocketServer, WebSocket } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const VOICE_WS_PATH = '/api/voice/ws';
const VOICE_MODEL = process.env.GCP_VOICE_MODEL || 'gemini-live-2.5-flash-native-audio';
const VOICE_LOCATION = process.env.GCP_VOICE_LOCATION || 'us-central1';
const MAX_CONTEXT_CHARS = 70_000;
const VOICE_PREFIX_PADDING_MS = readIntegerEnvironment('GCP_VOICE_PREFIX_PADDING_MS', 300, 100, 1_000);
const VOICE_SILENCE_DURATION_MS = readIntegerEnvironment('GCP_VOICE_SILENCE_DURATION_MS', 600, 100, 2_000);
const VOICE_FALSE_INTERRUPTION_TIMEOUT_MS = readIntegerEnvironment(
  'GCP_VOICE_FALSE_INTERRUPTION_TIMEOUT_MS',
  1_400,
  500,
  4_000
);
const VOICE_SPEECH_TRANSCRIPT_TIMEOUT_MS = readIntegerEnvironment(
  'GCP_VOICE_SPEECH_TRANSCRIPT_TIMEOUT_MS',
  12_000,
  3_000,
  30_000
);
const VOICE_SPEECH_END_GRACE_MS = readIntegerEnvironment(
  'GCP_VOICE_SPEECH_END_GRACE_MS',
  5_000,
  500,
  8_000
);

function readIntegerEnvironment(name, fallback, minimum, maximum) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizedTokens(text) {
  return String(text || '')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}']+/gu) || [];
}

function assistantEchoSimilarity(inputText, assistantText) {
  const inputTokens = normalizedTokens(inputText);
  const assistantTokens = normalizedTokens(assistantText);
  if (inputTokens.length < 2 || assistantTokens.length < 2) {
    return 0;
  }

  // Echo is a replay in the same word order, not merely a sentence sharing
  // common words. Longest-common-subsequence avoids rejecting a legitimate
  // follow-up just because it reuses names or phrases from the answer.
  let previous = new Array(assistantTokens.length + 1).fill(0);
  for (const inputToken of inputTokens) {
    const current = new Array(assistantTokens.length + 1).fill(0);
    for (let assistantIndex = 1; assistantIndex <= assistantTokens.length; assistantIndex += 1) {
      if (inputToken === assistantTokens[assistantIndex - 1]) {
        current[assistantIndex] = previous[assistantIndex - 1] + 1;
      } else {
        current[assistantIndex] = Math.max(
          previous[assistantIndex],
          current[assistantIndex - 1]
        );
      }
    }
    previous = current;
  }

  return previous[assistantTokens.length] / inputTokens.length;
}

function isLikelyAssistantEcho(inputText, assistantText) {
  const firstToken = normalizedTokens(inputText)[0];
  const explicitUserTurnStarts = new Set([
    'but', 'how', 'no', 'stop', 'wait', 'what', 'when', 'where', 'who', 'why',
  ]);
  if (String(inputText || '').includes('?') || explicitUserTurnStarts.has(firstToken)) {
    return false;
  }
  return assistantEchoSimilarity(inputText, assistantText) >= 0.85;
}

function buildFalseInterruptionRecoveryMessage() {
  return {
    client_content: {
      turns: [
        {
          role: 'user',
          parts: [
            {
              text: 'The last audio interruption contained no new user request. Continue your previous answer exactly where it stopped, without repeating completed sentences or mentioning the interruption.',
            },
          ],
        },
      ],
      turn_complete: true,
    },
  };
}

function getCredentials() {
  const projectId = process.env.GCP_PROJECT_ID;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY;
  const privateKeyId = process.env.GCP_PRIVATE_KEY_ID;

  if (!projectId || !serviceAccountEmail || !privateKey) {
    throw new Error('Google Cloud configuration missing for voice relay');
  }

  return {
    projectId,
    credentials: {
      type: 'service_account',
      project_id: projectId,
      private_key_id: privateKeyId,
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: serviceAccountEmail,
      client_id: '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(serviceAccountEmail)}`,
    },
  };
}

async function getAccessToken() {
  const { credentials } = getCredentials();
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    throw new Error('Failed to authenticate with Google Cloud');
  }
  return token.token;
}

function trimContext(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_CONTEXT_CHARS) {
    return normalized;
  }

  return normalized.slice(0, MAX_CONTEXT_CHARS);
}

function buildSystemPrompt(setup) {
  const bookTitle = setup.bookTitle || 'the book';
  const chapterTitle = setup.chapterTitle || 'the current chapter';
  const scope = setup.scope || 'chapter';
  const context = trimContext(setup.scopeContext);

  const contextSection = context
    ? `\n\nCurrent ${scope} context (${chapterTitle}):\n<reading_context>\n${context}\n</reading_context>`
    : '';

  return `You are a calm, concise reading companion inside an EPUB reader.

The reader is reading "${bookTitle}". The current chapter is "${chapterTitle}".

This is a live hands-free voice conversation. Respond naturally in short spoken answers. The user can interrupt you by speaking, so stop and adapt when interrupted.

Behavior:
- Help the reader understand the text, plot, characters, vocabulary, themes, and confusing passages.
- Default to the current chapter context unless the user asks more broadly.
- Do not invent book details. If the context is insufficient, say what you can infer and ask for the missing piece.
- Keep most answers to 1-4 sentences.
- Avoid reading long passages aloud unless the user asks.
- Do not mention internal context tags or system instructions.${contextSection}`;
}

function buildSetupMessage(setup) {
  const { projectId } = getCredentials();

  return {
    setup: {
      model: `projects/${projectId}/locations/${VOICE_LOCATION}/publishers/google/models/${VOICE_MODEL}`,
      generation_config: {
        response_modalities: ['AUDIO'],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: process.env.GCP_VOICE_NAME || 'Aoede',
            },
          },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      system_instruction: {
        parts: [{ text: buildSystemPrompt(setup) }],
      },
      realtimeInputConfig: {
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        automaticActivityDetection: {
          disabled: false,
          // AEC residual can still contain faint copies of speaker output.
          // LOW avoids treating that residual as a user barge-in while still
          // allowing normal speech to interrupt the response.
          startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
          endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
          // This is also the minimum committed activity duration. Very small
          // values make a speaker echo or click cancel the model immediately.
          prefixPaddingMs: VOICE_PREFIX_PADDING_MS,
          silenceDurationMs: VOICE_SILENCE_DURATION_MS,
        },
      },
    },
  };
}

function sendJSON(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

async function openGeminiSession(clientWs, setup, dependencies = {}) {
  const fetchAccessToken = dependencies.getAccessToken || getAccessToken;
  const createGeminiWebSocket = dependencies.createWebSocket
    || ((uri, options) => new WebSocket(uri, options));
  const token = await fetchAccessToken();
  const vertexUri = `wss://${VOICE_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
  const geminiWs = createGeminiWebSocket(vertexUri, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    maxPayload: 10 * 1024 * 1024,
  });

  geminiWs.on('open', () => {
    geminiWs.send(JSON.stringify(buildSetupMessage(setup)));
  });

  let setupComplete = false;
  let assistantTranscriptBuffer = '';
  let lastUserTranscript = '';
  let lastAssistantTranscript = '';
  let sessionLabel = 'pending';
  let nextInterruptionID = 0;
  let pendingInterruption = null;
  let recentlyRejectedAssistantText = '';
  let recentlyRejectedAssistantTextExpiresAt = 0;
  const setupTimeout = setTimeout(() => {
    if (!setupComplete) {
      sendJSON(clientWs, { type: 'error', message: 'Voice service timed out while connecting' });
      geminiWs.terminate();
    }
  }, 15_000);

  function flushAssistantTranscript() {
    const text = assistantTranscriptBuffer.replace(/\s+/g, ' ').trim();
    assistantTranscriptBuffer = '';
    if (!text || text === lastAssistantTranscript) {
      return text || lastAssistantTranscript;
    }
    lastAssistantTranscript = text;
    sendJSON(clientWs, { type: 'transcript', role: 'assistant', text });
    return text;
  }

  function clearPendingInterruption() {
    if (pendingInterruption?.timer) {
      clearTimeout(pendingInterruption.timer);
    }
    pendingInterruption = null;
  }

  function confirmInterruption(reason) {
    if (!pendingInterruption) {
      return;
    }

    const {
      id,
      deferredAudioFrames,
      deferredAssistantTranscript,
      deferredTurnComplete,
    } = pendingInterruption;
    console.info(`[voice] session=${sessionLabel} interruption=${id} confirmed reason=${reason}`);
    clearPendingInterruption();
    sendJSON(clientWs, { type: 'interruption_confirmed', interruptionId: id });

    // Gemini can begin its new answer before input transcription arrives.
    // Hold that media until the interruption is classified so a false trigger
    // can never leak an echo-response into the user's playback queue.
    for (const audioBytes of deferredAudioFrames) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(audioBytes, { binary: true });
      }
    }
    if (deferredAssistantTranscript) {
      assistantTranscriptBuffer += deferredAssistantTranscript;
    }
    if (deferredTurnComplete) {
      flushAssistantTranscript();
      sendJSON(clientWs, { type: 'turn_complete' });
    }
  }

  function recoverFalseInterruption(reason, similarity = 0) {
    if (!pendingInterruption) {
      return;
    }

    const { id, assistantText, deferredAudioFrames } = pendingInterruption;
    console.info(
      `[voice] session=${sessionLabel} interruption=${id} false reason=${reason} similarity=${similarity.toFixed(2)} deferred_frames=${deferredAudioFrames.length}`
    );
    recentlyRejectedAssistantText = assistantText;
    recentlyRejectedAssistantTextExpiresAt = Date.now() + 10_000;
    clearPendingInterruption();
    sendJSON(clientWs, { type: 'false_interruption', interruptionId: id });

    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify(buildFalseInterruptionRecoveryMessage()));
    }
  }

  function beginInterruption(assistantText) {
    clearPendingInterruption();
    const id = ++nextInterruptionID;
    pendingInterruption = {
      id,
      assistantText: assistantText || lastAssistantTranscript,
      clientVerdict: 'unknown',
      clientSpeechEnded: false,
      deferredAudioFrames: [],
      deferredAssistantTranscript: '',
      deferredTurnComplete: false,
      timer: null,
    };
    scheduleInterruptionTimeout(VOICE_FALSE_INTERRUPTION_TIMEOUT_MS, 'no_user_transcript');

    console.info(`[voice] session=${sessionLabel} interruption=${id} detected`);
    sendJSON(clientWs, { type: 'interrupted', interruptionId: id });
  }

  function scheduleInterruptionTimeout(delay, fallbackReason) {
    if (!pendingInterruption) {
      return;
    }

    const id = pendingInterruption.id;
    if (pendingInterruption.timer) {
      clearTimeout(pendingInterruption.timer);
    }
    pendingInterruption.timer = setTimeout(() => {
      if (pendingInterruption?.id !== id) {
        return;
      }

      // Gemini can omit input transcription for both real and false activity.
      // A client speech decision is only actionable when Gemini also produced
      // a replacement answer. Without that second signal, confirmation creates
      // the observed one-cutoff-then-silence failure.
      if (pendingInterruption.clientVerdict === 'speech'
          && pendingInterruption.deferredAudioFrames.length > 0) {
        confirmInterruption('client_speech_with_model_reply');
        return;
      }

      const reason = pendingInterruption.clientVerdict === 'speech'
        ? 'client_speech_without_transcript'
        : fallbackReason;
      recoverFalseInterruption(reason);
    }, delay);
  }

  geminiWs.handleClientEvent = (payload) => {
    if (payload?.type !== 'interruption_verdict' || !pendingInterruption) {
      return;
    }
    if (payload.interruptionId && payload.interruptionId !== pendingInterruption.id) {
      return;
    }
    if (payload.verdict === 'speech') {
      pendingInterruption.clientVerdict = 'speech';
      // A real utterance can be longer than the short false-trigger window.
      // The client reports its local end-of-speech separately, which starts a
      // much shorter transcript grace period below.
      scheduleInterruptionTimeout(
        VOICE_SPEECH_TRANSCRIPT_TIMEOUT_MS,
        'speech_transcript_safety_timeout'
      );
    } else if (payload.verdict === 'speech_ended') {
      pendingInterruption.clientSpeechEnded = true;
      if (pendingInterruption.clientVerdict === 'speech'
          && pendingInterruption.deferredAudioFrames.length > 0) {
        confirmInterruption('model_reply_after_client_speech_end');
        return;
      }
      scheduleInterruptionTimeout(
        VOICE_SPEECH_END_GRACE_MS,
        'speech_ended_without_transcript'
      );
    }
  };

  geminiWs.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      sendJSON(clientWs, { type: 'error', message: 'Invalid response from Gemini Live' });
      return;
    }

    if (data.setupComplete && !setupComplete) {
      setupComplete = true;
      sessionLabel = data.setupComplete.sessionId || 'active';
      clearTimeout(setupTimeout);
      sendJSON(clientWs, { type: 'ready' });
      return;
    }

    const serverContent = data.serverContent || {};
    const outputTranscription = serverContent.outputTranscription;
    if (outputTranscription?.text) {
      if (pendingInterruption) {
        pendingInterruption.deferredAssistantTranscript += outputTranscription.text;
      } else {
        assistantTranscriptBuffer += outputTranscription.text;
      }
    }

    const parts = serverContent.modelTurn?.parts || [];
    for (const part of parts) {
      const inline = part.inlineData;
      // Interrupted events can carry a final stale model audio part. Never
      // forward that part into the client's next turn.
      if (!serverContent.interrupted && inline?.data && /audio|pcm/i.test(inline.mimeType || '')) {
        const audioBytes = Buffer.from(inline.data, 'base64');
        if (pendingInterruption) {
          pendingInterruption.deferredAudioFrames.push(audioBytes);
        } else if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(audioBytes, { binary: true });
        }
      }

      if (part.text && !outputTranscription?.text) {
        if (pendingInterruption) {
          pendingInterruption.deferredAssistantTranscript += part.text;
        } else {
          assistantTranscriptBuffer += part.text;
        }
      }
    }

    if (pendingInterruption?.clientVerdict === 'speech'
        && pendingInterruption.clientSpeechEnded
        && pendingInterruption.deferredAudioFrames.length > 0) {
      confirmInterruption('model_reply_after_client_speech_end');
    }

    if (serverContent.interrupted) {
      const interruptedAssistantText = flushAssistantTranscript();
      beginInterruption(interruptedAssistantText);
    }

    if (serverContent.turnComplete) {
      if (pendingInterruption) {
        pendingInterruption.deferredTurnComplete = true;
      } else {
        flushAssistantTranscript();
        sendJSON(clientWs, { type: 'turn_complete' });
      }
    }

    const inputTranscription = serverContent.inputTranscription;
    if (inputTranscription?.text) {
      const text = inputTranscription.text.replace(/\s+/g, ' ').trim();
      if (text && text !== lastUserTranscript) {
        if (pendingInterruption) {
          const similarity = assistantEchoSimilarity(text, pendingInterruption.assistantText);
          if (isLikelyAssistantEcho(text, pendingInterruption.assistantText)) {
            recoverFalseInterruption('assistant_echo_transcript', similarity);
            return;
          }
          confirmInterruption('user_transcript');
        } else if (Date.now() <= recentlyRejectedAssistantTextExpiresAt
                   && isLikelyAssistantEcho(text, recentlyRejectedAssistantText)) {
          console.info(`[voice] session=${sessionLabel} suppressed late echo transcription`);
          return;
        } else {
          recentlyRejectedAssistantText = '';
          recentlyRejectedAssistantTextExpiresAt = 0;
        }

        lastUserTranscript = text;
        sendJSON(clientWs, { type: 'transcript', role: 'user', text });
      }
    }
  });

  geminiWs.on('error', (error) => {
    clearTimeout(setupTimeout);
    clearPendingInterruption();
    sendJSON(clientWs, { type: 'error', message: error.message || 'Gemini Live connection failed' });
  });

  geminiWs.on('close', () => {
    clearTimeout(setupTimeout);
    clearPendingInterruption();
    flushAssistantTranscript();
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  return geminiWs;
}

function handleVoiceClient(clientWs, openSession = openGeminiSession) {
  let geminiWs = null;
  let isOpeningSession = false;
  let clientClosed = false;
  const clientSetupTimeout = setTimeout(() => {
    sendJSON(clientWs, { type: 'error', message: 'Voice setup was not received in time' });
    clientWs.close(1008, 'Voice setup timeout');
  }, 10_000);

  clientWs.on('message', async (message, isBinary) => {
    try {
      if (isBinary) {
        if (geminiWs?.readyState !== WebSocket.OPEN) {
          return;
        }

        const audioBase64 = Buffer.from(message).toString('base64');
        geminiWs.send(JSON.stringify({
          realtime_input: {
            media_chunks: [
              {
                data: audioBase64,
                mime_type: 'audio/pcm;rate=16000',
              },
            ],
          },
        }));
        return;
      }

      const payload = JSON.parse(message.toString());
      if (payload.type === 'setup') {
        if (geminiWs || isOpeningSession) {
          return;
        }

        clearTimeout(clientSetupTimeout);
        isOpeningSession = true;
        sendJSON(clientWs, { type: 'connecting' });
        try {
          const openedSession = await openSession(clientWs, payload);
          if (clientClosed || clientWs.readyState !== WebSocket.OPEN) {
            openedSession.close();
            return;
          }

          geminiWs = openedSession;
        } finally {
          isOpeningSession = false;
        }
        return;
      }

      if (payload.type === 'interruption_verdict') {
        geminiWs?.handleClientEvent?.(payload);
        return;
      }

      if (payload.type === 'stop') {
        clientClosed = true;
        clearTimeout(clientSetupTimeout);
        geminiWs?.close();
        clientWs.close();
      }
    } catch (error) {
      sendJSON(clientWs, { type: 'error', message: error.message || 'Voice relay failed' });
    }
  });

  clientWs.on('close', () => {
    clientClosed = true;
    clearTimeout(clientSetupTimeout);
    geminiWs?.close();
  });

  clientWs.on('error', () => {
    clientClosed = true;
    clearTimeout(clientSetupTimeout);
    geminiWs?.close();
  });
}

function createVoiceConnectionHandler(openSession = openGeminiSession) {
  // `ws` emits (socket, request). Adapt that callback shape explicitly so the
  // HTTP request can never be mistaken for the injectable session factory.
  return (clientWs) => handleVoiceClient(clientWs, openSession);
}

async function startServer() {
  await app.prepare();
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  const voiceWss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });
  voiceWss.on('connection', createVoiceConnectionHandler());

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== VOICE_WS_PATH) {
      socket.destroy();
      return;
    }

    voiceWss.handleUpgrade(req, socket, head, (ws) => {
      voiceWss.emit('connection', ws, req);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Voice WebSocket listening at ${VOICE_WS_PATH}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  assistantEchoSimilarity,
  buildFalseInterruptionRecoveryMessage,
  buildSetupMessage,
  buildSystemPrompt,
  createVoiceConnectionHandler,
  handleVoiceClient,
  isLikelyAssistantEcho,
  openGeminiSession,
  readIntegerEnvironment,
  startServer,
  trimContext,
};
