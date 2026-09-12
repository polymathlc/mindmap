# CLAUDE.md

Guidance for Claude when working in this repo.

## App
- `app.html` + `js/app.js` + `css/styles.css` — **"Mindmap"**, the Polymath mindmap canvas.
  `index.html` is the landing page. The canvas, its tools, the saved-maps panel, the
  assignments and the submissions all live in `js/app.js` (one `MindmapApp` class);
  Firebase reads and writes go through `js/firebase-config.js` (`FirebaseService`, compat
  SDK, shared `mathgen--app` project, Google sign-in). `README.md` is the feature log, newest
  version first — add a section there for anything user-visible.
- **The board engine is shared with the Ans Key app** (`polymathlc/anskey`, its `mmBoard`
  port). The element shape (`type` / `x` / `y` / `width` / `height` / `fillColor` /
  `strokeColor` / `strokeWidth` / `text` / `fontSize` / `fontFamily` / `textColor` / `link`)
  and the connection shape are the same in both, so a board built here reads the same way
  there. Ship engine changes to both repos together. That app's serialiser copies every
  field of an element, so a field added here (such as `questions` below) travels through it
  untouched.
- Roles: `FirebaseService.isAdmin()` is the one admin email; everyone else is a student. A
  student clones a published map to work on it, so anything pinned to a shape by the teacher
  travels with the clone.

## Versioning convention — applies to EVERY change (do this every time)
1. **Bump the version.** In `js/app.js`, update `const APP_VERSION = 'vX.Y.Z'`. Patch bump
   for fixes / small tweaks, minor bump for new features.
2. **Keep it visible.** It renders in the toolbar (`#versionTag`, written by
   `renderVersionTag`). Update the fallback text in `app.html` too, so the first paint shows
   the same number.
3. **Report it.** When summarising an update in chat, always state the new version number.

The whole point: the user checks the version shown in the app against the number reported
in chat to know whether the upload/deploy went through.

## Design convention — breathing space (applies to EVERY UI you build/touch)
- Give elements room to breathe: generous, consistent padding inside cards, clear vertical
  spacing between title → description → meta → buttons, and comfortable line-height. Never
  cram content edge-to-edge or stack lines tightly.
- Cards are rounded rectangles constrained to a sensible max-width and centred — not a
  dense, full-bleed block.
- When the user says something is "too big/thick/messy", the fix is usually *more*
  whitespace and a tighter width, not shrinking fonts until it is cramped.

## ❓ Questions from the Science Learning Portal, pinned to a shape (v1.1.0)

`js/cer-questions.js` (`window.CerQuestions`, search `QUESTIONS FROM THE SCIENCE LEARNING
PORTAL`), and in `js/app.js`: `getQuestionRefs` / `getQuestionBadgeRect` /
`getQuestionBadgeAtPosition` / `drawQuestionBadge` / `setQuestionRefs` /
`renderCerPropertyGroup` / `setupCerQuestions` / `openCerPicker` / `loadCerBank` /
`renderCerPicker` / `attachCerSelected` / `previewCerQuestion` / `openCerQuestion` /
`loadCerCardQuestion` / `renderCerCard` / `cerCheck` / `cerReveal` / `cerNav`, plus
`#cerQuestionGroup` in the properties panel, `#cerPickModal`, `#cerQuestionModal` and the
`.cq-*` / `.cer-*` CSS.

The teacher selects a shape, presses **❓ Attach a question…**, and picks questions out of
the Science Learning Portal's own bank (`polymathlc/cer`, `users/{adminUid}/questions`). The
shape wears a violet ❓ badge; a student taps it and answers the question right there on the
mindmap. A multiple-choice answer is marked on the spot; a written answer is typed and then
compared with the teacher's model answer.

- **THE ELEMENT CARRIES REFERENCES, NEVER THE QUESTION.** `element.questions` is
  `[{ id, ownerUid, title, topic, kind }]` — what the badge and the properties panel need
  offline, and nothing a student could read an answer out of. The card fetches the live
  document when it opens, so a question corrected in the portal is corrected on every
  mindmap at once, and a deleted one says so rather than showing a stale copy.
  `normaliseRefs` is the ONE reader of that field: junk is dropped, duplicates are one, the
  list is capped at `CER_MAX_PER_SHAPE`, and an unknown `kind` reads as read-only.
- **`js/cer-questions.js` IS THE ONE PLACE THIS APP TALKS TO THE PORTAL'S BANK.** It resolves
  whose bank to read from the portal's own `config/admin` pointer — the same document the
  portal's students resolve it from, so the two can never point at different teachers — and
  reads with the compat SDK the rest of this app already loads. Its pure half (the filter,
  the renderer, the marker, the fill-blank parser, the table reader) knows nothing about the
  DOM or Firestore, which is what lets `tools/cer-question-tests.mjs` load the shipped file
  in Node.
- **IT SERVES WHAT THE PORTAL WOULD SERVE, and nothing the portal withholds.** `usable(q)`
  mirrors the portal's own gates: no blocks, `notInSyllabus`, the retired Cell Systems topic
  (both topic fields), `holdBack === true`, a `releaseOn` day ahead of today in Singapore
  time, and an annotation question are all refused with a REASON the picker can print. The
  release date is read only as an exact `YYYY-MM-DD`, exactly as the portal's `qReleaseOn`
  does, so a stray value fails OPEN — a question served a few days early is an embarrassment
  a person can see; one withheld for ever by a value nobody can read is silent. The card
  applies the same two gates again at open time for a student, because a question can be
  held back AFTER it was pinned; the teacher still sees it, because it is theirs.
- **WHO MAY DO WHAT.** Pinning and removing are the teacher's — `openCerPicker`,
  `attachCerSelected` and `removeCerQuestion` all check `isCerAdmin()` in the HANDLER, and a
  hidden button is never the lock. Opening and answering is everyone's, because the
  questions exist for the student.
- **A MULTIPLE-CHOICE ANSWER IS MARKED HERE; A WRITTEN ONE IS NOT.** `markMcq` compares the
  picked option id with the option the teacher ticked — never a position, never a guess. A
  written answer is typed into a box under the question and then the model answer is
  revealed beside it; this app has no marker and must not pretend to. `kindOf` decides which:
  `mcq` (exactly one MCQ block whose `correctId` names one of its options), `open` (a model
  answer, a CER answer, a fill-blank or an answer key exists), `read` (nothing recorded — an
  explanation alone is not an answer, though it is still offered under Show explanation).
- **THE ANSWER BLOCKS ARE DRAWN ONLY AFTER THE STUDENT HAS COMMITTED** (`renderBlocks`'s
  `revealed`). Before that the model answer, the CER answer, the fill-blank answers and the
  explanation are not in the card's markup at all — not hidden with CSS, not there — so a
  curious student cannot read them out of the developer tools.
- **THE ATTEMPT IS LOGGED TO THE PORTAL'S OWN LOG** (`questionAttempts`) in the shape its
  games write, under the mode **`mindmap`** — which is labelled in the portal's
  `USAGE_MODES` (cer v1.376.0), because a mode written from outside `app.js` reads there as
  a mode somebody forgot rather than as a mindmap. Once per opening, only for a
  multiple-choice question, never from the teacher's 👁 preview and never for the admin's
  own account: the log is a record of students' work. It is fire-and-forget — a refused
  write never stops a student seeing whether they were right.
- **AUTHORED HTML IS SANITISED, NOT TRUSTED** (`safeHtml`). A bank document is a teacher's
  `<p>`, `<b>`, `<u>`, `<sup>` and pasted `<img>`, drawn with innerHTML exactly as the
  portal draws it. What must never cross is a script, an `on*` handler or a `javascript:`
  address — the document is written by one account and read by many — so the sanitiser is
  an ALLOWLIST of tags and attributes and drops anything not named.
- **THE BADGE IS HIT-TESTED BEFORE THE SHAPE**, in `handleSelectMouseDown`, ahead of the
  link badge, the resize handles and the shape itself: a student opening a question is the
  one thing on this canvas that must never turn into a drag. When a shape carries both, the
  🔗 link badge steps one badge to the left (`getLinkRect`'s `shift`) so the two are never
  drawn on top of each other. `handleDoubleClick` refuses the badge too, or a double-tap on
  it would start editing the shape's text underneath.
- **THE KEYBOARD STANDS DOWN WHILE A CARD OR THE PICKER IS OPEN** (`cerModalOpen`, at the
  top of `handleKeyDown`): a student typing a written answer, or the teacher typing a
  search, must not have "r" put the rectangle tool in their hand. Escape closes whichever is
  on top — the card first, so the picker keeps its ticks.
- **`setQuestionRefs` REPLACES THE LIST, NEVER MUTATES IT.** `duplicate()` copies an element
  with a spread, so two shapes can share ONE `questions` array, and a push onto it would pin
  the question to both.
- **THE BANK IS READ ONCE PER SITTING, FOR THE PICKER, BY THE TEACHER.** A student never
  opens the picker, so a bank of two thousand questions is a cost the teacher pays once, not
  something a child's phone downloads to answer one question — the card reads ONE document
  by id. The picker lists at most 200 rows and says so; the search box (every word must
  match) and the topic dropdown (built from the bank itself) are how the rest are reached.
- **The portal link is RELATIVE** (`CER_PORTAL_URL` = `../cer/`). The apps are sibling
  folders on one GitHub Pages host, and an absolute address works until the day the centre
  moves domain.
- Run **`node tools/cer-question-tests.mjs`** after touching any of it. Every failure here is
  silent and the badge still draws: a renderer that puts the model answer above the box a
  student types into, a gate that lets a scheduled question out a week early — or, worse,
  one that reads an ISO timestamp as a schedule and withholds the question for ever — a
  marker that compares positions instead of ids, a sanitiser that lets a handler through, a
  badge tested after the shape so a tap on it becomes a drag, and a picker that mutates a
  shared array and pins the question to two shapes.

## House rules
- After editing `js/app.js` or `js/cer-questions.js`, syntax-check them:
  `node --check js/app.js && node --check js/cer-questions.js`.
- Commit messages and pushed artifacts must not contain the model identifier.
