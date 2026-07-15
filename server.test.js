const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { WebSocket } = require('ws');

process.env.GCP_PROJECT_ID = 'voice-test-project';
process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'voice-test@example.com';
process.env.GCP_PRIVATE_KEY = 'not-a-real-key';

const {
  buildSetupMessage,
  createVoiceConnectionHandler,
  handleVoiceClient,
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

test('voice setup rejects echo residual without disabling barge-in', () => {
  const message = buildSetupMessage({ bookTitle: 'Test Book' });
  const realtime = message.setup.realtimeInputConfig;
  const detection = realtime.automaticActivityDetection;

  assert.equal(realtime.activityHandling, 'START_OF_ACTIVITY_INTERRUPTS');
  assert.equal(detection.disabled, false);
  assert.equal(detection.startOfSpeechSensitivity, 'START_SENSITIVITY_LOW');
  assert.equal(detection.endOfSpeechSensitivity, 'END_SENSITIVITY_LOW');
  assert.equal(detection.prefixPaddingMs, 40);
  assert.equal(detection.silenceDurationMs, 600);
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
