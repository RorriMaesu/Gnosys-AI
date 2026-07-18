const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const source = fs.readFileSync('assets/llm-router.js', 'utf8');
const storage = new Map([
    ['gnosys_llm_route_mode', 'desktop-ollama'],
    ['gnosys_active_llm', 'gemma4:12b'],
]);
const requests = [];
let scenario = 'structured-fallback';
let gemmaAttempts = 0;

function response(payload, status = 200, body = null) {
    return {
        ok: status >= 200 && status < 300,
        status,
        body,
        headers: { get: () => null },
        json: async () => payload,
        text: async () => JSON.stringify(payload),
    };
}

function validCritique() {
    return JSON.stringify({
        scores: { mnemonic: 80, rhythm: 81, accuracy: 82, rhyme: 83 },
        annotations: [{
            startLine: 1,
            endLine: 2,
            category: 'rhythm',
            message: 'Tighten the meter.',
            suggestion: 'Use fewer syllables.',
        }],
        chatResponse: 'The main opportunity is a more consistent meter.',
    });
}

async function fetchMock(url, init = {}) {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url: String(url), body });
    if (String(url).endsWith('/api/tags')) {
        return response({ models: [
            { name: 'gemma4:12b' },
            { name: 'qwen2.5:1.5b' },
        ] });
    }
    if (String(url).endsWith('/api/accelerator/acquire')) {
        return response({
            status: 'success',
            accelerator: {
                owner: 'llm',
                ace: { online: false },
                ollama: { online: true, models: [] },
                gpu: { used_mb: 900, free_mb: 15000 },
            },
        });
    }
    if (String(url).endsWith('/api/generate')) return response({ done: true });
    if (!String(url).endsWith('/api/chat')) throw new Error(`Unexpected URL: ${url}`);

    if (scenario === 'structured-fallback') {
        if (body.model === 'gemma4:12b') {
            return response({
                done: true,
                done_reason: 'stop',
                message: { content: '', thinking: 'hidden reasoning consumed the visible answer' },
                prompt_eval_count: 2000,
                eval_count: 500,
            });
        }
        return response({
            done: true,
            done_reason: 'stop',
            message: { content: validCritique(), thinking: '' },
            prompt_eval_count: 2000,
            eval_count: 300,
        });
    }

    if (scenario === 'thinking-retry') {
        gemmaAttempts++;
        if (gemmaAttempts === 1) {
            return response({
                done: true,
                done_reason: 'length',
                message: { content: '', thinking: 'x'.repeat(400) },
                prompt_eval_count: 300,
                eval_count: 1024,
            });
        }
        return response({
            done: true,
            done_reason: 'stop',
            message: { content: '<chat_response>Recovered without hidden thinking.</chat_response>', thinking: '' },
            prompt_eval_count: 300,
            eval_count: 30,
        });
    }

    if (scenario === 'token-limit') {
        return response({
            done: true,
            done_reason: 'length',
            message: { content: '{"scores": {', thinking: '' },
            prompt_eval_count: 2000,
            eval_count: 4096,
        });
    }

    throw new Error(`Unknown scenario: ${scenario}`);
}

const documentMock = {
    readyState: 'loading',
    addEventListener() {},
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
        return {
            style: {},
            classList: { add() {}, remove() {}, toggle() {} },
            appendChild() {},
            addEventListener() {},
            click() {},
            remove() {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
        };
    },
    head: { appendChild() {} },
    body: { appendChild() {} },
};
const windowMock = {
    location: { hostname: 'rorrimaesu.github.io', pathname: '/Gnosys-AI/music/index.html' },
    addEventListener() {},
    dispatchEvent() {},
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
};
windowMock.parent = windowMock;

const context = {
    window: windowMock,
    document: documentMock,
    navigator: { userAgent: 'Microsoft Edge on Windows', storage: {} },
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key),
    },
    fetch: fetchMock,
    console: { log() {}, info() {}, warn() {}, error: console.error },
    AbortSignal,
    TextDecoder,
    TextEncoder,
    ReadableStream,
    Blob,
    performance,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    CustomEvent: class CustomEvent {
        constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    Event: class Event {},
    queueMicrotask,
    setTimeout,
    clearTimeout,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'llm-router.js' });

(async () => {
    const schema = { type: 'object', properties: { scores: { type: 'object' } } };
    const recovered = await windowMock.GnosysLLM.generateResponse('system', 'critique', {
        stream: false,
        structuredResponse: true,
        responseFormat: schema,
        think: false,
        ollamaOptions: { num_predict: 4096 },
        history: [],
    });
    assert.equal(recovered.model, 'qwen2.5:1.5b');
    assert.equal(recovered.recoveredFrom, 'gemma4:12b');
    assert.equal(storage.get('gnosys_active_llm'), 'gemma4:12b', 'Transient fallback must not replace the selected model.');
    const firstChat = requests.find(item => item.url.endsWith('/api/chat'));
    assert.equal(firstChat.body.think, false);
    assert.equal(firstChat.body.options.num_predict, 4096);
    assert.deepEqual(firstChat.body.format, schema);

    const diagnostics = windowMock.GnosysLLM.getDiagnostics();
    assert.ok(diagnostics.some(event => event.type === 'ollama_response' && event.thinkingLength > 0));
    assert.ok(diagnostics.some(event => event.type === 'model_fallback' && event.fallbackModel === 'qwen2.5:1.5b'));
    assert.ok(diagnostics.every(event => !Object.prototype.hasOwnProperty.call(event, 'content')));

    scenario = 'thinking-retry';
    gemmaAttempts = 0;
    const retried = await windowMock.GnosysLLM.generateResponse('system', 'chat', {
        stream: false,
        ollamaOptions: { num_predict: 1024 },
    });
    assert.equal(retried.model, 'gemma4:12b');
    assert.equal(gemmaAttempts, 2);
    assert.ok(windowMock.GnosysLLM.getDiagnostics().some(event => event.type === 'model_retry' && event.strategy === 'disable_thinking'));

    scenario = 'token-limit';
    await assert.rejects(
        windowMock.GnosysLLM.generateResponse('system', 'critique', {
            stream: false,
            structuredResponse: true,
            responseFormat: schema,
            think: false,
            ollamaOptions: { num_predict: 4096 },
        }),
        error => error.code === 'OLLAMA_TOKEN_LIMIT' && Boolean(error.traceId)
    );

    console.log('LLM router diagnostics and recovery tests passed.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
