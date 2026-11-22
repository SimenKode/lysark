// The dialog for exporting as video or GIF: which slides, the few choices
// there are, what will come out, and how far the export has come.
import { useEffect, useRef, useState } from 'react';
import type { VideoRequest } from '../../shared/api';
import { collectCredits } from '../../shared/render/more';
import {
  GIF_FPS,
  GIF_MAX_SECONDS,
  GIF_WIDTHS,
  VIDEO_FPS,
  VIDEO_SIZE,
  formatTime,
  hasSound,
  schedule,
  videoOptions,
} from '../../shared/render/clock';
import { cancelVideo, exportVideo, hasFfmpeg } from './actions';
import { useStore } from './store';

type Range = 'all' | 'current' | 'some';

function parseSlide(text: string, count: number): number | undefined {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= count ? n : undefined;
}

export function VideoDialog() {
  const project = useStore((s) => s.project)!;
  const sceneId = useStore((s) => s.sceneId);
  const progress = useStore((s) => s.videoProgress);
  const ref = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState(() => videoOptions(project));
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  /** From the press on the button until the export has ended, also while the file is being chosen. */
  const [busy, setBusy] = useState(false);
  const count = project.scenes.length;
  const current = Math.max(
    0,
    project.scenes.findIndex((s) => s.id === sceneId),
  );
  const [format, setFormat] = useState<VideoRequest['format']>('mp4');
  const [range, setRange] = useState<Range>('all');
  const [fromText, setFromText] = useState(String(current + 1));
  const [toText, setToText] = useState(String(current + 1));
  const [gifWidth, setGifWidth] = useState<number>(640);
  const running = progress !== null;
  const locked = running || busy;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    void hasFfmpeg().then(setFfmpeg);
  }, []);

  const close = (): void => {
    if (locked) return;
    useStore.getState().setVideoDialog(false);
  };

  // Which slides: the first and the last, counted from 0, or nothing when the numbers make no sense.
  const fromN = parseSlide(fromText, count);
  const toN = parseSlide(toText, count);
  const span: [number, number] | null =
    range === 'all'
      ? [0, count - 1]
      : range === 'current'
        ? [current, current]
        : fromN !== undefined && toN !== undefined && fromN <= toN
          ? [fromN - 1, toN - 1]
          : null;
  const chosen = span ? project.scenes.slice(span[0], span[1] + 1) : [];
  const seconds = schedule(chosen).total;
  const whole = span !== null && span[0] === 0 && span[1] === count - 1;
  const gif = format === 'gif';
  const tooLong = gif && seconds > GIF_MAX_SECONDS + 0.5;

  const withSound = chosen.filter(hasSound).length;
  const withScript = chosen.filter((s) => s.script.trim() !== '').length;
  const credits = collectCredits(project).length;
  const hasVideoElements = chosen.some((s) => s.elements.some((e) => e.type === 'video'));
  const done = progress ? Math.round((progress.frame / Math.max(1, progress.frames)) * 100) : 0;
  const gifHeight = Math.round((gifWidth * VIDEO_SIZE.height) / VIDEO_SIZE.width);
  const slides = chosen.length === 1 ? '1 lysark' : `${chosen.length} lysark`;

  return (
    <dialog
      ref={ref}
      className="dialog dialog-wide video-dialog"
      onClose={close}
      onCancel={(event) => {
        // Esc must not close the dialog under a running export.
        if (locked) event.preventDefault();
        else close();
      }}
    >
      <h2>Eksporter video eller GIF</h2>
      <section>
        <label className="field">
          <span className="field-label">Filtype</span>
          <select
            value={format}
            disabled={locked}
            onChange={(e) => setFormat(e.target.value as VideoRequest['format'])}
          >
            <option value="mp4">Video (MP4) med lyd og teksting</option>
            <option value="gif">GIF: et kort klipp uten lyd</option>
          </select>
        </label>
        <fieldset className="video-range">
          <legend className="field-label">Hvilke lysark</legend>
          <label className="check">
            <input
              type="radio"
              name="video-range"
              checked={range === 'all'}
              disabled={locked}
              onChange={() => setRange('all')}
            />
            Hele forelesningen
          </label>
          <label className="check">
            <input
              type="radio"
              name="video-range"
              checked={range === 'current'}
              disabled={locked}
              onChange={() => setRange('current')}
            />
            Bare dette lysarket (nr. {current + 1})
          </label>
          <label className="check">
            <input
              type="radio"
              name="video-range"
              checked={range === 'some'}
              disabled={locked}
              onChange={() => setRange('some')}
            />
            Fra lysark
            <input
              type="text"
              inputMode="numeric"
              className="video-number"
              aria-label="Første lysark"
              value={fromText}
              disabled={locked}
              onFocus={() => setRange('some')}
              onChange={(e) => setFromText(e.target.value)}
            />
            til
            <input
              type="text"
              inputMode="numeric"
              className="video-number"
              aria-label="Siste lysark"
              value={toText}
              disabled={locked}
              onFocus={() => setRange('some')}
              onChange={(e) => setToText(e.target.value)}
            />
          </label>
        </fieldset>
        {span === null ? (
          <p className="video-missing" role="alert">
            Skriv to lysarknumre mellom 1 og {count}, det første ikke høyere enn det siste.
          </p>
        ) : gif ? (
          <p>
            GIF, {gifWidth} × {gifHeight}, {String(GIF_FPS).replace('.', ',')} bilder i sekundet,
            uten lyd. Lengde: <strong>{formatTime(seconds)}</strong> ({slides}).
          </p>
        ) : (
          <p>
            MP4, {VIDEO_SIZE.width} × {VIDEO_SIZE.height}, {VIDEO_FPS} bilder i sekundet. Lengde:{' '}
            <strong>{formatTime(seconds)}</strong> ({slides}, {withSound} med lyd).
          </p>
        )}
        {tooLong && (
          <p className="video-missing" role="alert">
            En GIF kan være høyst {GIF_MAX_SECONDS / 60} minutter, for lengre blir fila svært stor.
            Velg færre lysark, eller eksporter video.
          </p>
        )}
        {span !== null && withSound < chosen.length && (
          <p className="hint">
            Lysark uten lyd står i noen sekunder hver. Lengden bestemmer du med en pause i
            lydpanelet.
          </p>
        )}
      </section>
      <section>
        <label className="field">
          <span className="field-label">Mellom lysarkene</span>
          <select
            value={choices.transition}
            disabled={locked}
            onChange={(e) =>
              setChoices({ ...choices, transition: e.target.value as 'cut' | 'fade' })
            }
          >
            <option value="cut">Rent klipp</option>
            <option value="fade">Kort toning (0,3 s)</option>
          </select>
        </label>
        {gif ? (
          <label className="field">
            <span className="field-label">Bredde</span>
            <select
              value={gifWidth}
              disabled={locked}
              onChange={(e) => setGifWidth(Number(e.target.value))}
            >
              {GIF_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width} piksler
                  {width === 640 ? ' (passer i en nettside eller e-post)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={choices.evenLoudness}
                disabled={locked}
                onChange={(e) => setChoices({ ...choices, evenLoudness: e.target.checked })}
              />
              Jevn lydstyrke gjennom hele videoen
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={choices.credits && credits > 0 && whole}
                disabled={locked || credits === 0 || !whole}
                onChange={(e) => setChoices({ ...choices, credits: e.target.checked })}
              />
              Avslutt med «Bildekilder»
              {credits === 0
                ? ' (ingen bilder har kreditering)'
                : whole
                  ? ` (${credits} bilder)`
                  : ' (bare når hele forelesningen eksporteres)'}
            </label>
          </>
        )}
      </section>
      <section>
        <p className="hint">
          {gif
            ? 'En GIF spiller av seg selv i en løkke, uten lyd og uten teksting. Den passer til korte klipp, for eksempel ett lysark der stegene kommer inn.'
            : withScript > 0
              ? `Teksting lages av manuset (${withScript} lysark har manus) og lagres som egen fil ved siden av videoen (.vtt). Tidene er beregnet ut fra tekstens lengde, ikke lyttet fram.`
              : 'Ingen av lysarkene har manus, så det lages ikke teksting.'}{' '}
          «+»-merker og «Lær mer» vises ikke.
          {hasVideoElements
            ? ' Video inne i et lysark vises som stillbilde (første bilde, eller forhåndsbildet).'
            : ''}
        </p>
        {ffmpeg === false && (
          <p className="video-missing" role="alert">
            FFmpeg mangler, så video og GIF kan ikke lages. Det skal ligge ved siden av programmet.
            Kjører du fra kildekoden, hentes det med «npm run fetch:ffmpeg».
          </p>
        )}
      </section>
      {running && (
        <div className="video-progress" role="status">
          <progress max={100} value={progress.phase === 'frames' ? done : undefined} />
          <span>
            {progress.phase === 'sound'
              ? 'Setter sammen lyden …'
              : progress.phase === 'finishing'
                ? 'Gjør videoen ferdig …'
                : progress.phase === 'gif'
                  ? 'Lager GIF-fila …'
                  : `Tegner bilde ${progress.frame.toLocaleString('nb-NO')} av ${progress.frames.toLocaleString('nb-NO')} (${done} %)`}
          </span>
        </div>
      )}
      <div className="dialog-actions">
        {running ? (
          <button type="button" onClick={cancelVideo}>
            Avbryt eksporten
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={close}>
              Lukk
            </button>
            <button
              type="button"
              className="strong"
              disabled={busy || ffmpeg !== true || span === null || tooLong}
              onClick={() => {
                if (!span) return;
                setBusy(true);
                void exportVideo(
                  { ...choices, credits: choices.credits && credits > 0 },
                  { format, from: span[0], to: span[1], gifWidth },
                ).finally(() => setBusy(false));
              }}
            >
              {gif ? 'Eksporter GIF …' : 'Eksporter video …'}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
