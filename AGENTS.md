# AGENTS.md

Rules for anyone (human or agent) working in this repository. They are the
owner's decisions; do not relax them without asking him.

## What this is

A standalone desktop program for one lecturer at USN (University of
South-Eastern Norway). It turns a PPTX lecture into (1) an interactive
single-file HTML presentation and (2) an animated MP4 video with recorded
voice-over, both in USN's visual identity. Targets: Windows 11 and Linux
Mint / Ubuntu.

The project is self-contained and lives in `lysark/`, with its own git
repository. Do not read, search or change anything outside this folder. It
is not part of any other project the owner has.

## Language

- Talk to the owner in Norwegian bokmål.
- The program's user interface, and the player UI in exported HTML, is in
  Norwegian bokmål.
- Owner-facing documents (`README.md`, everything in `docs/`) are in
  Norwegian bokmål.
- Code, identifiers, code comments, commit messages and this file are in
  English.

## Licences

- Only open-source software under a free licence. No paid or freemium
  frameworks, libraries, services or subscriptions, and nothing that is
  "free of charge" under a proprietary licence.
- Check the licence of every dependency before adding it, and record it in
  `docs/stakk.md` (name, version, licence, why it is needed). A dependency
  that is not in that table must not be in `package.json`.
- Code that is linked into the program must be permissively licensed (MIT,
  BSD, ISC, Apache-2.0, MPL-2.0, OFL for fonts). GPL/LGPL software is
  allowed only as a separate executable the program starts (FFmpeg).
- Already rejected, do not reintroduce: GSAP (proprietary "no charge"
  licence), Remotion (source-available, not free), `ffmpeg-static`
  (GPL npm package that would be linked in), Clearface and Maison Neue
  (licensed fonts).

## No licensed material in git

Never commit: licensed fonts, USN logo files, the owner's lectures or
recordings, photos or illustrations from USN or third parties, FFmpeg
binaries. `merkevare/`, `eksempler/` and `vendor/ffmpeg/` are git-ignored
for this reason.

- Fonts in the repository: Liberation Serif and Liberation Sans only
  (SIL OFL 1.1), unmodified, with their licence file.
- The USN logo is used only from the original files the owner supplies. It
  is never redrawn, traced, recoloured, cropped, boxed or given effects.
  If the files are missing, the program says so; it does not substitute
  anything.

## Finished work only

- Every delivery is a finished, usable product on its own. No stubs, no
  placeholder screens, no "coming soon", no demo or sample content shipped
  in the program, no commented-out half features.
- If something cannot be done properly yet, leave it out entirely and say
  so, rather than faking it.
- Report results truthfully: what was tested, on which system, and what
  was not.

## Never invent subject-matter values

The lectures are civil-engineering teaching material. Never make up
figures, formulas, standards references, material properties, dates or
chart data. Content comes only from the owner's files and input. Animation
templates start empty and are filled in by the owner through a form. Test
fixtures use obviously neutral content ("A", "B", 1, 2, 3), never
plausible-looking engineering data.

## USN brand manual is binding

`docs/designmanual.md` summarises the rules from
<https://brandpad.io/usn/> and how the program applies them. Design
decisions start there. When a reference video or a request conflicts with
the manual, raise it with the owner instead of choosing silently.

## Architecture invariants

- One project format (scenes -> elements -> timeline) is read by the
  editor, the HTML player and the video export. No output has its own
  private copy of the content.
- Style is a theme. Switching theme never changes the content of a
  project; content refers to theme roles, not to raw colours or fonts.
- Rendering is a pure function of (project, theme, time). Render code
  never reads the wall clock, uses unseeded randomness or depends on the
  network. This is what makes frame-by-frame video export exact.
- Exported HTML is a single file that works offline. It makes no request
  to any server on its own. Content the owner has inserted from the web
  (a link, a YouTube video, another embed) is fetched only when the
  viewer activates it; until then the scene shows a still picture that
  lies in the file.
- The program collects nothing. It contacts the network only when the
  owner asks for it in the media dialog (decided 22.11.2026):
  - a search he types and sends to Wikimedia Commons, and the download of
    the picture he chooses (`commons.wikimedia.org`,
    `upload.wikimedia.org`);
  - the still picture of a YouTube link, when he presses "Hent
    forhåndsbilde" (`i.ytimg.com`).

  These hosts are an allow-list enforced in the main process; nothing
  else may be contacted. Nothing happens in the background, at start-up
  or without a click. No information about the owner, the machine or the
  project is sent: only the search words and the program's name and
  version. Render code and the export are unchanged by this: no network.
  The preview window is the one place that can load what the owner has
  embedded, exactly as a student's browser would, and only on a click.

## Commands

- `npm run dev` starts the program for development.
- `npm run typecheck` must be clean.
- `npm test` builds and runs every test, including two that start the
  whole program without showing a window (`LYSARK_HIDDEN=1`). Never show
  windows on the owner's screen from tests.
- `npm run dist:linux` and `npm run dist:win` package the program into
  `release/`.
- `eksempler/` holds the owner's real lectures (never in git).
  `tests/real-files.test.ts` imports all of them, and
  `tests/real-screens.test.ts` saves a picture of every scene of one of
  them (see the comment at its top). Compare against the owner's own PDF
  exports before and after any change to the importer.

- `tools/windows-vm.py` drives the owner's Windows 11 test VM; read its
  header before using it, and never press Enter on text you did not type.

## Working with the owner

- `HANDOFF.md` holds the current status and the owner's feedback. Read it
  at the start of a session and keep it true.

- Ask design questions together and early, each with one recommendation.
  Do not start building a delivery before its questions are answered.
  The answers so far are in `docs/sporsmal-leveranse-1.md` and
  `docs/sporsmal-videre.md`; the plan built on them is `docs/plan.md`.
- The owner has allowed commits on `main` as each tested step is done
  (22.11.2026). Pushing still needs his word.
- Do not push, create remote repositories or publish anything unless the
  owner asks.
- Keep `docs/plan.md` and `docs/stakk.md` true when plans or dependencies
  change.
