// The media dialog: three ways to a picture or a video. Search in Wikimedia
// Commons (pictures only), upload a file, or reuse what the project already
// has. Whatever is chosen comes back as an asset in the project.
import { useEffect, useRef, useState } from 'react';
import { mediaUrl, type AddedMedia, type CommonsPicture } from '../../shared/api';
import type { Asset, Credit } from '../../shared/format/schema';
import { creditText, hasCredit } from '../../shared/render/more';
import { SCENE_STRINGS } from '../../shared/render/scene';
import {
  commonsPreview,
  downloadCommonsPicture,
  megabytes,
  searchCommons,
  uploadMedia,
} from './actions';
import { useStore, type MediaRequest } from './store';

type Tab = 'commons' | 'upload' | 'project';

const STRINGS = SCENE_STRINGS.nb;

function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

/**
 * Who made a picture and on what terms. Free to edit for the owner's own
 * files; fixed for pictures whose licence demands that it is shown.
 */
export function CreditFields(props: {
  credit: Credit | undefined;
  onChange: (credit: Credit | undefined) => void;
}) {
  const credit = props.credit ?? {};
  if (credit.required) {
    return (
      <div className="credit-fixed">
        <p>{creditText(credit, STRINGS)}</p>
        <p className="hint">
          Lisensen krever at dette vises sammen med bildet. Lysark setter det inn under bildet i
          «Lær mer» og i «Bildekilder», og det kan ikke fjernes.
        </p>
      </div>
    );
  }
  const set = (key: 'title' | 'author' | 'license' | 'sourceUrl', value: string): void => {
    const next: Credit = { ...credit };
    if (value.trim()) next[key] = value;
    else delete next[key];
    props.onChange(Object.keys(next).length > 0 ? next : undefined);
  };
  return (
    <div className="credit-fields">
      <label className="field">
        <span className="field-label">Opphavsperson</span>
        <input
          type="text"
          value={credit.author ?? ''}
          onChange={(e) => set('author', e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Tittel på bildet</span>
        <input
          type="text"
          value={credit.title ?? ''}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Lisens</span>
        <input
          type="text"
          placeholder="For eksempel CC BY 4.0"
          value={credit.license ?? ''}
          onChange={(e) => set('license', e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Kilde (nettadresse)</span>
        <input
          type="text"
          placeholder="https://"
          value={credit.sourceUrl ?? ''}
          onChange={(e) => set('sourceUrl', e.target.value)}
        />
      </label>
      <p className="hint">
        Frivillig for dine egne bilder. Det du fyller inn, vises under bildet i «Lær mer» og i
        «Bildekilder».
      </p>
    </div>
  );
}

// ---------- Search in Wikimedia Commons ----------

function CommonsTab({ onInsert }: { onInsert: (added: AddedMedia) => void }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [hits, setHits] = useState<CommonsPicture[]>([]);
  const [next, setNext] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CommonsPicture | null>(null);
  const [large, setLarge] = useState<CommonsPicture | null>(null);
  const [fetching, setFetching] = useState(false);
  const run = useRef(0);

  const search = async (offset: number): Promise<void> => {
    const words = offset === 0 ? query.trim() : searched;
    if (!words) return;
    const id = ++run.current;
    setBusy(true);
    setError('');
    try {
      const result = await searchCommons(words, offset);
      if (id !== run.current) return;
      setHits(offset === 0 ? result.hits : [...hits, ...result.hits]);
      setNext(result.next);
      setSearched(words);
      if (offset === 0) {
        setSelected(null);
        setLarge(null);
      }
    } catch (e) {
      if (id === run.current) setError(errorText(e));
    } finally {
      if (id === run.current) setBusy(false);
    }
  };

  const chosen = useRef('');
  const choose = (hit: CommonsPicture): void => {
    chosen.current = hit.title;
    setSelected(hit);
    setLarge(null);
    setError('');
    void commonsPreview(hit.title).then(
      (picture) => {
        if (chosen.current === hit.title) setLarge(picture);
      },
      () => undefined, // the small picture stays; inserting reports any real problem
    );
  };

  const insert = async (): Promise<void> => {
    if (!selected) return;
    setFetching(true);
    setError('');
    try {
      onInsert(await downloadCommonsPicture(selected.title));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="media-tab">
      <p className="hint">
        Søket sendes til Wikimedia Commons. Bare søkeordene følger med, ingenting om deg eller
        prosjektet. Du får bare treff som kan brukes fritt eller med navngivelse (CC BY og CC
        BY-SA); Lysark setter inn navngivelsen for deg.
      </p>
      <form
        className="media-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(0);
        }}
      >
        <input
          type="search"
          aria-label="Søk i Wikimedia Commons"
          placeholder="Søk etter bilder"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="strong" disabled={busy || !query.trim()}>
          {busy ? 'Søker' : 'Søk'}
        </button>
      </form>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      <div className="media-split">
        <div className="media-results" aria-live="polite">
          {searched && !busy && hits.length === 0 && !error && (
            <p className="hint">Ingen treff på «{searched}» med en lisens som kan brukes.</p>
          )}
          <ul className="media-grid" aria-label="Treff">
            {hits.map((hit) => (
              <li key={hit.title}>
                <button
                  type="button"
                  className="media-tile"
                  aria-pressed={selected?.title === hit.title}
                  onClick={() => choose(hit)}
                  title={hit.credit.title}
                >
                  <img src={hit.thumbUrl} alt={hit.credit.title ?? hit.title} loading="lazy" />
                  <span className="media-badge">{hit.credit.license || 'Fri bruk'}</span>
                </button>
              </li>
            ))}
          </ul>
          {next !== undefined && hits.length > 0 && (
            <button type="button" disabled={busy} onClick={() => void search(next)}>
              {busy ? 'Henter' : 'Vis flere'}
            </button>
          )}
        </div>
        {selected && (
          <aside className="media-detail" aria-label="Valgt bilde">
            <img src={(large ?? selected).thumbUrl} alt={selected.credit.title ?? selected.title} />
            <h3>{selected.credit.title}</h3>
            <dl>
              <dt>Opphavsperson</dt>
              <dd>{selected.credit.author || 'Ikke oppgitt'}</dd>
              <dt>Lisens</dt>
              <dd>{selected.credit.license || 'Fri bruk'}</dd>
              <dt>Størrelse</dt>
              <dd>
                {selected.width} × {selected.height} px
                {selected.width > 1920 ? ' (hentes i 1920 px bredde)' : ''}
              </dd>
            </dl>
            <button
              type="button"
              className="strong"
              disabled={fetching}
              onClick={() => void insert()}
            >
              {fetching ? 'Henter bildet' : 'Sett inn'}
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------- Upload ----------

function UploadTab(props: { kind: MediaRequest['kind']; onInsert: (added: AddedMedia) => void }) {
  const [added, setAdded] = useState<AddedMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const image = props.kind === 'image';

  const choose = async (): Promise<void> => {
    setBusy(true);
    const file = await uploadMedia(props.kind);
    setBusy(false);
    if (file) setAdded(file);
  };

  return (
    <div className="media-tab">
      <p className="hint">
        {image
          ? 'Velg et bilde fra maskinen: PNG, JPG, GIF, SVG, WebP eller BMP.'
          : 'Velg en video fra maskinen: MP4 (H.264) eller WebM.'}{' '}
        Fila kopieres inn i prosjektmappa.
      </p>
      <div className="button-row">
        <button
          type="button"
          className={added ? '' : 'strong'}
          disabled={busy}
          onClick={() => void choose()}
        >
          {added ? 'Velg en annen fil' : 'Last opp medie'}
        </button>
      </div>
      {added && (
        <div className="media-split">
          <div className="media-results">
            {image ? (
              <img className="media-upload-preview" src={mediaUrl(added.asset.file)} alt="" />
            ) : (
              <p>
                {added.asset.name ?? 'Videofil'} ({megabytes(added.asset.bytes)})
              </p>
            )}
          </div>
          <aside className="media-detail" aria-label="Valgt fil">
            <h3>{added.asset.name}</h3>
            {image && (
              <CreditFields
                credit={added.asset.credit}
                onChange={(credit) => {
                  const asset: Asset = { ...added.asset };
                  if (credit) asset.credit = credit;
                  else delete asset.credit;
                  setAdded({ id: added.id, asset });
                }}
              />
            )}
            <button type="button" className="strong" onClick={() => props.onInsert(added)}>
              Sett inn
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

// ---------- What the project already has ----------

function ProjectTab(props: { kind: MediaRequest['kind']; onPick: (assetId: string) => void }) {
  const project = useStore((s) => s.project)!;
  const update = useStore((s) => s.update);
  const [selected, setSelected] = useState<string | null>(null);
  const assets = Object.entries(project.assets).filter(([, asset]) => asset.kind === props.kind);
  const current = selected ? project.assets[selected] : undefined;

  if (assets.length === 0) {
    return (
      <div className="media-tab">
        <p className="hint">
          Prosjektet har ingen {props.kind === 'image' ? 'bilder' : 'videoer'} ennå.
        </p>
      </div>
    );
  }
  return (
    <div className="media-tab">
      <div className="media-split">
        <div className="media-results">
          <ul className="media-grid" aria-label="Medier i prosjektet">
            {assets.map(([id, asset]) => (
              <li key={id}>
                <button
                  type="button"
                  className="media-tile"
                  aria-pressed={selected === id}
                  onClick={() => setSelected(id)}
                  title={asset.name}
                >
                  {asset.kind === 'image' ? (
                    <img src={mediaUrl(asset.file)} alt={asset.name ?? 'Bilde'} loading="lazy" />
                  ) : (
                    <span className="media-file">{asset.name ?? 'Video'}</span>
                  )}
                  {hasCredit(asset.credit) && asset.credit.license && (
                    <span className="media-badge">{asset.credit.license}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {selected && current && (
          <aside className="media-detail" aria-label="Valgt medie">
            <h3>{current.name ?? (current.kind === 'image' ? 'Bilde' : 'Video')}</h3>
            <p className="hint">{megabytes(current.bytes)}</p>
            {current.kind === 'image' && (
              <CreditFields
                credit={current.credit}
                onChange={(credit) =>
                  update((draft) => {
                    const asset = draft.assets[selected];
                    if (!asset) return;
                    if (credit) asset.credit = credit;
                    else delete asset.credit;
                  }, `credit-${selected}`)
                }
              />
            )}
            <button type="button" className="strong" onClick={() => props.onPick(selected)}>
              Sett inn
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------- The dialog ----------

export function MediaDialog({ request }: { request: MediaRequest }) {
  const ref = useRef<HTMLDialogElement>(null);
  const image = request.kind === 'image';
  const [tab, setTab] = useState<Tab>(image ? 'commons' : 'upload');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const insert = (added: AddedMedia): void => {
    useStore.getState().update((draft) => {
      draft.assets[added.id] = added.asset;
    });
    request.resolve(added.id);
  };

  const tabs: Array<[Tab, string]> = [
    ...(image ? ([['commons', 'Søk i Wikimedia Commons']] as Array<[Tab, string]>) : []),
    ['upload', 'Last opp'],
    ['project', 'I prosjektet'],
  ];

  return (
    <dialog
      ref={ref}
      className="dialog media-dialog"
      aria-labelledby="media-dialog-title"
      onClose={() => request.resolve(undefined)}
      onCancel={(e) => {
        e.preventDefault();
        request.resolve(undefined);
      }}
    >
      <div className="media-head">
        <h2 id="media-dialog-title">{image ? 'Velg bilde' : 'Velg video'}</h2>
        <button type="button" onClick={() => request.resolve(undefined)}>
          Avbryt
        </button>
      </div>
      <div className="tabs" role="tablist" aria-label="Hvor mediet hentes fra">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'strong' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'commons' && image && <CommonsTab onInsert={insert} />}
      {tab === 'upload' && <UploadTab kind={request.kind} onInsert={insert} />}
      {tab === 'project' && <ProjectTab kind={request.kind} onPick={(id) => request.resolve(id)} />}
    </dialog>
  );
}
