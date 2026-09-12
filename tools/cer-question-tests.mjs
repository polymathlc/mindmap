// Regression tests for ❓ QUESTIONS FROM THE SCIENCE LEARNING PORTAL.
// Run with:
//     node tools/cer-question-tests.mjs            all cases
//     node tools/cer-question-tests.mjs <name>     one case
//
// It loads the REAL js/cer-questions.js — the file the app ships — into a bare
// Node context with a fake `window`, and runs the pure half: the reference an
// element carries, the gates the portal applies before serving a question, the
// renderer that turns a bank document into a card, the marker, the fill-blank
// parser and the table reader. Every failure here is SILENT in the app — a
// badge that opens the wrong question, a card that shows the model answer
// above the box the student types into, a scheduled question served a week
// early, a script in a bank document reaching innerHTML — so this is the only
// place they are loud.
//
// It also reads app.js and app.html AS TEXT and pins the wiring that a bare
// function test cannot see: the badge drawn from drawElement, the badge tested
// BEFORE the shape in mousedown, the keyboard guard while a card is open, and
// the script tag that loads the module before app.js.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js', 'cer-questions.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'cer-questions.js' });
const C = sandbox.window.CerQuestions;
if (!C) throw new Error('js/cer-questions.js did not publish window.CerQuestions');

const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const ok = (cond, what) => { if (!cond) throw new Error(what); };
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error((what || 'value') + ': got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  }
};

// ---- fixtures ----------------------------------------------------------
const mcqQ = () => ({
  id: 'q1', title: 'Heat gain', topic: 'Heat',
  blocks: [
    { id: 't1', type: 'text', content: '<p>Which object <b>gains</b> heat fastest?</p>' },
    { id: 'i1', type: 'image', url: 'https://example.com/fig.png', scale: 0.5 },
    { id: 'm1', type: 'mcq', options: [
      { id: 'a', text: 'Metal spoon' }, { id: 'b', text: 'Wooden spoon' },
      { id: 'c', text: 'Plastic spoon' }, { id: 'd', text: 'Paper cup' } ], correctId: 'a' },
    { id: 'e1', type: 'explanation', content: '<p>Metal is a good conductor of heat.</p>' }
  ]
});
const openQ = () => ({
  id: 'q2', title: 'Explain condensation', topic: 'Water',
  blocks: [
    { id: 't', type: 'text', content: 'Explain why water droplets form on the outside of a cold can.' },
    { id: 'a', type: 'plainanswer', content: 'Water vapour in the air loses heat to the cold can and condenses into water droplets.' }
  ]
});

// ---- the reference an element carries ----------------------------------
test('refFromQuestion keeps only what the badge needs — never a block or an answer', () => {
  const r = C.refFromQuestion(mcqQ(), 'owner1');
  eq(Object.keys(r).sort(), ['id', 'kind', 'ownerUid', 'title', 'topic']);
  eq(r.kind, 'mcq');
  eq(r.ownerUid, 'owner1');
  ok(!JSON.stringify(r).includes('correctId'), 'a ref must not carry the answer');
});

test('normaliseRefs drops junk, dedupes by id, caps the list and repairs the kind', () => {
  const list = [
    { id: 'x', ownerUid: 'o', title: 'X', topic: 'T', kind: 'mcq' },
    { id: 'x', ownerUid: 'o', title: 'dup' },
    null, 'string', { title: 'no id' }, { id: '   ' },
    { id: 'y', kind: 'nonsense' }
  ];
  const out = C.normaliseRefs(list);
  eq(out.map(r => r.id), ['x', 'y']);
  eq(out[1].kind, 'read', 'an unknown kind falls back to read-only');
  eq(C.normaliseRefs(undefined), []);
  eq(C.normaliseRefs('nope'), []);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: 'q' + i }));
  eq(C.normaliseRefs(many).length, C.CER_MAX_PER_SHAPE, 'capped at CER_MAX_PER_SHAPE');
});

// ---- the gates the portal applies before serving ------------------------
test('usable: an ordinary question passes', () => eq(C.usable(mcqQ()), { ok: true, why: '' }));
test('usable: no blocks, held back, out of syllabus, retired topic, annotation are refused with a reason', () => {
  eq(C.usable({ id: 'a' }).why, 'no-blocks');
  eq(C.usable(Object.assign(mcqQ(), { holdBack: true })).why, 'held-back');
  eq(C.usable(Object.assign(mcqQ(), { holdBack: 'true' })).ok, true, 'holdBack is strictly === true');
  eq(C.usable(Object.assign(mcqQ(), { notInSyllabus: true })).why, 'out-of-syllabus');
  eq(C.usable(Object.assign(mcqQ(), { topic: 'Cell Systems' })).why, 'retired-topic');
  eq(C.usable(Object.assign(mcqQ(), { topic2: 'cell system' })).why, 'retired-topic');
  eq(C.usable(Object.assign(mcqQ(), { annotation: true })).why, 'annotation');
});
test('usable: a release date ahead of today is refused, one that has passed is served, junk is served', () => {
  eq(C.usable(Object.assign(mcqQ(), { releaseOn: '2099-01-01' }), '2026-09-12').why, 'scheduled');
  eq(C.usable(Object.assign(mcqQ(), { releaseOn: '2020-01-01' }), '2026-09-12').ok, true);
  eq(C.usable(Object.assign(mcqQ(), { releaseOn: new Date('2099-01-01').toISOString() }), '2026-09-12').ok, true, 'an ISO timestamp is not a day key — fails OPEN like the portal');
  eq(C.scheduledAhead('2099-01-01', '2026-09-12'), true);
  eq(C.scheduledAhead('2026-09-12', '2026-09-12'), false, 'today is released');
  eq(C.scheduledAhead(12345, '2026-09-12'), false);
});
test('usable: a question made only of hidden blocks has nothing to show', () => {
  eq(C.usable({ id: 'h', blocks: [{ type: 'explanation', content: 'x' }, { type: 'pageBreak' }] }).why, 'nothing-to-show');
});

// ---- what kind of question -----------------------------------------------
test('kindOf: one ticked MCQ is mcq; an unticked MCQ with no other answer is read; a model answer is open', () => {
  eq(C.kindOf(mcqQ()), 'mcq');
  const unticked = mcqQ(); unticked.blocks[2].correctId = null;
  eq(C.kindOf(unticked), 'read');
  const badTick = mcqQ(); badTick.blocks[2].correctId = 'zzz';
  eq(C.kindOf(badTick), 'read', 'a correctId naming no option is not an answer');
  eq(C.kindOf(openQ()), 'open');
  const twoMcq = mcqQ(); twoMcq.blocks.push({ id: 'm2', type: 'mcq', options: [{ id: 'p', text: 'p' }], correctId: 'p' });
  eq(C.kindOf(twoMcq), 'open', 'a passage set with two MCQs is not marked here as one MCQ');
  eq(C.kindOf({ blocks: [{ type: 'text', content: 'Read this.' }] }), 'read');
});

// ---- marking ---------------------------------------------------------------
test('markMcq: right, wrong, and a pick that names no option', () => {
  const q = mcqQ();
  eq(C.markMcq(q, 'a').correct, true);
  const wrong = C.markMcq(q, 'c');
  eq(wrong.correct, false);
  eq(wrong.correctIndex, 0);
  eq(wrong.correctText, 'Metal spoon');
  eq(C.markMcq(q, 'nope').correct, false);
  eq(C.markMcq(openQ(), 'a'), null, 'no MCQ, nothing to mark');
});

// ---- the renderer ----------------------------------------------------------
test('renderBlocks hides the explanation and model answer until revealed', () => {
  const before = C.renderBlocks(mcqQ(), {});
  ok(!before.includes('good conductor'), 'explanation leaked before checking');
  ok(before.includes('gains'), 'wording missing');
  ok(before.includes('Metal spoon') && before.includes('Paper cup'), 'options missing');
  ok(before.includes('<img src="https://example.com/fig.png"'), 'picture missing');
  ok(before.includes('width:50%'), 'the portal scale becomes a width');
  const after = C.renderBlocks(mcqQ(), { revealed: true, picked: 'c', marked: { correctId: 'a' } });
  ok(after.includes('good conductor'), 'explanation not revealed');
  ok(after.includes('cq-right'), 'correct option not lit');
  ok(after.includes('cq-wrong'), 'wrong pick not marked');
  ok(after.includes('disabled'), 'radios still live after marking');
  const openBefore = C.renderBlocks(openQ(), {});
  ok(!openBefore.includes('condenses'), 'model answer shown above the box the student types into');
  ok(C.renderBlocks(openQ(), { revealed: true }).includes('condenses'), 'model answer not revealed');
});

test('renderBlocks numbers options 1..n in array order and keeps the picked option lit', () => {
  const html = C.renderBlocks(mcqQ(), { picked: 'b' });
  const nums = [...html.matchAll(/cq-optnum">(\d)\./g)].map(m => m[1]);
  eq(nums, ['1', '2', '3', '4']);
  ok(/value="b" checked/.test(html), 'picked option not checked');
  ok(html.includes('cq-picked'), 'picked option not lit');
});

test('renderBlocks: fill-blank shows boxes, then the answers; a run of blanks is ONE box', () => {
  const q = { blocks: [{ type: 'fillblank', text: 'The gas is [[carbon]] [[dioxide]] and [[oxygen]].' }] };
  const hidden = C.renderBlocks(q, {});
  eq((hidden.match(/class="cq-blank"/g) || []).length, 2, 'two blanks, not three');
  ok(!hidden.includes('carbon'), 'answer leaked');
  const shown = C.renderBlocks(q, { revealed: true });
  ok(shown.includes('carbon dioxide') && shown.includes('oxygen'), 'answers not revealed');
});

test('fbSegments: whitespace joins, punctuation separates, adjacency joins without a space', () => {
  eq(C.fbSegments('[[a]] [[b]]').filter(s => s.type === 'blank').map(s => s.answer), ['a b']);
  eq(C.fbSegments('[[a]], [[b]]').filter(s => s.type === 'blank').map(s => s.answer), ['a', 'b']);
  eq(C.fbSegments('[[car]][[bon]]').filter(s => s.type === 'blank').map(s => s.answer), ['carbon']);
  eq(C.fbSegments('plain'), [{ type: 'text', text: 'plain' }]);
});

test('tableRows reads the portal’s object-of-objects, an array, and a legacy headers row', () => {
  const objData = { '1': { '0': 'r1c0', '1': 'r1c1' }, '0': { '1': 'r0c1', '0': 'r0c0' } };
  eq(C.tableRows({ type: 'table', cols: 2, data: objData }), [['r0c0', 'r0c1'], ['r1c0', 'r1c1']]);
  eq(C.tableRows({ type: 'table', cols: 3, data: [['a'], ['b', 'c']] }), [['a', '', ''], ['b', 'c', '']], 'ragged rows padded');
  eq(C.tableRows({ type: 'table', cols: 2, headers: ['H1', 'H2'], data: [['x', 'y']] }), [['H1', 'H2'], ['x', 'y']]);
  eq(C.tableRows({ type: 'table' }), []);
  const html = C.renderBlocks({ blocks: [{ type: 'table', cols: 2, headers: ['H1', 'H2'], data: [['x', 'y']] }] }, {});
  ok(html.includes('<th>H1</th>') && html.includes('<td>x</td>'), 'table not rendered');
});

test('renderBlocks: part labels, CER answers and answer lines', () => {
  const q = { blocks: [
    { type: 'text', content: 'Look at the diagram.' },
    { type: 'text', content: 'Name the process.', part: 'a' },
    { type: 'text', content: 'Explain it.', part: 'b.i' },
    { type: 'answer', claim: 'C', evidence: 'E', reasoning: 'R', part: 'b.i' },
    { type: 'answerLine', label: 'Answer:' }
  ] };
  const html = C.renderBlocks(q, { revealed: true });
  ok(html.includes('(a)') && html.includes('(b)(i)'), 'part labels missing');
  eq((html.match(/\(b\)\(i\)/g) || []).length, 1, 'the same part label printed twice in a row');
  ok(html.includes('Claim:') && html.includes('Reasoning:'), 'CER answer not rendered');
  ok(html.includes('cq-blank-long'), 'answer line missing');
  eq(C.partLabel('-'), '');
  eq(C.partLabel(''), '');
  eq(C.partLabel('c'), '(c)');
  eq(C.partLabel('.ii'), '(ii)');
});

// ---- the sanitiser --------------------------------------------------------
test('safeHtml keeps a teacher’s formatting and drops scripts, handlers and javascript: urls', () => {
  const dirty = '<p onclick="x()">Hi <b>there</b><script>alert(1)</script><img src="javascript:alert(1)"><img src="https://ok/a.png" onerror="x()"><a href="javascript:evil()">go</a><a href="https://ok">ok</a><u>u</u><sup>2</sup><iframe src="x"></iframe><marquee>m</marquee></p>';
  const clean = C.safeHtml(dirty);
  ok(!/<script/i.test(clean), 'script survived');
  ok(!/onclick|onerror/i.test(clean), 'handler survived');
  ok(!/javascript:/i.test(clean), 'javascript: url survived');
  ok(!/<iframe|<marquee/i.test(clean), 'unknown tag survived');
  ok(clean.includes('<b>there</b>') && clean.includes('<u>u</u>') && clean.includes('<sup>2</sup>'), 'formatting stripped');
  ok(clean.includes('<img src="https://ok/a.png"'), 'safe image dropped');
  ok(clean.includes('<a href="https://ok" target="_blank" rel="noopener">'), 'safe link mangled');
  ok(clean.includes('m</p>') || clean.includes('m'), 'text inside a dropped tag should stay');
  eq(C.safeUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  eq(C.safeUrl('data:text/html,evil'), '');
  eq(C.safeUrl('vbscript:x'), '');
});

test('plainText strips tags and entities without a DOM', () => {
  eq(C.plainText('<p>A&nbsp;&amp;<br>B</p>'), 'A & B');
  eq(C.plainText(null), '');
});

// ---- the picker's search ---------------------------------------------------
test('summary + search: every word must match; topic narrows; the stem is clipped', () => {
  const s1 = C.summary(mcqQ());
  eq(s1.kind, 'mcq');
  eq(s1.topic, 'Heat');
  ok(s1.stem.startsWith('Which object gains heat'), 'stem lost its words');
  const long = C.summary({ blocks: [{ type: 'text', content: 'x'.repeat(400) }] });
  ok(long.stem.length <= 160 && long.stem.endsWith('…'), 'stem not clipped');
  eq(long.title, 'x'.repeat(60), 'an untitled question is named by its wording');
  const list = [s1, C.summary(openQ())];
  eq(C.search(list, 'heat', '').map(x => x.id), ['q1']);
  eq(C.search(list, 'heat cold', '').map(x => x.id), [], 'an OR would have matched both');
  eq(C.search(list, '', 'Water').map(x => x.id), ['q2']);
  eq(C.search(list, 'CONDENSATION', '').map(x => x.id), ['q2'], 'case-insensitive');
  eq(C.topicsOf(list), [{ topic: 'Heat', count: 1 }, { topic: 'Water', count: 1 }]);
});

// ---- constants shared with the portal ------------------------------------------
test('the collection names and the attempt mode are the portal’s own', () => {
  eq(C.CER_CONFIG_COL + '/' + C.CER_CONFIG_DOC, 'config/admin');
  eq(C.CER_QUESTIONS_COL, 'questions');
  eq(C.CER_ATTEMPTS_COL, 'questionAttempts');
  eq(C.CER_ATTEMPT_MODE, 'mindmap');
  ok(C.CER_PORTAL_URL.startsWith('../'), 'the portal link must be RELATIVE — an absolute host breaks the day the centre moves domain');
});

// ---- the wiring in app.js / app.html, read as text -------------------------
test('app.html loads cer-questions.js BEFORE app.js and carries both modals and the property group', () => {
  const a = appHtml.indexOf('js/cer-questions.js');
  const b = appHtml.indexOf('js/app.js');
  ok(a > 0 && b > a, 'cer-questions.js must be loaded before app.js');
  ['cerPickModal', 'cerQuestionModal', 'cerQuestionGroup', 'elementCerAttach', 'elementCerTry', 'elementCerList',
   'cerPickSearch', 'cerPickTopic', 'cerPickReload', 'cerPickList', 'cerPickAttach', 'cqBody', 'cqCheck', 'cqReveal', 'cqPrev', 'cqNext', 'versionTag']
    .forEach(id => ok(appHtml.includes('id="' + id + '"'), 'app.html is missing #' + id));
});

test('app.js draws the badge from drawElement and tests it BEFORE the shape on mousedown', () => {
  const drawEl = appJs.slice(appJs.indexOf('    drawElement(element) {'), appJs.indexOf('    drawQuestionBank(element) {'));
  ok(drawEl.includes('this.drawQuestionBadge(element)'), 'drawElement does not draw the question badge');
  const md = appJs.slice(appJs.indexOf('    handleSelectMouseDown(pos, e) {'), appJs.indexOf('    handleArrowMouseDown'));
  const badge = md.indexOf('getQuestionBadgeAtPosition');
  const shape = md.indexOf('getElementAtPosition');
  ok(badge > 0 && shape > badge, 'the badge must be hit-tested before the shape, or a tap on it starts a drag');
  ok(md.indexOf('getQuestionBadgeAtPosition') < md.indexOf('getLinkAtPosition'), 'the question badge is tested before the link badge');
});

test('app.js guards the keyboard shortcuts while a card or the picker is open, and Escape closes them', () => {
  const kd = appJs.slice(appJs.indexOf('    handleKeyDown(e) {'), appJs.indexOf("        const key = e.key.toLowerCase();"));
  ok(kd.includes('cerModalOpen()'), 'handleKeyDown does not stand down while a card is open');
  ok(kd.includes('closeCerModals()'), 'Escape does not close the card');
});

test('app.js checks the role in the HANDLERS, not only on the buttons', () => {
  ['openCerPicker', 'attachCerSelected', 'removeCerQuestion'].forEach(fn => {
    const at = appJs.search(new RegExp('^    (async )?' + fn + '\\(', 'm'));
    ok(at > 0, fn + ' not found');
    const body = appJs.slice(at, at + 600);
    ok(body.includes('isCerAdmin()'), fn + ' does not check the role');
  });
});

test('app.js replaces the refs array rather than mutating a shared one, and never pins more than the cap', () => {
  const setter = appJs.slice(appJs.indexOf('    setQuestionRefs(element, refs) {'), appJs.indexOf('    renderCerPropertyGroup(element) {'));
  ok(setter.includes('CerQuestions.normaliseRefs(refs)'), 'setQuestionRefs must normalise');
  ok(setter.includes('element.questions = clean'), 'setQuestionRefs must assign a fresh list');
  const attach = appJs.slice(appJs.indexOf('    attachCerSelected() {'), appJs.indexOf('    async previewCerQuestion('));
  ok(attach.includes('CER_MAX_PER_SHAPE'), 'attach does not respect the cap');
});

test('app.js logs an attempt once, never from the teacher’s preview', () => {
  const chk = appJs.slice(appJs.indexOf('    cerCheck() {'), appJs.indexOf('    cerReveal() {'));
  ok(chk.includes('!st.logged && !st.preview'), 'the attempt log must be once per opening and never a preview');
  ok(chk.includes('CerQuestions.logAttempt('), 'no attempt is logged');
  const log = src.slice(src.indexOf('function logAttempt('), src.indexOf('function forgetCache'));
  ok(log.includes('isAdmin) return'), 'the teacher’s own answers must not be logged as a student’s');
});

test('the version tag is one string, shown in the toolbar', () => {
  const m = /const APP_VERSION = '(v\d+\.\d+\.\d+)'/.exec(appJs);
  ok(m, 'APP_VERSION missing from app.js');
  ok(appHtml.includes('id="versionTag"'), '#versionTag missing');
  ok(appJs.includes("document.getElementById('versionTag')"), 'the tag is never written');
});

// ---- run -------------------------------------------------------------------
const only = process.argv[2];
let pass = 0, fail = 0;
for (const c of cases) {
  if (only && c.name !== only && !c.name.includes(only)) continue;
  try { c.fn(); pass++; console.log('  ✓ ' + c.name); }
  catch (e) { fail++; console.log('  ✗ ' + c.name + '\n      ' + (e && e.message || e)); }
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
