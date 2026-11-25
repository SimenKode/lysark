// Dialogs: the import report, and project and logo settings.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ImportReport } from '../../shared/api';
import {
  cancelPdfImport,
  chooseClosingAnimation,
  chooseLogoFolder,
  clearClosingAnimation,
  clearLogos,
} from './actions';
import { useStore, type ImportLook, type LookRequest } from './store';

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
  /** Slides that now play USN's closing animation by themselves. */
  closingSlides?: number[];
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
        Notatene ble manus på {count(report.notes, 'lysark', 'lysark')}.
      </p>
      <p>
        Plasseringen er beholdt fra PowerPoint. Skrift og farger følger USN-temaet. Se gjennom
        lysarkene, og bruk «Rydd opp lysarket» der noe står skjevt.
      </p>
      {props.closingSlides && props.closingSlides.length > 0 && (
        <p>
          USNs avslutningsanimasjon lå som video på lysark {props.closingSlides.join(' og ')}.
          Lysark har tatt vare på filmen, og lysarket spiller den nå av seg selv når det vises, uten
          knapper og uten lyd.
        </p>
      )}
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
          <p className="hint">Merknadene står også på hvert lysark, under fanen «Lysark».</p>
        </>
      )}
    </Dialog>
  );
}

/** What each look means for each kind of file, in the lecturer's words. */
const LOOKS: Record<LookRequest['kind'], Record<ImportLook, { name: string; text: string }>> = {
  pptx: {
    keep: {
      name: 'Behold utseendet',
      text:
        'Lysarkene ser ut som i PowerPoint. Tekst og bilder kan flyttes og endres, men skriften blir ' +
        'Lysarks egen. Manus og kapitler følger med. Animasjoner og video i lysarkene følger ikke med. ' +
        'Utseendet hentes fra en PDF av presentasjonen: PowerPoint lager den i bakgrunnen, eller ' +
        'Lysark bruker en PDF med samme navn som ligger ved siden av, eller LibreOffice lager den.',
    },
    theme: {
      name: 'Gjør om til USN-stil',
      text:
        'Innholdet settes inn i USN-stilen: farger, skrifter, logo og former. Manus, kapitler, tabeller ' +
        'og video følger med. Det som må lages på nytt, står i en rapport etterpå.',
    },
  },
  pdf: {
    keep: {
      name: 'Behold utseendet',
      text:
        'Lysarkene ser ut som sidene i PDF-en. Tekst og bilder kan flyttes og endres, men skriften blir ' +
        'Lysarks egen.',
    },
    theme: {
      name: 'Gjør om til USN-stil',
      text:
        'Teksten og bildene settes på USN-stilens flate, i dens skrifter og farger, med logo. Streker, ' +
        'former og bakgrunn fra PDF-en følger ikke med.',
    },
  },
};

/** Asks how the slides of a file that is being imported are to look. The choice is free. */
export function LookDialog({ request }: { request: LookRequest }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [look, setLook] = useState<ImportLook>('keep');
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const answer = (choice: ImportLook | undefined): void => {
    useStore.getState().setLookRequest(null);
    request.resolve(choice);
  };
  return (
    <dialog
      ref={ref}
      className="dialog look-dialog"
      onCancel={(event) => {
        event.preventDefault();
        answer(undefined);
      }}
    >
      <h2>Hvordan skal lysarkene se ut?</h2>
      <p>
        <strong>{request.name}</strong>
      </p>
      <fieldset className="look-choice">
        <legend className="field-label">Velg fritt. Innholdet er det samme.</legend>
        {(['keep', 'theme'] as const).map((choice) => (
          <label key={choice} className="look-option">
            <input
              type="radio"
              name="import-look"
              checked={look === choice}
              onChange={() => setLook(choice)}
            />
            <span>
              <strong>{LOOKS[request.kind][choice].name}</strong>
              <span>{LOOKS[request.kind][choice].text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="dialog-actions">
        <button type="button" onClick={() => answer(undefined)}>
          Avbryt
        </button>
        <button type="button" className="strong" onClick={() => answer(look)}>
          Importer
        </button>
      </div>
    </dialog>
  );
}

/** Shown while a PDF is imported. It cannot be closed, only stopped. */
export function PdfImportDialog() {
  const progress = useStore((s) => s.pdfProgress);
  const [stopping, setStopping] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  if (!progress) return null;
  const stop = (): void => {
    setStopping(true);
    cancelPdfImport();
  };
  return (
    <dialog
      ref={ref}
      className="dialog pdf-import"
      onCancel={(event) => {
        // Escape stops the import; the dialog goes away when the import has let go.
        event.preventDefault();
        stop();
      }}
    >
      <h2>{/\.pptx$/i.test(progress.name) ? 'Importerer PowerPoint' : 'Importerer PDF'}</h2>
      <p>
        <strong>{progress.name}</strong>
      </p>
      <p role="status">
        {stopping
          ? 'Avbryter …'
          : progress.preparing
            ? 'Lager en kopi av presentasjonen som PDF, så lysarkene kan beholde utseendet sitt. Det kan ta et minutt …'
            : progress.pages > 0
              ? `Importerer side ${progress.page} av ${progress.pages} …`
              : 'Leser PDF-fila …'}
      </p>
      {progress.pages > 0 ? (
        <progress max={progress.pages} value={progress.page - 1} />
      ) : (
        <progress />
      )}
      <div className="dialog-actions">
        <button type="button" onClick={stop} disabled={stopping}>
          Avbryt
        </button>
      </div>
    </dialog>
  );
}

export function SettingsDialog(props: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const logo = useStore((s) => s.logo);
  const update = useStore((s) => s.update);
  const anyLogo = logo.nb.light || logo.nb.dark || logo.en.light || logo.en.dark;
  const found = (set: { light: boolean; dark: boolean }): string =>
    set.light && set.dark
      ? 'funnet (lilla og hvit)'
      : set.light
        ? 'bare lilla funnet'
        : set.dark
          ? 'bare hvit funnet'
          : 'ikke valgt';
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
          Velg mappa der USNs logopakke er pakket ut. Lysark finner hovedlogoen i lilla og hvit, på
          norsk og engelsk, kopierer filene uendret og plasserer logoen nede til venstre etter
          designmanualen. Logoen kan ikke endres i programmet.
        </p>
        <ul className="logo-status">
          <li className={logo.nb.light && logo.nb.dark ? 'ok' : 'hint'}>
            Norsk logo: {found(logo.nb)}
          </li>
          <li className={logo.en.light && logo.en.dark ? 'ok' : 'hint'}>
            Engelsk logo: {found(logo.en)}
          </li>
        </ul>
        <div className="button-row">
          <button type="button" onClick={() => void chooseLogoFolder()}>
            Velg mappa med logopakka
          </button>
          {anyLogo && (
            <button type="button" onClick={() => void clearLogos()}>
              Fjern logoen
            </button>
          )}
        </div>
      </section>
      <section>
        <h3>USNs avslutningsanimasjon</h3>
        <p>
          Filmen der USNs logo tegnes opp, slik den ligger på siste lysark i USNs PowerPoint-mal.
          Lysark tar vare på en kopi, helt uendret, og avslutningslysark kan spille den av seg selv:
          én gang, uten knapper og uten lyd. Importerer du en forelesning som har den, plukkes den
          opp automatisk.
        </p>
        <ul className="logo-status">
          <li className={logo.closing ? 'ok' : 'hint'}>
            {logo.closing
              ? `Avslutningsanimasjon: funnet (${Math.round(logo.closing.seconds)} sekunder)`
              : 'Avslutningsanimasjon: ikke valgt'}
          </li>
        </ul>
        <div className="button-row">
          <button type="button" onClick={() => void chooseClosingAnimation()}>
            Velg videofila
          </button>
          {logo.closing && (
            <button type="button" onClick={() => void clearClosingAnimation()}>
              Fjern animasjonen
            </button>
          )}
        </div>
      </section>
    </Dialog>
  );
}
