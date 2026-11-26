# AGENTS.md

Rules for anyone (human or agent) working in this repository. They are the
owner's decisions; do not relax them without asking him.

## What this is

A standalone desktop program for lecturers at USN (University of
South-Eastern Norway). It turns a lecture they already have, as PPTX or
PDF, into (1) an interactive single-file HTML presentation and (2) a
video (MP4, or a GIF for short clips) with recorded voice-over, both in
USN's visual identity. Targets: Windows 11 and Linux Mint / Ubuntu.

**The users are lecturers, not developers** (the owner, 22.11.2026). The
owner is one of them and speaks for them. Everything a lecturer meets
must be understandable without training: plain words, the same word for
the same thing everywhere, no jargon from the code. When a name or a
flow would make a lecturer hesitate, that is a defect.

The project is self-contained and lives in `lysark/`, with its own git
repository. Do not read, search or change anything outside this folder,
and never describe or add anything from outside it here. It is not part
of any other project the owner has.

It is the owner's private project (he said so on 23.11.2026): he
publishes it himself, as a private person, and uses it privately. It is
not made, owned or endorsed by USN, and nothing in the repository may
say or suggest that it is.

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
- The same goes for USN's closing animation (the film where the logo is
  drawn). It is kept, unchanged, in the program's settings folder, never
  in a project folder, a test fixture or git, and never recreated in
  code. Tests use a test pattern made by FFmpeg.

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

## The look follows USN's profile

The program has chosen the same colours, shapes and kinds of typeface as
USN's visual profile, so that what it makes fits in at USN. USN's own
manual is at <https://brandpad.io/usn/>; read it there when a design
decision needs it. **No copy, summary or digest of that manual is kept
in this repository** (the owner, 23.11.2026: a summary was removed).
Write down what Lysark does, not what the manual says. When a reference
video or a request conflicts with the profile, raise it with the owner
instead of choosing silently.

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
  the slide it stands on is shown (or the "Lær mer" panel it stands in
  is opened), never before, and is taken away when the viewer moves on
  (`activateWebFrames` in `src/shared/render/scene.ts`). In a file
  opened straight from disk YouTube refuses to play, so there the still
  picture stays and its button opens YouTube. Other content from the
  web (links, other embedded pages) is still fetched only when the
  viewer activates it, until the owner says otherwise.
- The program collects nothing. It contacts the network only when the
  owner asks for it in the media dialog (decided 22.11.2026):
  - a search he types and sends to Wikimedia Commons, and the download of
    the picture he chooses (`commons.wikimedia.org`,
    `upload.wikimedia.org`, `thumb.wikimedia.org`);
  - a search he types and sends to Openverse, and the download of the
    picture he chooses (`api.openverse.org`, and that host only: the
    search, the gallery and the picture itself all come from it, so the
    collections Openverse searches are never contacted). Added
    25.11.2026 under the leave below. Openverse's terms ask that the
    program says it uses Openverse and is not endorsed by it, and they say
    Openverse does not check the licences itself; the tab says both
    (`src/main/openverse.ts`);
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
- Tests never contact the network. Where a test needs Wikimedia or
  YouTube, the test answers for it. Every test that starts the program
  starts it with `OFFLINE` from `tests/fixtures/offline.ts`, which makes
  every host name outside the machine impossible to look up. The same
  goes for a throwaway script that starts the program to look at
  something: on 22.11.2026 such a script opened a "Lær mer" box in the
  preview, and the YouTube player in it was fetched for real.
- The program uses the microphone only while the owner records in the
  recording window. It uses the camera only there too, and only when the
  owner has switched "Kamera" on in that window (the owner asked for the
  camera on 25.11.2026; until then it was never used). It is off until he
  switches it on, and closed when the window closes. The main process
  grants "media" (sound and pictures) only to the program's own window
  (`allowRecordingDevicesOnly` in `src/main/index.ts`). Recordings and
  films are stored in the project folder and sent nowhere. Tests record
  from Chromium's built-in fake microphone and fake camera, never from
  real ones.
- A recording is a film of what the lecturer did (the owner, 25.11.2026:
  "som et vanlig videoopptak"). In the recording window the lecturer goes
  on, back and to any slide, and the recording never stops for it. Each
  stretch on a slide is a take with its own sound file
  (`src/shared/audio/session.ts`). A take on a slide further on than the
  recording has been is that slide's own sound. A take on a slide the
  recording has already passed becomes a **repeat**: a scene of its own in
  the list (`Scene.repeat`), standing where it happened, so video and
  "Spill av" show the slides in the order they were shown. A repeat has
  its own sound, step times, events, manuscript and camera place, but
  what it shows is always that of the slide it repeats: `followRepeats`
  (`src/shared/layout/repeats.ts`) is called from the store's `update`
  after every change, and the editor never lets a repeat's content be
  changed (`RepeatStage.tsx`). A repeat is not a slide to the lecturer or
  the student: slides are counted with `slideNumbers`
  (`src/shared/layout/slides.ts`), never by their index, and in the HTML
  player nobody turns to a repeat by hand; only "Spill av" shows it. The
  clock knows which steps were already on a slide when the lecturer came
  back to it, and never shows a step the lecturer did not come to
  (`stepClock` in `src/shared/render/clock.ts`).
- Chapters are a name on the slide a chapter begins on (`Scene.chapter`).
  They come from the sections of a PowerPoint file and the bookmarks of a
  PDF, and are shown in the list of slides, the slide menu of the
  recording window, the contents list of the HTML player and as chapters
  of the video file (`chapters` in `src/shared/layout/slides.ts`).
- The camera circle is the lecturer's face in a circle on the slide. One
  film runs through a whole recording, however the lecturer moves between
  the slides: it is made in a thread of its own
  (`src/renderer/src/audio/filmWorker.ts`), every picture is given the
  recording's own time, and it is handed to the main process a piece at a
  time. The sound of each take points into that film (`Asset.camera`,
  whose `offset` is negative for every take but the first), so
  whatever cuts the sound cuts the film with it; where the circle stands
  belongs to the slide (`Scene.camera`), and a move made while reading is
  an event with a time (`camera-move`). The clock says which picture of
  the face is shown and where (`cameraAt` in
  `src/shared/render/clock.ts`). The circle is in the video (MP4) only:
  not in the HTML file and not in a GIF (the owner's choice, 25.11.2026).
  The video export lays it on top of the picture of the slide itself
  (`src/shared/render/cameraDraw.ts`), and the interface draws the same
  circle with CSS; change the two together.
- FFmpeg is a separate program that Lysark starts (`src/main/ffmpeg.ts`),
  never linked in and never in git. One fixed build is fetched by
  `tools/fetch-ffmpeg.mjs` with its checksum checked, placed in
  `vendor/ffmpeg/`, and shipped next to the program with its licence text
  and a link to its source. To change the build, change it there and in
  `docs/stakk.md`, and tell the owner.
- Lysark hands FFmpeg on under the GPL, so every release carries
  FFmpeg's source as files of its own, not only as a link (the owner,
  23.11.2026): `npm run fetch:ffmpeg-source` fetches the FFmpeg source
  at the exact commit, the build scripts at the exact tag and a note,
  into `vendor/ffmpeg/source/`. Attach all three to the release. A
  release without them is not finished.
- The look of an imported file is the lecturer's free choice, made in a
  dialog at import (the owner, 25.11.2026): the slides **keep the look
  they have**, or are **made over into the theme** ("USN-stil"). Keeping
  the look is what is chosen until the lecturer says otherwise. Both
  choices must stay there for PowerPoint files and for PDFs. Either way
  the text is text that can be edited, in the program's own fonts (the
  owner chose that over an exact picture of the page).
  - A PDF that keeps its look: its text and pictures are elements, and
    the rest of the page lies behind them as a picture
    (`src/importer/pdf.ts`). Made over: the same elements on the theme's
    surface, in its fonts and colours, without the page's own background.
  - A PowerPoint file made over is the import there has always been
    (`src/importer/pptx.ts`). One that keeps its look is imported by way
    of a PDF of it, because Lysark cannot draw a PowerPoint slide as
    PowerPoint does: PowerPoint makes the PDF where it is installed
    (Windows); otherwise a PDF with the same name next to the file, not
    older than it, is used; otherwise LibreOffice makes it; otherwise the
    lecturer is asked for a PDF (`src/main/office.ts`). The lecturer is
    told where the look came from. Names, manuscript and chapters come
    from the PowerPoint file itself (`src/importer/pptxSlides.ts`).
  - PowerPoint and LibreOffice are programs the lecturer has installed.
    Like FFmpeg they are separate programs that Lysark starts; unlike
    FFmpeg they are never shipped, fetched or required. They work on a
    copy of the file, show no window, and nothing is sent anywhere.
    PowerPoint is not open source; the owner chose to let Lysark ask it,
    since it is the lecturer's own program and nothing of it is taken in.
    This is the one exception to the rule about open-source software, and
    it covers starting an installed office program for this, nothing else.
- Files the owner opens are untrusted input. An exported HTML file that
  is opened as a project is read as text and never run; its project is
  validated like any project file, and media land only in the new
  project's `media/` folder under names made from their own content
  (`src/importer/html.ts`).
- pdf.js is built in for PDF import, but the font and character-map
  folders of its package are never shipped (their licences have not been
  taken in; see `docs/stakk.md`). A test checks the build for them.
- All sound in a project is mono WAV, 48 kHz, 16 bit. A recording is never
  changed: editing changes the list of clips that point into it
  (`src/shared/audio/edit.ts`). Time is computed by one clock
  (`src/shared/render/clock.ts`) that the video export, "Spill av" in the
  HTML player and the editor's sound panel all use.
- What the lecturer opens and plays while reading a slide in (a "Lær mer"
  box, a video file) is kept as events on the slide, with times like the
  steps' (`Scene.events`). The clock says what is open and where each
  film stands at any time; the video export and "Spill av" follow it.
  Whatever cuts or stretches a slide's sound moves the events with the
  steps.
- A mark on a picture (a numbered point with a legend, or a label with
  a line) is an element of its own, so it can come in at a step and have
  "Lær mer" content, but it belongs to its picture. One function keeps
  them together after every change (`followMarks` in
  `src/shared/layout/marks.ts`, called from the store's `update`): the
  marks' places are always worked out from the picture, never moved
  along by whoever moves the picture. How a mark and a legend look
  depends on other elements than themselves (the number, the picture's
  choice of marks, the marks a legend lists), so the editor never
  reuses their drawn nodes (`canReuse` in `SceneView.tsx`).
- A free figure is not a kind of element. It is ordinary elements that
  are grouped (`Element.group`), and lines and arrows whose ends are
  fastened to other elements (`startAt`, `endAt` on a shape). The owner
  chose this on 25.11.2026: a figure is made on the slide itself, of the
  shapes that were there already, not in a window of its own. Each part
  is still an element, so it can come in at a step and have "Lær mer"
  content. A fastened line is still an ordinary line with a box; one
  function lays it right after every change (`followFigures` in
  `src/shared/layout/groups.ts`, called from the store's `update`), so
  the render code, the HTML player and the video export never look at
  groups or at what a line is fastened to. In the interface the word is
  "Grupper" and "Del opp gruppen" (the owner's choice, as in PowerPoint).
- A figure with a form (process, layers, comparison, time axis, bar
  diagram, line diagram) is drawn by its form, not by hand (the owner's choice, 25.11.2026: "skjemaet
  styrer"). The figure element (`type: 'figure'`) holds the form and a
  frame and shows nothing; what is seen are ordinary shapes (and, for the
  text of an event on a time axis, ordinary text boxes) that carry `of`,
  made, laid out and taken away by one function after every change
  (`followTemplates` in `src/shared/layout/templates.ts`, called from the
  store's `update` before `followFigures`). What is drawn knows only the
  shapes and text boxes. The one thing in the render code that knows of
  forms is the order the parts are read in by assistive technology: one
  row of the form at a time (`rowOrder` in `src/shared/layout/rows.ts`,
  used by `readingOrder` in `src/shared/render/scene.ts`; that file is
  kept free of the format's checking code, so the exported HTML file
  does not grow by it). "Gjør om til fri figur" takes the form
  away for good and leaves the parts as a group. A row of a form is never
  called "steg" in the interface (that word is the steps of a slide): it
  is a "boks", a "lag", a "kolonne" or a "hendelse". The template for
  events in order is called "Tidsakse" (the owner's choice, 26.11.2026):
  "Tidslinje" is the tab under the slide.
- A diagram is such a figure whose form is a table of numbers (the
  owner's choices, 26.11.2026: a small table in the properties that takes
  what is pasted from a spreadsheet; standing bars and lines; a line
  diagram's points stand where their x says). Its parts are worked out in
  `src/shared/layout/charts.ts`: bars are rectangles, numbers and names
  are text boxes, and a line is one shape of the kind "curve". A new
  diagram has no numbers, and none are ever made up: axes follow the
  numbers the lecturer writes, bars always include zero, and a point
  that cannot be drawn truthfully is left out, never moved. Numbers are
  read and written the Norwegian way (`parseNumber`, `formatNumber`).
  For those who cannot see it, the numbers are in the HTML as a table
  that is read and not shown. `charts.ts` takes only types from the
  format, like `rows.ts`.
- A line diagram has numbers along its axis, with each point where its x
  says, or names, with the same distance between the points
  (`FigureElement.along`, `rowsByName` and `setAlong` in `charts.ts`). The
  owner first chose numbers only, and added names on 26.11.2026, when a
  file from PowerPoint showed that PowerPoint's ordinary line chart has
  names and was lost at import.
- A chart in a PowerPoint file becomes such a diagram when it is made
  over into the theme and Lysark can draw it truthfully (the owner's
  choice, 26.11.2026): standing bars side by side, and lines
  (`src/importer/chart.ts`). A line chart with numbers along its axis
  has its points placed by them; one with names keeps the names. Every
  other chart stays what it was, and PowerPoint stores no picture of a
  chart, so such a chart is gone from the slide, with a note. A line
  chart with dates along its axis is not made over: where its points
  stand would have to be made up. A presentation that keeps its look
  keeps its charts in the picture of the page; the owner chose that too
  (26.11.2026).
- A step does one of four things (the owner's choices, 26.11.2026): it
  brings elements in, marks them, takes them away, or zooms
  (`Step.kind`). An element that comes in has a movement (`StepAction
  .effect`: toned in, glided in, grown, drawn, counted up, or there at
  once). The program proposes the one that suits the element when a step
  is made, and the lecturer can choose another, and the speed
  (`src/shared/layout/steps.ts`). Steps that were there before keep what
  they had. One function says what the steps have done at any moment,
  by hand or by the clock (`movesFrom` in
  `src/shared/render/timeline.ts`), and one draws it
  (`applySceneMoves`); the HTML player, the video export and the
  recording window all use both, so they move alike. A step that zooms
  has no elements and is never taken away for being empty (`stepStands`;
  use it wherever empty steps are removed). Everything on a slide lies in
  one layer (`.ls-zoom`), which a zoom makes larger; the slide itself
  keeps its size and cuts what goes outside. What lies on top of the
  slide without being part of it (the "Lær mer" box, the camera circle)
  is outside that layer. Where the slide is edited it is never zoomed:
  a frame shows the part (`ZoomFrame.tsx`), so what is chosen stands
  where its handles are drawn.
- A figure in a "Lær mer" box is fetched from a slide (the owner's
  choice, 25.11.2026): it is made on a slide, with the tools that are
  there, and the builder puts a copy of it in the box (a block of the
  kind `figure`; `figuresOn` and `fetchFigure` in
  `src/shared/layout/fetch.ts`). What can be fetched is what the lecturer
  made as one thing: a group (a figure with a form is one) and a picture
  with marks. The copy is its own: the slide can change or go without it,
  and "Hent på nytt" replaces it. It is only drawn: it has no steps, and
  the format lets nothing in it carry "Lær mer" content, and no video or
  "+ Lær mer" button (`DrawnElement`). It is drawn by the code that draws
  a slide (`renderDrawing` in `src/shared/render/scene.ts`), in stage
  pixels, and made to fit the box (`fitDrawings` in
  `src/shared/render/more.ts`). A box that holds a figure is wider than
  other boxes, so the figure can be read (the owner's choice, 26.11.2026;
  `popoverWish`). The box drawn on the slide for the video
  fits it when the box is placed, never later, so the picture does not
  wait for the window. The text rules of a box stop at the box's own text
  and tables (`:is(.lm-text, .lm-table)` in `MORE_CSS`), so that a figure
  in it looks as on the slide; keep them from reaching into `.lm-stage`.
- Music and other sound that run under several slides lie on the
  lecture's own tracks (`Project.tracks`), each clip fastened to a slide.
  One piece of code mixes them into the sound, with the music lowered
  under the voice (`src/shared/audio/mix.ts`): the video export, the
  HTML export and the editor's playback all use it, so they sound the
  same. The program ships no music.
- The interface reads project media with `fetch` to draw and play sound.
  The `lysark-media` scheme must therefore stay CORS-enabled and answer
  with `Access-Control-Allow-Origin` (`src/main/index.ts`). Without it
  only recordings made in the same session (still in memory) are drawn
  and played, which is how the fault went unseen until 23.11.2026. A
  test reads a recording that was not made in the session.

## Commands

- `npm run dev` starts the program for development.
- `npm run typecheck` must be clean.
- `npm test` builds and runs every test, including the `e2e-*` files that
  start the whole program without showing a window (`LYSARK_HIDDEN=1`).
  Never show windows on the owner's screen from tests. A window that is
  not shown draws only about once a second, so anything in those tests
  that follows an animation needs a generous timeout.
- A test must never put anything on the owner's screen, an error box
  included. An error in the main process ends the program when it runs
  without windows, instead of showing Electron's box that waits for an
  answer (`HIDDEN` in `src/main/index.ts`; `tests/e2e-quiet.test.ts`
  checks it). On 26.11.2026 such a box stood on the owner's screen five
  times before this was in place: a test's clean-up closed the main
  window just as the preview was going. When a clean-up hangs, look for
  the process that is left (`pgrep -f 'user-data-dir=/tmp/[l]ysark-'`),
  see what it shows (`wmctrl -lp`), and stop it by its number.
- `npm run fetch:ffmpeg` fetches FFmpeg into `vendor/ffmpeg/` (about
  350 MB of downloads, once). `tests/e2e-sound.test.ts` needs it and is
  skipped without it; the `dist:*` scripts fetch it when it is missing.
- `npm run dist:linux` and `npm run dist:win` package the program into
  `release/`.
- `eksempler/` holds the owner's real lectures (never in git).
  `tests/real-files.test.ts` imports all of them, and
  `tests/real-screens.test.ts` saves a picture of every scene of one of
  them (see the comment at its top). Compare against the owner's own PDF
  exports before and after any change to the importer.
  `eksempler/fra-powerpoint/diagram.pptx` is not a lecture: PowerPoint
  made it in the Windows VM, with a chart of test numbers on each slide
  (`tools/vm/diagrammer.ps1`), and `tests/real-charts.test.ts` says what
  the importer is to make of each. Make it anew when the importer is to
  be tried on other charts.

- `tools/windows-vm.py` drives the owner's Windows 11 test VM; read its
  header before using it, and never press Enter on text you did not type.
  The VM has no way out but its screen, so a file is fetched from it by
  showing it there as pictures that `tools/windows-vm.py read` reads off
  screenshots (`tools/vm/ut.ps1`).
  A file copied from the CD image is marked read-only there, as it would
  be for a lecturer who copies a project from a CD; saving takes that
  mark off (`writeProjectFile` in `src/main/projectIo.ts`), since
  Windows will not replace such a file.
  The owner has said (22.11.2026) that you may set up a microphone in
  that VM yourself (the libvirt domain's sound input), so that recording
  can be tried on Windows. That leave covers the microphone and nothing
  else in the VM's configuration.
- **Canvas is the owner's alone.** He tries the exported files in Canvas
  by hand. No agent, script or automation is ever used there, and you do
  not ask to be let in. Give him a short checklist of what to look for
  instead, and record what he reports.

## Working with the owner

- `HANDOFF.md` is the owner's page: what Lysark can do now, what he has
  decided, what is needed from him, what comes next, and the start
  message for the next chat. Read it at the start of a session and keep
  it true. **Keep it short and easy to read** (he asked for that,
  22.11.2026): no logs, no test details, no long tables. What was built
  and tried in detail, and his feedback word for word, goes into
  `docs/historikk.md`, which is the log.
- Buttons never end in "…" (the owner, 22.11.2026). A button that opens
  a file dialog says what happens ("Velg fil og eksporter"). Icons are
  the program's own line drawings in `src/renderer/src/Icon.tsx`; no icon
  library is taken in. The header of that file says where an icon stands
  alone, where it stands with text, and where there is only text; follow
  it. The native menu bar keeps "…" where an entry opens a dialog.
- "Lær mer" is a box that pops out beside its element, on top of the
  slide. It never pushes the slide aside, in the player or in the
  builder's preview (`placePopover` in `src/shared/render/more.ts`).
- Motion is in how things answer, and in the steps the lecturer makes;
  the program never moves subject matter by itself. All of it is left
  out under `prefers-reduced-motion`. What is to be in the video is a
  pure function of time.
- In the interface, the same thing has one name. The owner chose these
  on 22.11.2026: "Lær mer" (never "utdyping"), "Innhold" for what a
  "Lær mer" panel holds (never "byggestein"), "Nettside" for an embedded
  page (never "innbygging"), "Rydd opp lysarket", and "Lagre som én fil".

- Ask design questions together and early, each with one recommendation.
  Do not start building a delivery before its questions are answered.
  The answers so far are in `docs/sporsmal-leveranse-1.md` and
  `docs/sporsmal-videre.md`; the plan built on them is `docs/plan.md`.
- The owner has allowed commits on `main` as each tested step is done,
  and pushing them to the repository as you go, without asking each time
  (22.11.2026). Push `main` to `origin` only: no force push, no other
  branches or remotes. The repository is public now, so a push is a
  publication: look at what a commit holds before it goes. (The history was rewritten and force-pushed
  once, on his word, on 23.11.2026, before the repository was opened.
  That was that one time; the rule stands.)
- `SimenKode/lysark-gammel` is the repository as it was before the
  history was rewritten (23.11.2026). It is private and holds what was
  taken out. Never push to it, fetch from it or copy anything from it;
  the owner deletes it when he chooses.
- The repository is on GitHub as `SimenKode/lysark`, and it is **public**:
  the owner opened it on 23.11.2026, after the history had been gone
  through and rewritten. Do not change its visibility, create other
  remote repositories or publish anything (releases, packages) unless
  the owner asks. He asked for a release on 22.11.2026 (version 0.2.0),
  on 23.11.2026 (version 0.3.0) and on 25.11.2026 (version 0.4.0): each
  is a release with the packaged program for Linux and Windows (from
  0.4.0 the Windows installer too) and FFmpeg's source. Make a new
  release only when he asks for one.
- The README is the front page for lecturers (the owner, 25.11.2026):
  installation first, then how the program is used, with pictures, in
  plain words. Nothing about deliveries or development there; that
  belongs in `docs/utvikling.md`. It describes what the latest release
  holds, not what is only in the code: what it says about a new feature
  goes out with the release that has it. Its pictures (`docs/bilder/`)
  are taken by the tests, with test content, and never show USN's logo
  (a test that finds the owner's logo package on the machine draws the
  logo, so look at a picture before it is committed).
- Commits use the owner's GitHub no-reply address, set in this
  repository's git configuration. Never put his private e-mail address in
  a commit, a file or a request.
- Keep `docs/plan.md` and `docs/stakk.md` true when plans or dependencies
  change.
