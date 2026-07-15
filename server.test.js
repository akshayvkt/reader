const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { WebSocket } = require('ws');

process.env.GCP_PROJECT_ID = 'voice-test-project';
process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'voice-test@example.com';
process.env.GCP_PRIVATE_KEY = 'not-a-real-key';
process.env.GCP_VOICE_FALSE_INTERRUPTION_TIMEOUT_MS = '500';
process.env.GCP_VOICE_SPEECH_END_GRACE_MS = '500';

const {
  assistantEchoSimilarity,
  buildFalseInterruptionRecoveryMessage,
  buildSetupMessage,
  createVoiceConnectionHandler,
  handleVoiceClient,
  isLikelyAssistantEcho,
  openGeminiSession,
  readIntegerEnvironment,
  trimContext,
} = require('./server');

class FakeWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = WebSocket.OPEN;
    this.sent = [];
    this.closeCalls = [];
  }

  send(message) {
    this.sent.push(message);
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = WebSocket.CLOSED;
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function nextEventLoopTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function decodedJSONMessages(socket) {
  return socket.sent
    .filter((message) => typeof message === 'string')
    .map((message) => JSON.parse(message));
}

test('voice setup rejects echo residual without disabling barge-in', () => {
  const message = buildSetupMessage({ bookTitle: 'Test Book' });
  const realtime = message.setup.realtimeInputConfig;
  const detection = realtime.automaticActivityDetection;

  assert.equal(realtime.activityHandling, 'START_OF_ACTIVITY_INTERRUPTS');
  assert.equal(detection.disabled, false);
  assert.equal(detection.startOfSpeechSensitivity, 'START_SENSITIVITY_LOW');
  assert.equal(detection.endOfSpeechSensitivity, 'END_SENSITIVITY_LOW');
  assert.equal(detection.prefixPaddingMs, 300);
  assert.equal(detection.silenceDurationMs, 600);
});

test('assistant echo detection recognizes a partial replay without matching unrelated speech', () => {
  const assistant = 'The character leaves the village because she no longer trusts the council.';
  const echoedInput = 'because she no longer trusts the council';
  const userInput = 'Why did her brother stay behind?';

  assert.ok(assistantEchoSimilarity(echoedInput, assistant) >= 0.8);
  assert.equal(isLikelyAssistantEcho(echoedInput, assistant), true);
  assert.equal(isLikelyAssistantEcho('the character', assistant), true);
  assert.equal(isLikelyAssistantEcho(userInput, assistant), false);
  assert.equal(isLikelyAssistantEcho('yes', assistant), false);
  assert.equal(
    isLikelyAssistantEcho(
      'Why does she no longer trust the council?',
      'She leaves because she no longer trusts the council.'
    ),
    false
  );
});

test('false interruption recovery asks Gemini to continue without exposing a user transcript', () => {
  const message = buildFalseInterruptionRecoveryMessage();
  const turn = message.client_content.turns[0];

  assert.equal(turn.role, 'user');
  assert.equal(message.client_content.turn_complete, true);
  assert.match(turn.parts[0].text, /Continue your previous answer/);
});

test('voice timing environment values are bounded', () => {
  process.env.TEST_VOICE_TIMING = '-10';
  assert.equal(readIntegerEnvironment('TEST_VOICE_TIMING', 50, 20, 500), 20);

  process.env.TEST_VOICE_TIMING = '900';
  assert.equal(readIntegerEnvironment('TEST_VOICE_TIMING', 50, 20, 500), 500);

  process.env.TEST_VOICE_TIMING = 'invalid';
  assert.equal(readIntegerEnvironment('TEST_VOICE_TIMING', 50, 20, 500), 50);
});

test('book context remains bounded before opening a live session', () => {
  const oversized = `  ${'word '.repeat(20_000)}  `;
  assert.equal(trimContext(oversized).length, 70_000);
});

test('WebSocket request argument cannot replace the Gemini session factory', async () => {
  const client = new FakeWebSocket();
  const gemini = { close() {} };
  let openCalls = 0;
  const onConnection = createVoiceConnectionHandler(async () => {
    openCalls += 1;
    return gemini;
  });

  // This is the real `ws` connection-listener shape: (socket, request).
  onConnection(client, { headers: { host: 'reader.test' } });
  client.emit('message', Buffer.from(JSON.stringify({ type: 'setup' })), false);
  await nextEventLoopTurn();

  assert.equal(openCalls, 1);
  assert.equal(
    client.sent.some((message) => String(message).includes('openSession is not a function')),
    false
  );
  client.emit('close');
});

test('only one Gemini session can open for a voice client', async () => {
  const client = new FakeWebSocket();
  const opening = deferred();
  const gemini = { close() {} };
  let openCalls = 0;

  handleVoiceClient(client, async () => {
    openCalls += 1;
    return opening.promise;
  });

  const setup = Buffer.from(JSON.stringify({ type: 'setup', bookTitle: 'Test' }));
  client.emit('message', setup, false);
  client.emit('message', setup, false);

  assert.equal(openCalls, 1);
  opening.resolve(gemini);
  await nextEventLoopTurn();
  client.emit('close');
});

test('client interruption verdict is forwarded only to the active Gemini session', async () => {
  const client = new FakeWebSocket();
  const receivedEvents = [];
  const gemini = {
    close() {},
    handleClientEvent(payload) {
      receivedEvents.push(payload);
    },
  };

  handleVoiceClient(client, async () => gemini);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'setup' })), false);
  await nextEventLoopTurn();
  client.emit(
    'message',
    Buffer.from(JSON.stringify({
      type: 'interruption_verdict',
      interruptionId: 3,
      verdict: 'speech',
    })),
    false
  );

  assert.deepEqual(receivedEvents, [
    { type: 'interruption_verdict', interruptionId: 3, verdict: 'speech' },
  ]);
  client.emit('close');
});

test('echo-triggered model output is quarantined and discarded before recovery', async () => {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  await openGeminiSession(client, { bookTitle: 'Test Book' }, {
    getAccessToken: async () => 'test-token',
    createWebSocket: () => gemini,
  });

  gemini.emit('open');
  gemini.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      outputTranscription: {
        text: 'The character leaves because she no longer trusts the council.',
      },
      interrupted: true,
    },
  })));

  const unwantedReply = Buffer.from('reply-to-echo');
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: 'audio/pcm;rate=24000',
            data: unwantedReply.toString('base64'),
          },
        }],
      },
      outputTranscription: { text: 'A wrong answer to the echo.' },
      turnComplete: true,
    },
  })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      inputTranscription: { text: 'because she no longer trusts the council' },
    },
  })));

  const events = decodedJSONMessages(client);
  assert.ok(events.some((event) => event.type === 'interrupted'));
  assert.ok(events.some((event) => event.type === 'false_interruption'));
  assert.equal(client.sent.some((message) => Buffer.isBuffer(message) && message.equals(unwantedReply)), false);
  assert.equal(events.some((event) => event.type === 'turn_complete'), false);
  assert.equal(events.some((event) => event.role === 'user'), false);

  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      inputTranscription: { text: 'because she no longer trusts the council' },
    },
  })));
  assert.equal(decodedJSONMessages(client).some((event) => event.role === 'user'), false);

  const recovery = decodedJSONMessages(gemini).at(-1);
  assert.match(recovery.client_content.turns[0].parts[0].text, /Continue your previous answer/);
  gemini.emit('close');
});

test('a genuine interruption is confirmed before its quarantined reply is released', async () => {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  await openGeminiSession(client, { bookTitle: 'Test Book' }, {
    getAccessToken: async () => 'test-token',
    createWebSocket: () => gemini,
  });

  gemini.emit('open');
  gemini.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      outputTranscription: { text: 'The character is leaving the village.' },
      interrupted: true,
    },
  })));

  const genuineReply = Buffer.from('reply-to-user');
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: 'audio/pcm;rate=24000',
            data: genuineReply.toString('base64'),
          },
        }],
      },
      outputTranscription: { text: 'Her brother stayed to protect the others.' },
      turnComplete: true,
      inputTranscription: { text: 'Why did her brother stay behind?' },
    },
  })));

  const confirmationIndex = client.sent.findIndex((message) => (
    typeof message === 'string' && JSON.parse(message).type === 'interruption_confirmed'
  ));
  const replyIndex = client.sent.findIndex((message) => (
    Buffer.isBuffer(message) && message.equals(genuineReply)
  ));
  const events = decodedJSONMessages(client);

  assert.ok(confirmationIndex >= 0);
  assert.ok(replyIndex > confirmationIndex);
  assert.ok(events.some((event) => event.type === 'turn_complete'));
  assert.ok(events.some((event) => event.role === 'user' && /brother/.test(event.text)));
  assert.ok(events.some((event) => event.role === 'assistant' && /protect/.test(event.text)));
  gemini.emit('close');
});

test('client speech plus a replacement answer confirms even without input transcription', async () => {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  await openGeminiSession(client, { bookTitle: 'Test Book' }, {
    getAccessToken: async () => 'test-token',
    createWebSocket: () => gemini,
  });

  gemini.emit('open');
  gemini.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      outputTranscription: { text: 'The character is leaving the village.' },
      interrupted: true,
    },
  })));
  gemini.handleClientEvent({ type: 'interruption_verdict', interruptionId: 1, verdict: 'speech' });
  gemini.handleClientEvent({ type: 'interruption_verdict', interruptionId: 1, verdict: 'speech_ended' });

  const genuineReply = Buffer.from('native-audio-reply');
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: 'audio/pcm;rate=24000',
            data: genuineReply.toString('base64'),
          },
        }],
      },
    },
  })));

  const confirmationIndex = client.sent.findIndex((message) => (
    typeof message === 'string' && JSON.parse(message).type === 'interruption_confirmed'
  ));
  const replyIndex = client.sent.findIndex((message) => (
    Buffer.isBuffer(message) && message.equals(genuineReply)
  ));
  assert.ok(confirmationIndex >= 0);
  assert.ok(replyIndex > confirmationIndex);
  gemini.emit('close');
});

test('client speech without a transcript or replacement answer recovers instead of going silent', async () => {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  await openGeminiSession(client, { bookTitle: 'Test Book' }, {
    getAccessToken: async () => 'test-token',
    createWebSocket: () => gemini,
  });

  gemini.emit('open');
  gemini.emit('message', Buffer.from(JSON.stringify({ setupComplete: {} })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      outputTranscription: { text: 'The character is leaving the village.' },
      interrupted: true,
    },
  })));
  gemini.handleClientEvent({ type: 'interruption_verdict', interruptionId: 1, verdict: 'speech' });
  gemini.handleClientEvent({ type: 'interruption_verdict', interruptionId: 1, verdict: 'speech_ended' });
  await new Promise((resolve) => setTimeout(resolve, 550));

  const events = decodedJSONMessages(client);
  assert.ok(events.some((event) => event.type === 'false_interruption'));
  assert.equal(events.some((event) => event.type === 'interruption_confirmed'), false);
  gemini.emit('close');
});

test('a Gemini session finishing after its client closes is immediately closed', async () => {
  const client = new FakeWebSocket();
  const opening = deferred();
  let geminiCloseCalls = 0;

  handleVoiceClient(client, async () => opening.promise);
  client.emit('message', Buffer.from(JSON.stringify({ type: 'setup' })), false);
  client.readyState = WebSocket.CLOSED;
  client.emit('close');

  opening.resolve({
    close() {
      geminiCloseCalls += 1;
    },
  });
  await nextEventLoopTurn();

  assert.equal(geminiCloseCalls, 1);
});
