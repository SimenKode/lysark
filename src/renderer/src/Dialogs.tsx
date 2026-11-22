// Dialogs: the import report, and project and logo settings.
import { useEffect, useRef, type ReactNode } from 'react';
import type { ImportReport } from '../../shared/api';
import { chooseLogo, clearLogo } from './actions';
import { useStore } from './store';

function Dialog(props: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog${props.wide ? ' dialog-wide' : ''}`}
      onClose={props.onClose}
      onCancel={props.onClose}
    >
      <h2>{props.title}</h2>
      {props.children}
      <div className="dialog-actions">
        <button type="button" className="strong" onClick={props.onClose}>
          Lukk
        </button>
      </div>
    </dialog>
  );
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function ImportReportDialog(props: {
  report: ImportReport;
  sourceName: string;
  onClose: () => void;
}) {
  const { report } = props;
  const setScene = useStore((s) => s.setScene);
  const project = useStore((s) => s.project);
  const bySlide = new Map<number, string[]>();
  for (const w of report.warnings) {
    bySlide.set(w.slide, [...(bySlide.get(w.slide) ?? []), w.message]);
  }
  const go = (slide: number): void => {
    const scene = project?.scenes.find((s) => s.imported?.slide === slide);
    if (scene) setScene(scene.id);
    props.onClose();
  };
  return (
    <Dialog title="Importen er ferdig" onClose={props.onClose} wide>
      <p>
        <strong>{props.sourceName}</strong> er importert som et utkast:{' '}
        {count(report.slides, 'lysark', 'lysark')}, {count(report.texts, 'tekst', 'tekster')},{' '}
        {count(report.images, 'bilde', 'bilder')}, {count(report.tables, 'tabell', 'tabeller')},{' '}
        {count(report.shapes, 'form', 'former')} og {count(report.videos, 'video', 'videoer')}.
        Notatene ble manus på {count(report.notes, 'scene', 'scener')}.
      </p>
      <p>
        Plasseringen er beholdt fra PowerPoint. Skrift og farger følger USN-temaet. Se gjennom
        scenene, og bruk «Tilpass til rutenett» der noe står skjevt.
      </p>
      {bySlide.size === 0 ? (
        <p>Alt innholdet kom med.</p>
      ) : (
        <>
          <h3>Dette må du se på</h3>
          <ul className="report-list">
            {[...bySlide.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([slide, messages]) => (
                <li key={slide}>
                  <button type="button" className="link-button" onClick={() => go(slide)}>
                    Lysark {slide}
                  </button>
                  <ul>
                    {messages.map((message, i) => (
                      <li key={i}>{message}</li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
          <p className="hint">Merknadene står også på hver scene, under fanen «Scene».</p>
        </>
      )}
    </Dialog>
  );
}

function LogoRow(props: { variant: 'light' | 'dark'; label: string; ready: boolean }) {
  return (
    <div className="logo-row">
      <div>
        <strong>{props.label}</strong>
        <div className={props.ready ? 'ok' : 'hint'}>{props.ready ? 'Valgt' : 'Ikke valgt'}</div>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => void chooseLogo(props.variant)}>
          Velg fil …
        </button>
        {props.ready && (
          <button type="button" onClick={() => void clearLogo(props.variant)}>
            Fjern
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsDialog(props: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const logo = useStore((s) => s.logo);
  const update = useStore((s) => s.update);
  return (
    <Dialog title="Innstillinger" onClose={props.onClose} wide>
      {project && (
        <section>
          <h3>Denne forelesningen</h3>
          <label className="field">
            <span className="field-label">Tittel</span>
            <input
              type="text"
              value={project.meta.title}
              onChange={(e) =>
                update((d) => {
                  d.meta.title = e.target.value;
                }, 'meta-title')
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Språk på knapper og hjelpetekster i HTML-fila</span>
            <select
              value={project.meta.language}
              onChange={(e) =>
                update((d) => {
                  d.meta.language = e.target.value as 'nb' | 'en';
                })
              }
            >
              <option value="nb">Bokmål</option>
              <option value="en">Engelsk</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={project.export.showScript}
              onChange={(e) =>
                update((d) => {
                  d.export.showScript = e.target.checked;
                })
              }
            />
            La studentene åpne manuset i HTML-fila
          </label>
        </section>
      )}
      <section>
        <h3>USNs logo</h3>
        <p>
          Velg originalfilene fra USNs logopakke (SVG eller PNG). Lysark kopierer filene uendret og
          plasserer logoen nede til venstre etter designmanualen. Logoen kan ikke endres i
          programmet.
        </p>
        <LogoRow
          variant="light"
          label="Til lyse flater (lilla eller sort logo)"
          ready={logo.light}
        />
        <LogoRow variant="dark" label="Til lilla og indigo flater (hvit logo)" ready={logo.dark} />
      </section>
    </Dialog>
  );
}
