// The dialog for exporting the lecture as video: the few choices there are,
// what will come out, and how far the export has come.
import { useEffect, useRef, useState } from 'react';
import { collectCredits } from '../../shared/render/more';
import {
  VIDEO_FPS,
  VIDEO_SIZE,
  formatTime,
  hasSound,
  schedule,
  videoOptions,
} from '../../shared/render/clock';
import { cancelVideo, exportVideo, hasFfmpeg } from './actions';
import { useStore } from './store';

export function VideoDialog() {
  const project = useStore((s) => s.project)!;
  const progress = useStore((s) => s.videoProgress);
  const ref = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState(() => videoOptions(project));
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  /** From the press on the button until the export has ended, also while the file is being chosen. */
  const [busy, setBusy] = useState(false);
  const running = progress !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    void hasFfmpeg().then(setFfmpeg);
  }, []);

  const close = (): void => {
    if (running || busy) return;
    useStore.getState().setVideoDialog(false);
  };

  const plan = schedule(project.scenes);
  const withSound = project.scenes.filter(hasSound).length;
  const withScript = project.scenes.filter((s) => s.script.trim() !== '').length;
  const credits = collectCredits(project).length;
  const hasVideoElements = project.scenes.some((s) => s.elements.some((e) => e.type === 'video'));
  const done = progress ? Math.round((progress.frame / Math.max(1, progress.frames)) * 100) : 0;

  return (
    <dialog
      ref={ref}
      className="dialog dialog-wide video-dialog"
      onClose={close}
      onCancel={(event) => {
        // Esc must not close the dialog under a running export.
        if (running || busy) event.preventDefault();
        else close();
      }}
    >
      <h2>Eksporter video</h2>
      <p>
        MP4, {VIDEO_SIZE.width} × {VIDEO_SIZE.height}, {VIDEO_FPS} bilder i sekundet. Lengde:{' '}
        <strong>{formatTime(plan.total)}</strong> ({project.scenes.length} lysark, {withSound} med
        lyd).
      </p>
      {withSound < project.scenes.length && (
        <p className="hint">
          Lysark uten lyd står i noen sekunder hver. Lengden bestemmer du med en pause i lydpanelet.
        </p>
      )}
      <section>
        <label className="field">
          <span className="field-label">Mellom lysarkene</span>
          <select
            value={choices.transition}
            disabled={running}
            onChange={(e) =>
              setChoices({ ...choices, transition: e.target.value as 'cut' | 'fade' })
            }
          >
            <option value="cut">Rent klipp</option>
            <option value="fade">Kort toning (0,3 s)</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={choices.evenLoudness}
            disabled={running}
            onChange={(e) => setChoices({ ...choices, evenLoudness: e.target.checked })}
          />
          Jevn lydstyrke gjennom hele videoen
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={choices.credits && credits > 0}
            disabled={running || credits === 0}
            onChange={(e) => setChoices({ ...choices, credits: e.target.checked })}
          />
          Avslutt med «Bildekilder»
          {credits === 0 ? ' (ingen bilder har kreditering)' : ` (${credits} bilder)`}
        </label>
      </section>
      <section>
        <p className="hint">
          {withScript > 0
            ? `Teksting lages av manuset (${withScript} lysark har manus) og lagres som egen fil ved siden av videoen (.vtt). Tidene er beregnet ut fra tekstens lengde, ikke lyttet fram.`
            : 'Ingen lysark har manus, så det lages ikke teksting.'}{' '}
          «+»-merker og «Lær mer» vises ikke i video.
          {hasVideoElements
            ? ' Video inne i et lysark vises som stillbilde (første bilde, eller forhåndsbildet).'
            : ''}
        </p>
        {ffmpeg === false && (
          <p className="video-missing" role="alert">
            FFmpeg mangler, så video kan ikke lages. Det skal ligge ved siden av programmet. Kjører
            du fra kildekoden, hentes det med «node tools/fetch-ffmpeg.mjs».
          </p>
        )}
      </section>
      {running && (
        <div className="video-progress" role="status">
          <progress max={100} value={progress.phase === 'sound' ? undefined : done} />
          <span>
            {progress.phase === 'sound'
              ? 'Setter sammen lyden …'
              : progress.phase === 'finishing'
                ? 'Gjør videoen ferdig …'
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
              disabled={busy || ffmpeg !== true || project.scenes.length === 0}
              onClick={() => {
                setBusy(true);
                void exportVideo({ ...choices, credits: choices.credits && credits > 0 }).finally(
                  () => setBusy(false),
                );
              }}
            >
              Eksporter video …
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
