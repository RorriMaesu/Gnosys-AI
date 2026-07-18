const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('music/music-studio.js', 'utf8');
const parserStart = source.indexOf('    function stripJsonComments');
const parserEnd = source.indexOf('    function renderCritiqueDashboard', parserStart);
const displayStart = source.indexOf('    function parseChatResponse');
const displayEnd = source.indexOf('    function parseEditLyrics', displayStart);
assert.ok(parserStart > 0 && parserEnd > parserStart, 'Could not locate critique parser functions.');
assert.ok(displayStart > 0 && displayEnd > displayStart, 'Could not locate assistant display functions.');

const testSource = `
${source.slice(parserStart, parserEnd)}
${source.slice(displayStart, displayEnd)}
this.parseCritiqueData = parseCritiqueData;
this.getAssistantDisplayText = getAssistantDisplayText;
this.attachCritiqueSourceText = attachCritiqueSourceText;
`;
const context = { console: { error() {} } };
vm.createContext(context);
vm.runInContext(testSource, context, { filename: 'music-critique-parser.js' });

const directJson = JSON.stringify({
    scores: { mnemonic: 91, rhythm: 82, accuracy: 103, rhyme: 76 },
    annotations: [{
        startLine: 2,
        endLine: 3,
        category: 'rhythm',
        message: 'Balance the {internal} phrase.',
        suggestion: 'Shorten it.',
    }],
    chatResponse: 'Tighten the meter first.',
});
const valid = context.parseCritiqueData(directJson);
assert.equal(valid.scores.accuracy, 100);
assert.equal(valid.annotations[0].message, 'Balance the {internal} phrase.');
assert.equal(context.getAssistantDisplayText(directJson, valid), 'Tighten the meter first.');

const legacyTagged = context.parseCritiqueData(`<critique_data>{
  "scores": {
    "mnemonic": 60, // helpful score
    "rhythm": 61,
    "accuracy": 62,
    "rhyme": 63,
  },
  "annotations": [{
    "startLine": 1,
    "endLine": 1,
    "category": "rhyme",
    "message": "Add a rhyme.",
    "suggestion": "Try a matching ending."
  }],
}</critique_data>`);
assert.equal(legacyTagged.scores.rhyme, 63);

assert.equal(context.parseCritiqueData('{"scores":{"mnemonic":1}}'), null);

// Line clamping, category fallback, number-prefix stripping, and the
// 12-annotation cap must be enforced client-side because Ollama's structured
// outputs only guarantee JSON shape, not numeric bounds.
const boundsJson = JSON.stringify({
    scores: { mnemonic: 50, rhythm: 50, accuracy: 50, rhyme: 50 },
    justifications: { mnemonic: 'dense', rhythm: 'even', accuracy: 'checked', rhyme: 'paired' },
    annotations: [
        { startLine: 8, endLine: 120, category: 'vibes', message: 'Clamp and relabel me.', suggestion: '9| Keep this line' },
        { startLine: 99, endLine: 200, category: 'rhythm', message: 'I am past the end of the document.' },
        ...Array.from({ length: 14 }, (_, i) => ({ startLine: 1, endLine: 1, category: 'rhyme', message: `extra ${i}` })),
    ],
    chatResponse: 'ok',
});
const bounded = context.parseCritiqueData(boundsJson, 10);
assert.equal(bounded.annotations[0].endLine, 10);
assert.equal(bounded.annotations[0].category, 'general');
assert.equal(bounded.annotations[0].suggestion, 'Keep this line');
assert.equal(bounded.annotations.length, 12);
assert.ok(!bounded.annotations.some(a => a.startLine > 10));
assert.equal(bounded.justifications.rhythm, 'even');

// Without a line count (legacy callers), no clamping is applied.
const unclamped = context.parseCritiqueData(boundsJson);
assert.equal(unclamped.annotations[0].endLine, 120);

// Source-text capture for the stale-apply guard.
const lyrics = ['[Verse]', 'alpha', 'beta', 'gamma'].join('\n');
const withSource = context.attachCritiqueSourceText(
    { annotations: [{ startLine: 2, endLine: 3 }] },
    lyrics,
);
assert.equal(withSource.annotations[0].sourceText, 'alpha\nbeta');

console.log('Music critique parser and display tests passed.');
