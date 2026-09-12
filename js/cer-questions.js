// =====================================================================
// ❓ QUESTIONS FROM THE SCIENCE LEARNING PORTAL — the cer bank, read here
//
// The Science Learning Portal (polymathlc/cer) keeps the centre's question
// bank at users/{adminUid}/questions, and every signed-in student of that
// portal reads it directly — so a mindmap opened by the same account, on the
// same Firebase project, can read it too. This file is the ONE place the
// mindmap app talks to that bank. It publishes ONE object, window.CerQuestions,
// synchronously, and app.js reads it defensively: a denied read, a bank that
// is empty or a question that has been deleted since it was pinned each
// degrade to a card that SAYS so rather than to a badge that does nothing.
//
// It READS the bank and WRITES nothing but an attempt row. The bank is the
// teacher's; a mindmap must never author into it.
//
// TWO HALVES, deliberately apart:
//   • the PURE half (everything up to `resolveOwner`) knows nothing about the
//     DOM or Firestore, so tools/cer-question-tests.mjs can load this file in
//     Node and run the real filter, the real renderer and the real marker;
//   • the FIRESTORE half uses the compat SDK the rest of this app already
//     loads (`db.collection(...)`), never a modular import, so there is one
//     Firebase app on the page and one sign-in.
//
// A QUESTION IS PINNED BY REFERENCE, NEVER COPIED. An element carries
// `questions: [{ id, ownerUid, title, topic, kind }]` — enough to draw the
// badge and the properties panel offline, and nothing a student could read an
// answer out of. The live question is fetched when the card opens, so a
// correction made in the portal reaches every mindmap the moment it is saved.
// =====================================================================
(function () {
    'use strict';

    // The portal's own pointer to whose bank students load. cer resolves it
    // from config/admin; this app does the same, so the two can never point at
    // different teachers.
    const CER_CONFIG_COL = 'config';
    const CER_CONFIG_DOC = 'admin';
    const CER_QUESTIONS_COL = 'questions';
    // The portal's own attempt log, under the SAME mode string the portal
    // labels in its USAGE_MODES table — a mode written from outside app.js
    // needs that label more than most, because an unlabelled row reads as a
    // mode somebody forgot rather than as a mindmap.
    const CER_ATTEMPTS_COL = 'questionAttempts';
    const CER_ATTEMPT_MODE = 'mindmap';
    // The portal is a sibling folder on the same GitHub Pages host, so the hop
    // is RELATIVE — an absolute address works until the centre moves domain.
    const CER_PORTAL_URL = '../cer/';
    // At most this many questions on one shape. More is a worksheet, and a
    // worksheet is what the portal is for.
    const CER_MAX_PER_SHAPE = 12;
    // The retired topic the portal never serves anywhere but a past paper.
    const CER_RETIRED_TOPIC_RE = /cell\s*systems?/i;
    // Blocks the portal itself hides inside a question until it is answered,
    // or never shows a student at all. A question carrying one is still an
    // ordinary question; the block is simply not drawn (or is drawn only after
    // the answer is checked, for the explanation).
    const CER_HIDDEN_BLOCKS = ['explanation', 'answerKey', 'pageBreak', 'video', 'widget', 'studentAnswer', 'commonMistake'];
    // Blocks that hold the ANSWER and are revealed only after the student has
    // committed to one of their own.
    const CER_ANSWER_BLOCKS = ['plainanswer', 'answer', 'explanation'];
    const SG_TZ = 'Asia/Singapore';

    // ---- text ------------------------------------------------------------
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Authored HTML to plain words. DOM-free on purpose, so the harness can run
    // it: tags go, the handful of entities the editor writes come back as
    // characters, whitespace collapses.
    function plainText(html) {
        return String(html == null ? '' : html)
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    // The portal's questions are AUTHORED HTML — a teacher's <p>, <b>, <u>,
    // <sup>, an <img> pasted into the wording. They are drawn with innerHTML
    // here exactly as the portal draws them, so the wording keeps its shape;
    // what must never cross is a script, a handler or a javascript: address,
    // because a bank document is written by one account and read by many.
    // An ALLOWLIST of tags and of attributes: anything not named is dropped
    // rather than being trusted because it looked harmless.
    const SAFE_TAGS = { p: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, sup: 1, sub: 1,
        span: 1, div: 1, ul: 1, ol: 1, li: 1, table: 1, thead: 1, tbody: 1, tr: 1, td: 1, th: 1,
        img: 1, a: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, blockquote: 1, code: 1, pre: 1, hr: 1 };
    const SAFE_ATTRS = { img: ['src', 'alt', 'width', 'height'], a: ['href'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };
    function safeUrl(v) {
        const s = String(v || '').trim();
        if (/^(https?:\/\/|data:image\/|\/|\.\.?\/)/i.test(s) && !/[\u0000-\u001f]/.test(s)) return s;
        return '';
    }
    function safeHtml(html) {
        let s = String(html == null ? '' : html);
        // Whole containers whose CONTENT is the danger go first.
        s = s.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
             .replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*\/?>/gi, '')
             .replace(/<!--[\s\S]*?-->/g, '');
        // Then every remaining tag, one at a time.
        s = s.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, slash, name, attrs) => {
            const tag = name.toLowerCase();
            if (!SAFE_TAGS[tag]) return '';
            if (slash) return '</' + tag + '>';
            const keep = SAFE_ATTRS[tag] || [];
            let out = '<' + tag;
            keep.forEach(attr => {
                const re = new RegExp('\\b' + attr + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i');
                const am = re.exec(attrs);
                if (!am) return;
                let v = am[2] != null ? am[2] : (am[3] != null ? am[3] : am[4]);
                if (attr === 'src' || attr === 'href') { v = safeUrl(v); if (!v) return; }
                out += ' ' + attr + '="' + escapeHtml(v) + '"';
            });
            if (tag === 'a') out += ' target="_blank" rel="noopener"';
            if (tag === 'img') out += ' loading="lazy"';
            return out + (tag === 'br' || tag === 'img' || tag === 'hr' ? '>' : '>');
        });
        return s;
    }

    // "(b)(i)" from the portal's part key 'b.i' — a bare letter, a bare roman,
    // or the two together. '-' is the portal's "filed under no part".
    function partLabel(part) {
        if (part == null || part === '' || part === '-') return '';
        const s = String(part);
        const dot = s.indexOf('.');
        const letter = dot >= 0 ? s.slice(0, dot) : s;
        const sub = dot >= 0 ? s.slice(dot + 1) : '';
        return (letter ? '(' + letter + ')' : '') + (sub ? '(' + sub + ')' : '');
    }

    // ---- gates the portal itself applies before SERVING a question ----------
    // Mirrors of cer's qInSyllabus / qReleased, written out here because a
    // mindmap cannot import app.js. Each fails the way the portal's does: the
    // release date is read only as an exact 'YYYY-MM-DD' (anything else is not
    // a schedule, so the question is served), and holdBack only as `=== true`.
    function sgToday() {
        try { return new Date().toLocaleDateString('en-CA', { timeZone: SG_TZ }); }
        catch (e) {
            const d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
    }
    function scheduledAhead(on, today) {
        if (typeof on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return false;
        return on > (today || sgToday());
    }
    function retiredTopic(q) {
        return CER_RETIRED_TOPIC_RE.test(String(q.topic || '')) || CER_RETIRED_TOPIC_RE.test(String(q.topic2 || ''));
    }
    // A verdict with a REASON, never a bare boolean, so the picker can say why
    // a question is not offered rather than leaving the teacher to guess why
    // the list is shorter than the bank.
    function usable(q, today) {
        if (!q || typeof q !== 'object') return { ok: false, why: 'empty' };
        if (!Array.isArray(q.blocks) || !q.blocks.length) return { ok: false, why: 'no-blocks' };
        if (q.notInSyllabus) return { ok: false, why: 'out-of-syllabus' };
        if (retiredTopic(q)) return { ok: false, why: 'retired-topic' };
        if (q.holdBack === true) return { ok: false, why: 'held-back' };
        if (scheduledAhead(q.releaseOn, today)) return { ok: false, why: 'scheduled' };
        if (q.annotation) return { ok: false, why: 'annotation' };
        const shown = q.blocks.filter(b => b && CER_HIDDEN_BLOCKS.indexOf(b.type) < 0);
        if (!shown.length) return { ok: false, why: 'nothing-to-show' };
        return { ok: true, why: '' };
    }

    // ---- what KIND of question this is -----------------------------------
    // 'mcq'  — exactly one multiple-choice block with a ticked answer: marked
    //          here, instantly, and logged to the portal's attempt log.
    // 'open' — a written answer: the student types, then compares against the
    //          model answer the teacher wrote. Nothing here marks it — this app
    //          has no marker and must not pretend to.
    // 'read' — no answer recorded anywhere: shown, never checked.
    function mcqBlocks(q) { return (q && Array.isArray(q.blocks) ? q.blocks : []).filter(b => b && b.type === 'mcq'); }
    // An EXPLANATION is not an answer — it explains one — so it does not on
    // its own make a question 'open'. It is still revealed (see hasExplanation)
    // once the student has committed, whatever the kind.
    function hasAnswerBlock(q) {
        return (q && Array.isArray(q.blocks) ? q.blocks : []).some(b => b && (
            b.type === 'plainanswer' || b.type === 'answer' || b.type === 'fillblank' || b.type === 'answerKey'
            || (b.type === 'mcq' && b.correctId && (b.options || []).some(o => o && o.id === b.correctId))));
    }
    function hasExplanation(q) {
        return (q && Array.isArray(q.blocks) ? q.blocks : []).some(b => b && b.type === 'explanation' && plainText(b.content));
    }
    function kindOf(q) {
        const mcqs = mcqBlocks(q);
        if (mcqs.length === 1 && mcqs[0].correctId && (mcqs[0].options || []).some(o => o && o.id === mcqs[0].correctId)) return 'mcq';
        if (hasAnswerBlock(q)) return 'open';
        return 'read';
    }
    function kindLabel(kind) {
        return kind === 'mcq' ? 'Multiple choice' : kind === 'open' ? 'Written answer' : 'Read only';
    }

    // ---- the reference an element carries ---------------------------------
    function refFromQuestion(q, ownerUid) {
        return {
            id: String(q.id || ''),
            ownerUid: String(ownerUid || ''),
            title: plainText(q.title || '').slice(0, 120),
            topic: String(q.topic || '').slice(0, 80),
            kind: kindOf(q)
        };
    }
    // Whatever a saved mindmap holds is read through this and nothing else: a
    // ref with no id is not a question, a duplicate id is one question, and
    // nothing past the cap is kept. A stale shape is corrected rather than
    // refused, so a mindmap saved by a later build still opens here.
    function normaliseRefs(list) {
        if (!Array.isArray(list)) return [];
        const seen = {};
        const out = [];
        list.forEach(r => {
            if (!r || typeof r !== 'object') return;
            const id = String(r.id || '').trim();
            if (!id || seen[id]) return;
            seen[id] = true;
            out.push({
                id,
                ownerUid: String(r.ownerUid || ''),
                title: String(r.title || ''),
                topic: String(r.topic || ''),
                kind: ['mcq', 'open', 'read'].indexOf(r.kind) >= 0 ? r.kind : 'read'
            });
        });
        return out.slice(0, CER_MAX_PER_SHAPE);
    }

    // ---- fill-in-the-blank, the portal's own markup ------------------------
    // `[[word]]` is a blank; a run of blanks joined by nothing but whitespace is
    // ONE blank (the portal's _fbMergeBlankRuns), or "[[carbon]] [[dioxide]]"
    // is drawn as two boxes and the box count gives the answer away.
    function fbParse(text) {
        const parts = []; const re = /\[\[([\s\S]+?)\]\]/g; let last = 0, m;
        text = String(text || '');
        while ((m = re.exec(text))) {
            if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
            parts.push({ type: 'blank', answer: (m[1] || '').trim() });
            last = m.index + m[0].length;
        }
        if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
        return parts;
    }
    function fbSegments(text) {
        const parts = fbParse(text);
        const out = [];
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (p.type !== 'blank') { out.push(p); continue; }
            let answer = p.answer || '';
            for (;;) {
                const nxt = parts[i + 1];
                if (nxt && nxt.type === 'blank') { answer += (nxt.answer || ''); i += 1; continue; }
                if (nxt && nxt.type === 'text' && nxt.text.length && !nxt.text.trim()
                    && parts[i + 2] && parts[i + 2].type === 'blank') {
                    answer += ' ' + (parts[i + 2].answer || ''); i += 2; continue;
                }
                break;
            }
            out.push({ type: 'blank', answer: answer.trim() });
        }
        return out;
    }

    // ---- tables — the portal stores rows as an object of objects -----------
    // Firestore refuses nested arrays, so cer writes `data` as
    // { "0": { "0": cell, "1": cell }, "1": {...} } and older documents carry a
    // separate `headers` row. Both come back as an array of arrays here.
    function tableRows(block) {
        if (!block) return [];
        let data = block.data;
        let rows;
        if (Array.isArray(data)) rows = data.map(r => Array.isArray(r) ? r.slice() : Object.values(r || {}));
        else if (data && typeof data === 'object') {
            rows = Object.keys(data).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(k => {
                const row = data[k];
                if (Array.isArray(row)) return row.slice();
                if (!row || typeof row !== 'object') return [];
                return Object.keys(row).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map(c => row[c] == null ? '' : row[c]);
            });
        } else rows = [];
        if (Array.isArray(block.headers) && block.headers.length) {
            rows.unshift(block.headers.map(h => h == null ? '' : h));
        }
        const cols = Math.max(block.cols || 0, ...rows.map(r => r.length), 0);
        return rows.map(r => { const c = r.slice(0, cols); while (c.length < cols) c.push(''); return c; });
    }

    // ---- the card body -----------------------------------------------------
    // Draws the question the way a student meets it: wording, pictures, the
    // choices, blanks to fill. The ANSWER blocks are drawn only when `revealed`
    // — before that a student could read the model answer above the box they
    // are meant to type into. `picked` is the option id the student has chosen,
    // so a re-render after Check keeps their choice lit.
    function renderBlocks(q, opts) {
        opts = opts || {};
        const revealed = !!opts.revealed;
        const picked = opts.picked || '';
        const marked = opts.marked || null;   // { correctId } once checked
        const blocks = Array.isArray(q && q.blocks) ? q.blocks : [];
        let html = '';
        let lastPart = '';
        blocks.forEach((b, idx) => {
            if (!b || !b.type) return;
            const label = partLabel(b.part);
            const partHtml = (label && label !== lastPart) ? `<span class="cq-part">${escapeHtml(label)}</span> ` : '';
            if (label) lastPart = label;
            switch (b.type) {
                case 'text':
                    html += `<div class="cq-text">${partHtml}${safeHtml(b.content || '')}</div>`;
                    break;
                case 'part':
                    html += `<div class="cq-text cq-partline">${b.label ? '<b>' + escapeHtml(b.label) + '</b> ' : ''}${safeHtml(b.content || '')}</div>`;
                    break;
                case 'image': {
                    const src = safeUrl(b.url || b.src || '');
                    if (!src) break;
                    const pct = (typeof b.scale === 'number' && b.scale > 0) ? Math.round(Math.min(1, b.scale) * 100) : 0;
                    const style = pct ? `width:${pct}%;` : 'max-width:70%;';
                    html += `<figure class="cq-figure"><img src="${escapeHtml(src)}" alt="" style="${style}">${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''}</figure>`;
                    break;
                }
                case 'mcq': {
                    html += `<div class="cq-mcq" data-block="${escapeHtml(b.id || 'mcq' + idx)}">${partHtml}`;
                    (b.options || []).forEach((o, i) => {
                        if (!o) return;
                        const id = String(o.id || ('opt' + i));
                        const isPicked = picked === id;
                        let cls = 'cq-opt';
                        if (marked) {
                            if (id === marked.correctId) cls += ' cq-right';
                            else if (isPicked) cls += ' cq-wrong';
                        } else if (isPicked) cls += ' cq-picked';
                        html += `<label class="${cls}"><input type="radio" name="cq_mcq" value="${escapeHtml(id)}"${isPicked ? ' checked' : ''}${marked ? ' disabled' : ''}><span class="cq-optnum">${i + 1}.</span><span class="cq-opttext">${safeHtml(o.text || '')}</span></label>`;
                    });
                    html += '</div>';
                    break;
                }
                case 'fillblank': {
                    const segs = fbSegments(b.text || '');
                    let line = '';
                    segs.forEach(s => {
                        if (s.type === 'text') line += escapeHtml(s.text);
                        else line += revealed
                            ? `<span class="cq-blank cq-blank-shown">${escapeHtml(s.answer)}</span>`
                            : '<span class="cq-blank"></span>';
                    });
                    html += `<div class="cq-text cq-fill">${partHtml}${line}</div>`;
                    break;
                }
                case 'table': {
                    const rows = tableRows(b);
                    if (!rows.length) break;
                    html += '<div class="cq-tablewrap"><table class="cq-table">';
                    rows.forEach((r, ri) => {
                        html += '<tr>';
                        r.forEach(c => { html += ri === 0 && Array.isArray(b.headers) && b.headers.length
                            ? `<th>${safeHtml(c)}</th>` : `<td>${safeHtml(c)}</td>`; });
                        html += '</tr>';
                    });
                    html += '</table></div>';
                    break;
                }
                case 'answerLine':
                    html += `<div class="cq-text">${b.label ? '<b>' + escapeHtml(b.label) + '</b> ' : ''}<span class="cq-blank cq-blank-long"></span></div>`;
                    break;
                case 'openLines':
                case 'workingSpace':
                    // Ruled or dashed working space on paper; on this card the
                    // student types into the box under the question instead.
                    break;
                case 'plainanswer':
                    if (revealed) html += `<div class="cq-answer">${partHtml}<div class="cq-answer-head">✅ Model answer</div>${safeHtml(b.content || '')}</div>`;
                    break;
                case 'answer':
                    if (revealed) {
                        html += `<div class="cq-answer">${partHtml}<div class="cq-answer-head">✅ Model answer</div>`;
                        if (b.claim) html += `<div><b>Claim:</b> ${safeHtml(b.claim)}</div>`;
                        if (b.evidence) html += `<div><b>Evidence:</b> ${safeHtml(b.evidence)}</div>`;
                        if (b.reasoning) html += `<div><b>Reasoning:</b> ${safeHtml(b.reasoning)}</div>`;
                        html += '</div>';
                    }
                    break;
                case 'explanation':
                    if (revealed && plainText(b.content)) html += `<div class="cq-explain"><div class="cq-answer-head">💡 Explanation</div>${safeHtml(b.content || '')}</div>`;
                    break;
                default:
                    // answerKey, pageBreak, video, widget, studentAnswer,
                    // commonMistake and anything a later portal adds: not
                    // something a student meets inside the question here.
                    break;
            }
        });
        return html;
    }

    // Marks ONE multiple-choice question locally. The correct option is the id
    // the teacher ticked; never guessed from position.
    function markMcq(q, pickedId) {
        const mcqs = mcqBlocks(q);
        if (mcqs.length !== 1) return null;
        const b = mcqs[0];
        const opts = b.options || [];
        const correctIndex = opts.findIndex(o => o && o.id === b.correctId);
        if (correctIndex < 0) return null;
        const pickedIndex = opts.findIndex(o => o && String(o.id) === String(pickedId));
        return {
            correct: pickedIndex >= 0 && pickedIndex === correctIndex,
            correctId: String(b.correctId),
            correctIndex,
            pickedIndex,
            correctText: plainText(opts[correctIndex] && opts[correctIndex].text)
        };
    }

    // One line about a question for the picker and the properties panel.
    function summary(q) {
        const texts = (Array.isArray(q && q.blocks) ? q.blocks : [])
            .filter(b => b && b.type === 'text').map(b => plainText(b.content));
        const stem = texts.join(' ').trim();
        return {
            id: q.id || '',
            title: plainText(q.title || '') || stem.slice(0, 60) || 'Untitled question',
            topic: String(q.topic || ''),
            topic2: String(q.topic2 || ''),
            stem: stem.length > 160 ? stem.slice(0, 157).trimEnd() + '…' : stem,
            kind: kindOf(q),
            hasPicture: (q.blocks || []).some(b => b && b.type === 'image' && (b.url || b.src))
        };
    }

    // The picker's filter: every word typed has to match somewhere in the
    // title, the topic or the wording (an OR returns half the bank), and a
    // topic chosen from the dropdown narrows on top of that.
    function search(list, term, topic) {
        const words = String(term || '').toLowerCase().split(/\s+/).filter(Boolean);
        const wantTopic = String(topic || '');
        return (list || []).filter(s => {
            if (wantTopic && s.topic !== wantTopic && s.topic2 !== wantTopic) return false;
            if (!words.length) return true;
            const hay = (s.title + ' ' + s.topic + ' ' + s.topic2 + ' ' + s.stem).toLowerCase();
            return words.every(w => hay.indexOf(w) >= 0);
        });
    }

    function topicsOf(list) {
        const seen = {};
        (list || []).forEach(s => { if (s.topic) seen[s.topic] = (seen[s.topic] || 0) + 1; });
        return Object.keys(seen).sort((a, b) => a.localeCompare(b)).map(t => ({ topic: t, count: seen[t] }));
    }

    // ---- Firestore (compat SDK) --------------------------------------------
    // Everything below takes `db` as an argument rather than reaching for a
    // global, so the harness never has to fake one and the pure half above
    // never depends on this half having run.
    let _ownerUid = null;
    let _bankCache = null;      // { ownerUid, at, questions: [ {q, sum} ], skipped }

    async function resolveOwner(db, fallbackUid) {
        if (_ownerUid) return _ownerUid;
        try {
            const snap = await db.collection(CER_CONFIG_COL).doc(CER_CONFIG_DOC).get();
            if (snap.exists && snap.data().uid) _ownerUid = String(snap.data().uid);
        } catch (e) { console.warn('[cer-questions] bank owner lookup:', e); }
        if (!_ownerUid && fallbackUid) _ownerUid = String(fallbackUid);
        return _ownerUid;
    }

    // The whole bank, read once per sitting for the picker. It is the
    // ADMIN's read — a student never opens the picker — so a bank of two
    // thousand questions is a cost the teacher pays once, not something a
    // child's phone downloads to answer one question.
    async function loadBank(db, fallbackUid, force) {
        const ownerUid = await resolveOwner(db, fallbackUid);
        if (!ownerUid) throw new Error('Could not find whose question bank to read.');
        if (_bankCache && _bankCache.ownerUid === ownerUid && !force) return _bankCache;
        const snap = await db.collection('users').doc(ownerUid).collection(CER_QUESTIONS_COL).get();
        const today = sgToday();
        const questions = [];
        const skipped = {};
        snap.forEach(d => {
            const q = Object.assign({ id: d.id }, d.data());
            const v = usable(q, today);
            if (v.ok) questions.push({ q, sum: summary(q) });
            else skipped[v.why] = (skipped[v.why] || 0) + 1;
        });
        questions.sort((a, b) => (a.sum.topic || '').localeCompare(b.sum.topic || '') || a.sum.title.localeCompare(b.sum.title));
        _bankCache = { ownerUid, at: Date.now(), total: snap.size, questions, skipped };
        console.info('[cer-questions] bank: %d of %d questions can be pinned to a shape', questions.length, snap.size);
        return _bankCache;
    }

    // ONE question, live. A ref written before `ownerUid` existed is looked up
    // against the pointer instead. A missing document comes back null, never
    // an error: the card says the question has gone, which is the one honest
    // thing to say about a deleted question.
    async function loadQuestion(db, ref, fallbackUid) {
        if (!ref || !ref.id) return null;
        const ownerUid = ref.ownerUid || await resolveOwner(db, fallbackUid);
        if (!ownerUid) return null;
        const snap = await db.collection('users').doc(ownerUid).collection(CER_QUESTIONS_COL).doc(ref.id).get();
        if (!snap.exists) return null;
        return Object.assign({ id: snap.id }, snap.data());
    }

    // The attempt row, in the shape the portal's own games write, under the
    // mode the portal labels. Fire-and-forget: a failed log must never stop a
    // student seeing whether they were right. Only a STUDENT's answer is a
    // record worth keeping — the teacher checking their own mindmap is not.
    function logAttempt(db, user, q, correct, ms, isAdmin) {
        if (!db || !user || !q || !q.id || isAdmin) return;
        try {
            db.collection(CER_ATTEMPTS_COL).add({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || (user.email || '').split('@')[0],
                questionId: q.id,
                questionTitle: q.title || '',
                score: correct ? 1 : 0,
                totalBlanks: 1,
                answerHash: '',
                ms: Math.max(0, Math.round(Number(ms) || 0)),
                timestamp: firebase.firestore.Timestamp.now(),
                mode: CER_ATTEMPT_MODE
            }).catch(err => console.warn('[cer-questions] attempt log failed', err));
        } catch (e) { console.warn('[cer-questions] attempt log failed', e); }
    }

    function forgetCache() { _bankCache = null; _ownerUid = null; }

    const api = {
        CER_CONFIG_COL, CER_CONFIG_DOC, CER_QUESTIONS_COL, CER_ATTEMPTS_COL, CER_ATTEMPT_MODE,
        CER_PORTAL_URL, CER_MAX_PER_SHAPE, CER_HIDDEN_BLOCKS, CER_ANSWER_BLOCKS,
        escapeHtml, plainText, safeHtml, safeUrl, partLabel,
        sgToday, scheduledAhead, retiredTopic, usable,
        mcqBlocks, hasAnswerBlock, hasExplanation, kindOf, kindLabel,
        refFromQuestion, normaliseRefs,
        fbParse, fbSegments, tableRows,
        renderBlocks, markMcq, summary, search, topicsOf,
        resolveOwner, loadBank, loadQuestion, logAttempt, forgetCache
    };
    if (typeof window !== 'undefined') window.CerQuestions = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
