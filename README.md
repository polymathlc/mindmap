# Mindmap

The Polymath mindmap canvas: shapes, arrows, pictures, a question bank of pasted pictures,
the science syllabus, saved maps, published maps, assignments and marking. Open `index.html`
for the landing page and `app.html` for the canvas.

This file is the feature log, newest version first. The version running is shown in the
toolbar.

## v1.2.0 — 🏷 The question picker searches the portal's TAGS

Typing **expansion** into the ❓ picker's search box now finds every question the Science
Learning Portal's teacher has **tagged** expansion, not only the ones whose title, topic or
wording happen to say the word. A question about a jar lid loosening under hot water is
about expansion and never says so in its text — the tag is where that lives, and the picker
was not reading it.

- The search box reads the title, the topic, the **tags** and the wording. Every word typed
  still has to match somewhere, and the topic dropdown still narrows on top.
- A **tag row** sits under the search box: the tags the bank really uses, most-used first,
  each with how many questions wear it. Tap one and it is typed into the search box for you;
  tap it again to clear it. Tags past the first forty are reached by typing them.
- Every row in the picker now shows its tags as small chips, so what a question is filed
  under is visible before it is pinned.
- Tags are read exactly the way the portal reads them — one tag however it was capitalised,
  a bare number ignored — so a search here and a search there agree.

## v1.1.0 — ❓ Questions from the Science Learning Portal, pinned to a shape

A shape on the mindmap can now carry a question — or several — out of the Science Learning
Portal's own question bank, so a student reading a concept on the map can try a related
question without leaving it.

**For the teacher**

- Select a shape and press **❓ Attach a question…** in the properties panel. The picker
  reads the portal's bank once, and offers a search box (every word typed has to match the
  title, the topic or the wording) and a topic dropdown built from the bank itself. Tick the
  questions you want, 👁 to preview one with its answer showing, then **Attach selected**.
  A shape holds up to 12 questions.
- The shape wears a violet **❓** badge in its top-right corner — with a count when there is
  more than one. If the shape also carries a 🔗 link, the chain steps one badge to the left.
- Each pinned question is listed in the properties panel with ✕ to take it off again.
- Questions the portal would not serve today are not offered: held back for a paper,
  scheduled for a later date, out of syllabus, or the retired Cell Systems topic. The
  picker says how many were left out and why.
- Save the mindmap to keep the pins. A published map carries them to every student who
  clones it, and a submitted map carries them to the marking view.

**For the student**

- Tap the ❓ badge (or **▶ Answer the question** in the properties panel). The question opens
  in a card over the map, with its pictures, its parts and its choices, exactly as it reads
  in the portal.
- A multiple-choice question is marked on the spot — ✅ or ❌ with the right answer named,
  and the teacher's explanation revealed underneath.
- A written question gets a box to type into; **Show model answer** then puts the teacher's
  answer beside it to compare with.
- Several questions on one shape are worked through with ‹ Previous / Next ›.
- Every multiple-choice answer is recorded in the portal's usage tracker under **Mindmap**,
  so the teacher sees the work alongside everything else the student has done.

The question itself always comes from the portal live — a correction made there is what
the card shows the next time it opens. Nothing here writes into the bank.

**Also in this version**

- The toolbar now shows the version number, so the number on screen can be checked against
  the number reported when a change ships.
- `tools/cer-question-tests.mjs` — run with `node tools/cer-question-tests.mjs` — checks the
  bank filter, the card renderer, the marker and the canvas wiring.
