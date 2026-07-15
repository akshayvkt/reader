const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { WebSocket } = require('ws');

process.env.GCP_PROJECT_ID = 'voice-test-project';
process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'voice-test@example.com';
process.env.GCP_PRIVATE_KEY = 'not-a-real-key';

const {
  buildSetupMessage,
  buildSystemPrompt,
  createVoiceConnectionHandler,
  handleVoiceClient,
  openGeminiSession,
  trimContext,
} = require('./server');

class FakeWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = WebSocket.OPEN;
    this.sent = [];
    this.closeCalls = [];
    this.terminateCalls = 0;
  }

  send(message) {
    this.sent.push(message);
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = WebSocket.CLOSED;
  }

  terminate() {
    this.terminateCalls += 1;
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

async function createOpenSession() {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  await openGeminiSession(client, { bookTitle: 'Test Book' }, {
    getAccessToken: async () => 'test-token',
    createWebSocket: () => gemini,
  });
  gemini.emit('open');
  gemini.emit('message', Buffer.from(JSON.stringify({
    setupComplete: { sessionId: 'test-session' },
  })));
  return { client, gemini };
}

test('voice setup leaves automatic VAD tuning at Gemini model defaults', () => {
  const message = buildSetupMessage({ bookTitle: 'Test Book' });
  const realtime = message.setup.realtimeInputConfig;

  assert.deepEqual(realtime, {
    activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
    automaticActivityDetection: { disabled: false },
  });
  assert.equal(JSON.stringify(realtime).includes('Sensitivity'), false);
  assert.equal(JSON.stringify(realtime).includes('Padding'), false);
  assert.equal(JSON.stringify(realtime).includes('silenceDuration'), false);
});

test('book context remains bounded and present in the reading prompt', () => {
  const oversized = `  ${'word '.repeat(20_000)}  `;
  assert.equal(trimContext(oversized).length, 70_000);

  const prompt = buildSystemPrompt({
    bookTitle: 'A Test Book',
    chapterTitle: 'Chapter 2',
    scope: 'chapter',
    scopeContext: 'A bounded excerpt.',
  });
  assert.match(prompt, /A Test Book/);
  assert.match(prompt, /Chapter 2/);
  assert.match(prompt, /A bounded excerpt/);
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

test('microphone PCM uses the current realtime_input.audio field', async () => {
  const client = new FakeWebSocket();
  const gemini = new FakeWebSocket();
  handleVoiceClient(client, async () => gemini);

  client.emit('message', Buffer.from(JSON.stringify({ type: 'setup' })), false);
  await nextEventLoopTurn();
  const pcm = Buffer.from([1, 2, 3, 4]);
  client.emit('message', pcm, true);

  const message = JSON.parse(gemini.sent[0]);
  assert.deepEqual(message, {
    realtime_input: {
      audio: {
        data: pcm.toString('base64'),
        mime_type: 'audio/pcm;rate=16000',
      },
    },
  });
  assert.equal('media_chunks' in message.realtime_input, false);
  client.emit('close');
});

test('Gemini audio, transcripts, and completion events are forwarded transparently', async () => {
  const { client, gemini } = await createOpenSession();
  const firstAudio = Buffer.from('first-frame');
  const secondAudio = Buffer.from('second-frame');

  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/pcm;rate=24000',
              data: firstAudio.toString('base64'),
            },
          },
          { text: 'The answer is ' },
          {
            inlineData: {
              mimeType: 'audio/pcm;rate=24000',
              data: secondAudio.toString('base64'),
            },
          },
          { text: 'brief.' },
        ],
      },
      inputTranscription: { text: 'What happened?', finished: true },
      turnComplete: true,
    },
  })));

  const events = decodedJSONMessages(client);
  const binary = client.sent.filter(Buffer.isBuffer);
  assert.deepEqual(binary, [firstAudio, secondAudio]);
  assert.ok(events.some((event) => (
    event.type === 'transcript' && event.role === 'assistant' && event.text === 'The answer is brief.'
  )));
  assert.ok(events.some((event) => (
    event.type === 'transcript' && event.role === 'user' && event.text === 'What happened?'
  )));
  assert.ok(events.some((event) => event.type === 'turn_complete'));
  gemini.emit('close');
});

test('Gemini interruption is final, drops same-message stale audio, and needs no verdict', async () => {
  const { client, gemini } = await createOpenSession();
  const staleAudio = Buffer.from('stale-frame');
  const replacementAudio = Buffer.from('replacement-frame');

  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: 'audio/pcm;rate=24000',
            data: staleAudio.toString('base64'),
          },
        }],
      },
      outputTranscription: { text: 'The interrupted answer.' },
      interrupted: true,
    },
  })));

  let events = decodedJSONMessages(client);
  assert.equal(client.sent.some((message) => Buffer.isBuffer(message) && message.equals(staleAudio)), false);
  assert.ok(events.some((event) => event.type === 'interrupted'));
  assert.equal(events.some((event) => event.role === 'assistant'), false);
  assert.equal(events.some((event) => event.type === 'interruption_confirmed'), false);
  assert.equal(events.some((event) => event.type === 'false_interruption'), false);

  // Transcription messages are independently ordered. An old fragment that
  // arrives after interruption must not become the replacement answer.
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      outputTranscription: { text: ' A late old-turn fragment.' },
    },
  })));
  gemini.emit('message', Buffer.from(JSON.stringify({
    serverContent: {
      // Gemini may finish the barge-in transcript and begin the replacement
      // output transcription in one independently ordered message.
      inputTranscription: { text: 'Wait, explain that.', finished: true },
      modelTurn: {
        parts: [{
          inlineData: {
            mimeType: 'audio/pcm;rate=24000',
            data: replacementAudio.toString('base64'),
          },
        }],
      },
      outputTranscription: { text: 'The replacement answer.', finished: true },
    },
  })));

  assert.equal(
    client.sent.some((message) => Buffer.isBuffer(message) && message.equals(replacementAudio)),
    true
  );
  // The setup message is the relay's only outbound Gemini control message.
  assert.equal(decodedJSONMessages(gemini).length, 1);
  events = decodedJSONMessages(client);
  assert.equal(events.filter((event) => event.type === 'interrupted').length, 1);
  assert.ok(events.some((event) => event.role === 'user' && /Wait/.test(event.text)));
  assert.ok(events.some((event) => (
    event.role === 'assistant' && event.text === 'The replacement answer.'
  )));
  assert.equal(events.some((event) => /late old-turn/.test(event.text || '')), false);
  gemini.emit('close');
});

test('fragmented transcriptions use finished boundaries and allow repeated turns', async () => {
  const { client, gemini } = await createOpenSession();

  function send(serverContent) {
    gemini.emit('message', Buffer.from(JSON.stringify({ serverContent })));
  }

  for (let turn = 0; turn < 2; turn += 1) {
    send({ inputTranscription: { text: 'Repeat' } });
    send({ inputTranscription: { text: ' this.', finished: true } });
    send({ outputTranscription: { text: 'Same' } });
    // Transcription ordering is independent, so turn completion must not
    // prematurely publish a partial transcript.
    send({ turnComplete: true });
    send({ outputTranscription: { text: ' answer.' } });
    send({ outputTranscription: { finished: true } });
  }

  const transcripts = decodedJSONMessages(client).filter((event) => event.type === 'transcript');
  assert.deepEqual(transcripts, [
    { type: 'transcript', role: 'user', text: 'Repeat this.' },
    { type: 'transcript', role: 'assistant', text: 'Same answer.' },
    { type: 'transcript', role: 'user', text: 'Repeat this.' },
    { type: 'transcript', role: 'assistant', text: 'Same answer.' },
  ]);
  gemini.emit('close');
});

test('invalid Gemini payloads and connection errors reach the client', async () => {
  const { client, gemini } = await createOpenSession();

  gemini.emit('message', Buffer.from('not-json'));
  gemini.emit('error', new Error('upstream unavailable'));

  const errors = decodedJSONMessages(client).filter((event) => event.type === 'error');
  assert.ok(errors.some((event) => /Invalid response/.test(event.message)));
  assert.ok(errors.some((event) => /upstream unavailable/.test(event.message)));
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
