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
- What the code calls a scene is called **lysark** in everything the
  owner or a student reads: the interface, the player, the documents
  (decided by the owner 22.11.2026; "scene" confused people). Identifiers
  in code stay `scene`.

## Licences

- Lysark itself is licensed GPL-3.0-or-later (`LICENSE`), chosen by the
  owner 22.11.2026, with an additional permission that keeps exported
  presentations out of the GPL (`EXPORT-EXCEPTION.md`). Do not change
  either without asking him. The rules below about what may be linked in
  are the owner's and are stricter than the GPL requires; they stand.
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
  to any server on its own, with one exception the owner asked for
  (22.11.2026, after trying the two-stage version): a YouTube video he
  has put in is shown as YouTube's player, embedded in the slide, not as
  a still picture with a "play from YouTube" button. It is fetched when
  the slide it stands on is shown, never before. This is decided but not
  built yet; see `HANDOFF.md` 6.14. Other content from the web (links,
  other embedded pages) is still fetched only when the viewer activates
  it, until the owner says otherwise.
- The program collects nothing. It contacts the network only when the
  owner asks for it in the media dialog (decided 22.11.2026):
  - a search he types and sends to Wikimedia Commons, and the download of
    the picture he chooses (`commons.wikimedia.org`,
    `upload.wikimedia.org`, `thumb.wikimedia.org`);
  - the still picture of a YouTube link, when he presses "Hent
    forhåndsbilde" (`i.ytimg.com`).

  These hosts are an allow-list enforced in the main process; nothing
  else may be contacted. Nothing happens in the background, at start-up
  or without a click. No information about the owner, the machine or the
  project is sent: only the search words and the program's name and
  version. Render code and the export are unchanged by this: no network.
  The preview window is the one place that can load what the owner has
  embedded, exactly as a student's browser would, and only on a click.
  The list in code is `ALLOWED_HOSTS` in `src/main/commons.ts`; it and
  this section must always say the same.
- The owner has said (22.11.2026) that other sources of pictures in the
  public domain are welcome too. That is leave to add such a source, not
  a blanket opening: each new host is named here and in `ALLOWED_HOSTS`,
  the same rules apply to it (only on his click, only the search words),
  its licences are filtered and credited as for Commons, and he is told
  which source was added.
- Tests never contact the network. Where a test needs Wikimedia, the test
  answers for it.

## Commands

- `npm run dev` starts the program for development.
- `npm run typecheck` must be clean.
- `npm test` builds and runs every test, including three files that
  start the whole program without showing a window (`LYSARK_HIDDEN=1`).
  Never show windows on the owner's screen from tests.
- `npm run dist:linux` and `npm run dist:win` package the program into
  `release/`.
- `eksempler/` holds the owner's real lectures (never in git).
  `tests/real-files.test.ts` imports all of them, and
  `tests/real-screens.test.ts` saves a picture of every scene of one of
  them (see the comment at its top). Compare against the owner's own PDF
  exports before and after any change to the importer.

- `tools/windows-vm.py` drives the owner's Windows 11 test VM; read its
  header before using it, and never press Enter on text you did not type.
  The owner has said (22.11.2026) that you may set up a microphone in
  that VM yourself (the libvirt domain's sound input), so that recording
  can be tried on Windows. That leave covers the microphone and nothing
  else in the VM's configuration.
- **Canvas is the owner's alone.** He tries the exported files in Canvas
  by hand. No agent, script or automation is ever used there, and you do
  not ask to be let in. Give him a short checklist of what to look for
  instead, and record what he reports.

## Working with the owner

- `HANDOFF.md` holds the current status and the owner's feedback. Read it
  at the start of a session and keep it true.

- Ask design questions together and early, each with one recommendation.
  Do not start building a delivery before its questions are answered.
  The answers so far are in `docs/sporsmal-leveranse-1.md` and
  `docs/sporsmal-videre.md`; the plan built on them is `docs/plan.md`.
- The owner has allowed commits on `main` as each tested step is done
  (22.11.2026). Pushing still needs his word.
- The repository is on GitHub as `SimenKode/lysark`. It stays private
  until there is a first usable version with both HTML and video
  (the owner, 22.11.2026), and then he decides. Do not push, change its
  visibility, create other remote repositories or publish anything
  (releases, packages) unless the owner asks.
- Commits use the owner's GitHub no-reply address, set in this
  repository's git configuration. Never put his private e-mail address in
  a commit, a file or a request.
- Keep `docs/plan.md` and `docs/stakk.md` true when plans or dependencies
  change.
