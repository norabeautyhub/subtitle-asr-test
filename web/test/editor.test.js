import test from 'node:test';
import assert from 'node:assert/strict';
import { toSinhala, suggestions } from '../src/editor/singlish.js';
import {
  buildLines, setLineText, splitLine, mergeWithNext, deleteLine, setLineTiming,
  activeLineIndex, linesToSrt, linesToVtt, lineStart, lineEnd, lineText, regroup, DEFAULT_STYLE,
} from '../src/editor/model.js';

test('Singlish → සිංහල', () => {
  const cases = {
    kohomada: 'කොහොමද', mama: 'මම', gedhara: 'ගෙදර', api: 'අපි', balanna: 'බලන්න',
    oyaata: 'ඔයාට', shrii: 'ශ්‍රී', lankaava: 'ලංකාව', prashnaya: 'ප්‍රශ්නය', Tika: 'ටික',
    'hello 123': 'හෙල්ලො 123',
  };
  for (const [src, want] of Object.entries(cases)) assert.equal(toSinhala(src), want, src);
});

test('Singlish suggestions', () => {
  assert.ok(suggestions('yanawa').includes('යනවා'));
  assert.ok(suggestions('mata').includes('මට'));
  assert.ok(suggestions('kohomada').length <= 5);
  assert.deepEqual(suggestions(''), []);
});

const W = (text, start, end) => ({ text, start, end });
const words = [
  W('මම', 0, 0.4), W('අද', 0.45, 0.8), W('ගෙදර', 0.85, 1.3), W('යනවා', 1.35, 1.9),
  W('හෙට', 3.0, 3.4), W('එනවා', 3.45, 4.0),
];

test('buildLines: වචන ගණන සහ විරාම අනුව lines', () => {
  const lines = buildLines(words, { maxWords: 4, maxChars: 40 });
  assert.equal(lines.length, 2); // 1.9 → 3.0 විරාමයෙන් කැඩෙනවා
  assert.equal(lineText(lines[0]), 'මම අද ගෙදර යනවා');
  assert.equal(lineText(lines[1]), 'හෙට එනවා');
  assert.equal(buildLines(words, { maxWords: 2, maxChars: 40 }).length, 3);
  assert.equal(regroup(lines, { ...DEFAULT_STYLE, maxWords: 1 }).length, 6);
});

test('setLineText: වචන ගණන එකම නම් timing එහෙමමයි', () => {
  const [l] = buildLines(words.slice(0, 4), { maxWords: 4, maxChars: 40 });
  const e = setLineText(l, 'මම හෙට ගෙදර යනවා');
  assert.equal(e.words[1].text, 'හෙට');
  assert.equal(e.words[1].start, 0.45);
  const f = setLineText(l, 'දෙකයි වචන');
  assert.equal(f.words.length, 2);
  assert.equal(lineStart(f), 0);
  assert.ok(Math.abs(lineEnd(f) - 1.9) < 0.01);
  assert.equal(setLineText(l, '   ').words.length, 0);
});

test('split / merge / delete', () => {
  const lines = buildLines(words, { maxWords: 4, maxChars: 40 });
  const s = splitLine(lines, 0, 2);
  assert.equal(s.length, 3);
  assert.equal(lineText(s[0]), 'මම අද');
  assert.equal(lineText(s[1]), 'ගෙදර යනවා');
  assert.notEqual(s[0].id, s[1].id);
  assert.equal(splitLine(lines, 0, 0), lines);
  const m = mergeWithNext(s, 0);
  assert.equal(lineText(m[0]), 'මම අද ගෙදර යනවා');
  assert.equal(mergeWithNext(m, m.length - 1), m);
  assert.equal(deleteLine(m, 1).length, m.length - 1);
});

test('setLineTiming: shift + scale, 0ට අඩු වෙන්නේ නෑ', () => {
  const [l] = buildLines(words.slice(0, 4), { maxWords: 4, maxChars: 40 });
  const s = setLineTiming(l, 1, 2.9);
  assert.equal(lineStart(s), 1);
  assert.equal(lineEnd(s), 2.9);
  assert.equal(lineStart(setLineTiming(l, -5, 1)), 0);
});

test('activeLineIndex', () => {
  const lines = buildLines(words, { maxWords: 4, maxChars: 40 });
  assert.equal(activeLineIndex(lines, 0.5), 0);
  assert.equal(activeLineIndex(lines, 2.0), 0); // tail
  assert.equal(activeLineIndex(lines, 2.5), -1);
  assert.equal(activeLineIndex(lines, 3.5), 1);
  assert.equal(activeLineIndex(lines, 9), -1);
});

test('SRT / VTT', () => {
  const lines = buildLines(words, { maxWords: 4, maxChars: 40 });
  const srt = linesToSrt([...lines, { id: 'x', words: [] }]);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,900\nමම අද ගෙදර යනවා\n/);
  assert.match(srt, /2\n00:00:03,000 --> 00:00:04,000\nහෙට එනවා/);
  assert.ok(!srt.includes('\n3\n'));
  assert.match(linesToVtt(lines), /^WEBVTT\n\n00:00:00\.000 --> 00:00:01\.900/);
});
