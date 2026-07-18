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
console.log('Music critique parser and display tests passed.');
