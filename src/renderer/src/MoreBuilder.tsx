// The builder for "Lær mer" content: a window over the workspace with the
// content on the left and, on the right, the slide itself with the box
// popped out beside the element, exactly as a student will see it (drawn
// and placed by the same code as the player uses).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl } from '../../shared/api';
import { newId, plainText, richText } from '../../shared/format/factory';
import { MORE_CORNERS, type Element, type More, type MoreBlock } from '../../shared/format/schema';
import { STAGE } from '../../shared/format/constants';
import { fetchFigure, figuresOn, type FetchedFigure } from '../../shared/layout/fetch';
import { slideNumbers } from '../../shared/layout/slides';
import {
  creditText,
  fitDrawings,
  hasCredit,
  placePopover,
  popoverWidth,
  renderMore,
} from '../../shared/render/more';
import { SCENE_STRINGS, moreCorner, moreTitle, renderDrawing } from '../../shared/render/scene';
import { embedTarget, youtubeRef } from '../../shared/render/web';
import { RichTextField } from './RichTextField';
import { SceneView, renderContext } from './SceneView';
import { fetchYouTubeStill, megabytes, pickMedia } from './actions';
import {
  BLOCK_NAMES,
  CORNER_NAMES,
  describeElement,
  moveBlock,
  newBlock,
  slideFigureName,
} from './ops';
import { currentScene, useStore } from './store';

type Block<K extends MoreBlock['kind']> = Extract<MoreBlock, { kind: K }>;

/** Changes the content being built. Creates it the first time something is added. */
function useMoreUpdate(elementId: string) {
  return (recipe: (more: More, element: Element) => void, coalesce?: string): void => {
    useStore.getState().updateScene(
      (scene) => {
        const element = scene.elements.find((e) => e.id === elementId);
        if (!element) return;
        element.more ??= { title: '', blocks: [] };
        recipe(element.more, element);
      },
      coalesce ? `more-${elementId}-${coalesce}` : undefined,
    );
  };
}

function useBlockUpdate<K extends MoreBlock['kind']>(elementId: string, blockId: string) {
  const update = useMoreUpdate(elementId);
  return (recipe: (block: Block<K>) => void, coalesce?: string): void =>
    update(
      (more) => {
        const block = more.blocks.find((b) => b.id === blockId);
        if (block) recipe(block as Block<K>);
      },
      coalesce ? `${blockId}-${coalesce}` : undefined,
    );
}

// ---------- Editors, one per kind of block ----------

function HeadingEditor({ elementId, block }: { elementId: string; block: Block<'heading'> }) {
  const update = useBlockUpdate<'heading'>(elementId, block.id);
  return (
    <input
      type="text"
      aria-label="Overskrift"
      placeholder="Overskrift"
      value={block.text}
      onChange={(e) =>
        update((b) => {
          b.text = e.target.value;
        }, 'text')
      }
    />
  );
}

function TextEditor({ elementId, block }: { elementId: string; block: Block<'text'> }) {
  const update = useBlockUpdate<'text'>(elementId, block.id);
  return (
    <RichTextField
      key={block.id}
      label="Tekst"
      value={block.content}
      onChange={(value) =>
        update((b) => {
          b.content = value;
        }, 'content')
      }
    />
  );
}

function ImageEditor({ elementId, block }: { elementId: string; block: Block<'image'> }) {
  const asset = useStore((s) => s.project?.assets[block.asset]);
  const update = useBlockUpdate<'image'>(elementId, block.id);
  return (
    <div className="block-media">
      <div className="block-thumb">
        {asset ? <img src={mediaUrl(asset.file)} alt="" /> : <span>Bildefila mangler</span>}
      </div>
      <div className="block-fields">
        <label className="field">
          <span className="field-label">Alternativ tekst</span>
          <input
            type="text"
            value={block.alt}
            onChange={(e) =>
              update((b) => {
                b.alt = e.target.value;
              }, 'alt')
            }
          />
          <span className="field-hint">
            Det skjermleseren leser opp i stedet for bildet. Beskriv det bildet viser.
          </span>
        </label>
        <label className="field">
          <span className="field-label">Bildetekst (vises under bildet)</span>
          <input
            type="text"
            value={block.caption ?? ''}
            onChange={(e) =>
              update((b) => {
                if (e.target.value) b.caption = e.target.value;
                else delete b.caption;
              }, 'caption')
            }
          />
        </label>
        {hasCredit(asset?.credit) && (
          <p className="hint">Kreditering: {creditText(asset.credit, SCENE_STRINGS.nb)}</p>
        )}
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              void pickMedia('image').then((id) => {
                if (id)
                  update((b) => {
                    b.asset = id;
                  });
              })
            }
          >
            Bytt bilde
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoEditor({ elementId, block }: { elementId: string; block: Block<'video'> }) {
  const assets = useStore((s) => s.project?.assets);
  const update = useBlockUpdate<'video'>(elementId, block.id);
  const [fetching, setFetching] = useState(false);
  const source = block.source;
  const file = source.kind === 'asset' ? assets?.[source.asset] : undefined;
  const poster = block.poster ? assets?.[block.poster] : undefined;
  const youtube = source.kind === 'url' ? youtubeRef(source.url) : undefined;
  const direct = source.kind === 'url' && /\.(mp4|m4v|webm|ogv)([?#]|$)/i.test(source.url);

  return (
    <div className="block-fields">
      <label className="field">
        <span className="field-label">Tittel</span>
        <input
          type="text"
          value={block.title}
          onChange={(e) =>
            update((b) => {
              b.title = e.target.value;
            }, 'title')
          }
        />
      </label>
      {source.kind === 'asset' ? (
        <>
          <p className="hint">
            {file ? `${file.name ?? 'Videofil'} (${megabytes(file.bytes)})` : 'Videofila mangler.'}
          </p>
          <div className="button-row">
            <button
              type="button"
              onClick={() =>
                void pickMedia('video').then((id) => {
                  if (id)
                    update((b) => {
                      b.source = { kind: 'asset', asset: id };
                    });
                })
              }
            >
              Bytt videofil
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Adresse</span>
            <input
              type="text"
              placeholder="https://"
              value={source.url}
              onChange={(e) =>
                update((b) => {
                  b.source = { kind: 'url', url: e.target.value };
                }, 'url')
              }
            />
            <span className="field-hint">
              {youtube
                ? 'YouTube-video. Studenten får YouTubes spiller i boksen; den hentes fra YouTube når boksen åpnes.'
                : direct
                  ? 'Direkte lenke til en videofil. Den spilles i boksen og krever nett.'
                  : source.url.trim()
                    ? 'Lenke til en videoside. Den åpnes i nettleseren og krever nett.'
                    : 'Lim inn adressen til en YouTube-video, en videoside eller en videofil.'}
            </span>
          </label>
          {youtube && (
            <div className="block-media">
              {poster && (
                <div className="block-thumb">
                  <img src={mediaUrl(poster.file)} alt="" />
                </div>
              )}
              <div className="block-fields">
                <div className="button-row">
                  <button
                    type="button"
                    disabled={fetching}
                    onClick={() => {
                      setFetching(true);
                      void fetchYouTubeStill(source.url).then((id) => {
                        setFetching(false);
                        if (id)
                          update((b) => {
                            b.poster = id;
                          });
                      });
                    }}
                  >
                    {fetching
                      ? 'Henter'
                      : poster
                        ? 'Hent forhåndsbilde på nytt'
                        : 'Hent forhåndsbilde'}
                  </button>
                  {poster && (
                    <button
                      type="button"
                      onClick={() =>
                        update((b) => {
                          delete b.poster;
                        })
                      }
                    >
                      Fjern forhåndsbildet
                    </button>
                  )}
                </div>
                <p className="hint">
                  Forhåndsbildet hentes fra YouTube når du trykker på knappen, og lagres i
                  prosjektet. Uten det viser kortet bare avspillingsknappen.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TableEditor({ elementId, block }: { elementId: string; block: Block<'table'> }) {
  const update = useBlockUpdate<'table'>(elementId, block.id);
  const columns = block.columns.length;
  return (
    <div className="block-fields">
      <div className="block-table" role="grid" aria-label="Tabell">
        {block.rows.map((row, r) => (
          <div key={r} className="block-table-row" role="row">
            {row.map((cell, c) => (
              <input
                key={c}
                type="text"
                role="gridcell"
                aria-label={`Rad ${r + 1}, kolonne ${c + 1}`}
                className={block.headerRow && r === 0 ? 'is-header' : ''}
                value={plainText(cell.content)}
                onChange={(e) =>
                  update((b) => {
                    const target = b.rows[r]?.[c];
                    if (target) target.content = richText(e.target.value);
                  }, `cell-${r}-${c}`)
                }
              />
            ))}
          </div>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={block.headerRow}
          onChange={(e) =>
            update((b) => {
              b.headerRow = e.target.checked;
            })
          }
        />
        Første rad er overskrifter
      </label>
      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            update((b) => {
              b.rows.push(
                Array.from({ length: b.columns.length }, () => ({ content: richText() })),
              );
            })
          }
        >
          Ny rad
        </button>
        <button
          type="button"
          disabled={block.rows.length <= 1}
          onClick={() =>
            update((b) => {
              b.rows.pop();
            })
          }
        >
          Fjern siste rad
        </button>
        <button
          type="button"
          disabled={columns >= 6}
          onClick={() =>
            update((b) => {
              b.columns.push(1);
              for (const row of b.rows) row.push({ content: richText() });
            })
          }
        >
          Ny kolonne
        </button>
        <button
          type="button"
          disabled={columns <= 1}
          onClick={() =>
            update((b) => {
              b.columns.pop();
              for (const row of b.rows) row.pop();
            })
          }
        >
          Fjern siste kolonne
        </button>
      </div>
    </div>
  );
}

function EmbedEditor({ elementId, block }: { elementId: string; block: Block<'embed'> }) {
  const update = useBlockUpdate<'embed'>(elementId, block.id);
  const target = embedTarget(block.url);
  const youtube = youtubeRef(block.url);
  return (
    <div className="block-fields">
      <label className="field">
        <span className="field-label">Adresse</span>
        <input
          type="text"
          placeholder="https://"
          value={block.url}
          onChange={(e) =>
            update((b) => {
              b.url = e.target.value;
            }, 'url')
          }
        />
        <span className={block.url.trim() && !target ? 'field-hint warning' : 'field-hint'}>
          {youtube
            ? 'YouTube-video: vises som video med avspillingsknapp.'
            : target
              ? `Studenten ser «Innhold fra ${target.host} – klikk for å laste». Ingenting hentes før hen klikker. Noen nettsteder tillater ikke å bli bygget inn; lenka «Åpne i nettleseren» virker uansett.`
              : block.url.trim()
                ? 'Adressen må begynne med https://'
                : 'Adressen til en side som skal vises i boksen, for eksempel en Panopto-video eller en GeoGebra-figur.'}
        </span>
      </label>
      <label className="field">
        <span className="field-label">Tittel</span>
        <input
          type="text"
          value={block.title}
          onChange={(e) =>
            update((b) => {
              b.title = e.target.value;
            }, 'title')
          }
        />
        <span className="field-hint">Sier hva innholdet er, også for skjermleser.</span>
      </label>
    </div>
  );
}

// ---------- A figure fetched from a slide ----------

/** A fetched figure drawn to fit a small frame: where one is chosen, and on its card. */
function DrawingThumb({ figure }: { figure: Pick<FetchedFigure, 'elements' | 'frame'> }) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const host = useRef<HTMLDivElement>(null);
  const { elements, frame } = figure;
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const stage = renderDrawing(renderContext(project, logo), elements, frame);
    el.replaceChildren(stage);
    // The frame has no size until it is shown (a dialog that is about to open), so it is measured then.
    const fit = (): void => {
      const scale = Math.min(el.clientWidth / frame.w, el.clientHeight / frame.h);
      stage.style.transform = `scale(${scale})`;
      stage.style.left = `${(el.clientWidth - frame.w * scale) / 2}px`;
      stage.style.top = `${(el.clientHeight - frame.h * scale) / 2}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, frame, project.assets, logo]);
  return <div ref={host} className="drawing-thumb" aria-hidden="true" />;
}

/**
 * The figures of the lecture's slides, to choose one from. A figure for a
 * "Lær mer" box is made on a slide and fetched from it (the owner's choice,
 * 25.11.2026); what goes into the box is a copy.
 */
function FigurePicker(props: { onPick: (figure: FetchedFigure) => void; onClose: () => void }) {
  const scenes = useStore((s) => s.project!.scenes);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const choices = useMemo(() => {
    const numbers = slideNumbers(scenes);
    return scenes.flatMap((scene, index) =>
      // A slide that is shown once more shows nothing of its own.
      scene.repeat
        ? []
        : figuresOn(scene).flatMap((figure) => {
            const fetched = fetchFigure(scene, figure, () => newId('e'));
            const name = `Lysark ${numbers[index]}: ${slideFigureName(figure)}`;
            return fetched ? [{ key: figure.ids[0]!, name, fetched }] : [];
          }),
    );
  }, [scenes]);
  return (
    <dialog
      ref={ref}
      className="dialog dialog-wide figure-picker"
      aria-labelledby="figure-picker-title"
      onClose={props.onClose}
      onCancel={props.onClose}
    >
      <h2 id="figure-picker-title">Hent en figur fra et lysark</h2>
      {choices.length === 0 ? (
        <p>
          Det er ingen figurer i lysarkene ennå. Lag figuren på et lysark først: «Sett inn → Figur»,
          merker på et bilde, eller flere former som du har gruppert. Kom så tilbake hit og hent
          den.
        </p>
      ) : (
        <>
          <p className="hint">
            En kopi av figuren legges i boksen. Figuren på lysarket blir stående; den kan du slette
            etterpå hvis den bare skulle hit.
          </p>
          <ul className="figure-choices">
            {choices.map((choice) => (
              <li key={choice.key}>
                <button
                  type="button"
                  className="figure-choice"
                  onClick={() => props.onPick(choice.fetched)}
                >
                  <DrawingThumb figure={choice.fetched} />
                  <span>{choice.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={props.onClose}>
          Avbryt
        </button>
      </div>
    </dialog>
  );
}

/** Says so when something of a figure could not come along into the box. */
function tellWhatWasLeft(figure: FetchedFigure): void {
  if (figure.left === 0) return;
  useStore.getState().setNotice({
    kind: 'info',
    text: 'Video og «Lær mer»-knapper følger ikke med inn i boksen. Resten av figuren er hentet.',
  });
}

function FigureEditor({ elementId, block }: { elementId: string; block: Block<'figure'> }) {
  const update = useBlockUpdate<'figure'>(elementId, block.id);
  const [picking, setPicking] = useState(false);
  return (
    <div className="block-media">
      <div className="block-thumb block-thumb-figure">
        <DrawingThumb figure={block} />
      </div>
      <div className="block-fields">
        <label className="field">
          <span className="field-label">Beskrivelse for skjermleser</span>
          <input
            type="text"
            value={block.alt}
            onChange={(e) =>
              update((b) => {
                b.alt = e.target.value;
              }, 'alt')
            }
          />
          <span className="field-hint">
            Si kort hva figuren viser. Teksten i figuren leses opp uansett.
          </span>
        </label>
        <label className="field">
          <span className="field-label">Figurtekst (vises under figuren)</span>
          <input
            type="text"
            value={block.caption ?? ''}
            onChange={(e) =>
              update((b) => {
                if (e.target.value) b.caption = e.target.value;
                else delete b.caption;
              }, 'caption')
            }
          />
        </label>
        <p className="hint">
          Figuren er en kopi fra et lysark. Har du endret figuren på lysarket, henter du den på nytt
          her.
        </p>
        <div className="button-row">
          <button type="button" onClick={() => setPicking(true)}>
            Hent på nytt
          </button>
        </div>
      </div>
      {picking && (
        <FigurePicker
          onClose={() => setPicking(false)}
          onPick={(figure) => {
            setPicking(false);
            update((b) => {
              b.elements = figure.elements;
              b.frame = figure.frame;
            });
            tellWhatWasLeft(figure);
          }}
        />
      )}
    </div>
  );
}

function BlockEditor({ elementId, block }: { elementId: string; block: MoreBlock }) {
  switch (block.kind) {
    case 'heading':
      return <HeadingEditor elementId={elementId} block={block} />;
    case 'text':
      return <TextEditor elementId={elementId} block={block} />;
    case 'image':
      return <ImageEditor elementId={elementId} block={block} />;
    case 'video':
      return <VideoEditor elementId={elementId} block={block} />;
    case 'table':
      return <TableEditor elementId={elementId} block={block} />;
    case 'embed':
      return <EmbedEditor elementId={elementId} block={block} />;
    case 'figure':
      return <FigureEditor elementId={elementId} block={block} />;
  }
}

// ---------- The preview: the slide itself, with the box popped out ----------

/** The student's window in the preview: the slide at two thirds of its size. */
const VIEW = { width: 1280, height: 720 };
const VIEW_SCALE = VIEW.width / STAGE.width;

function Preview({ element }: { element: Element }) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const scene = useStore(currentScene);
  const area = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  const [place, setPlace] = useState({ left: 16, top: 16, width: 560 });
  const more = element.more;
  const ctx = renderContext(project, logo);
  const { box } = element;
  const shown = fit > 0 && !!scene;

  // The view is drawn as large as the space allows.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = (): void =>
      setFit(Math.max(0.05, Math.min(el.clientWidth / VIEW.width, el.clientHeight / VIEW.height)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!host.current) return;
    host.current.replaceChildren(
      renderMore(renderContext(project, logo), more ?? { title: '', blocks: [] }),
    );
    fitDrawings(host.current);
    // The assets decide what pictures show; the content decides the rest.
    // (`shown`: the box is first drawn when the view has been measured.)
  }, [more, project.assets, project.meta.language, logo, shown]);

  // The box goes where the player will put it: beside the element, on top of the slide.
  useLayoutEffect(() => {
    const el = pop.current;
    if (!el) return;
    const put = (): void => {
      const anchor = {
        left: box.x * VIEW_SCALE,
        top: box.y * VIEW_SCALE,
        right: (box.x + box.w) * VIEW_SCALE,
        bottom: (box.y + box.h) * VIEW_SCALE,
      };
      const corner = moreCorner(element);
      const from = {
        x: corner.endsWith('r') ? anchor.right : anchor.left,
        y: corner.startsWith('t') ? anchor.top : anchor.bottom,
      };
      const width = popoverWidth(anchor, VIEW.width);
      const next = placePopover(anchor, from, VIEW, {
        width,
        height: Math.min(el.offsetHeight, VIEW.height - 32),
      });
      setPlace((old) =>
        old.left === next.left && old.top === next.top && old.width === width
          ? old
          : { left: next.left, top: next.top, width },
      );
    };
    put();
    const observer = new ResizeObserver(put);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.x, box.y, box.w, box.h, more?.corner, shown]);

  return (
    <section className="builder-preview" aria-label="Slik ser studenten det">
      <p className="builder-caption">
        Slik ser studenten det: boksen spretter ut ved elementet når «+» trykkes
      </p>
      <div className="builder-view" ref={area}>
        {shown && scene && (
          <div
            className="builder-view-box"
            style={{ width: VIEW.width * fit, height: VIEW.height * fit }}
          >
            <div className="builder-view-inner" style={{ transform: `scale(${fit})` }}>
              <div className="builder-slide" style={{ transform: `scale(${VIEW_SCALE})` }}>
                <SceneView scene={scene} project={project} logo={logo} />
              </div>
              <div
                className="builder-panel"
                ref={pop}
                style={{ left: place.left, top: place.top, width: place.width }}
              >
                <div className="builder-panel-head">
                  <h2>{moreTitle(ctx, element)}</h2>
                  <span className="builder-panel-tools" aria-hidden="true">
                    <span>Utvid</span>
                    <span>Lukk</span>
                  </span>
                </div>
                <div ref={host} />
                {(!more || more.blocks.length === 0) && (
                  <p className="hint">Boksen er tom. Legg til innhold til venstre.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- The window ----------

export function MoreBuilder({ elementId }: { elementId: string }) {
  const scene = useStore(currentScene);
  const element = scene?.elements.find((e) => e.id === elementId);
  const update = useMoreUpdate(elementId);
  const root = useRef<HTMLDivElement>(null);
  const dragged = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [videoMenu, setVideoMenu] = useState(false);
  const [pickingFigure, setPickingFigure] = useState(false);
  const missing = !element;

  const close = (): void => {
    const state = useStore.getState();
    // An element that got no content keeps no empty shell (the button always has a panel).
    state.updateScene((s) => {
      const el = s.elements.find((e) => e.id === elementId);
      if (el && el.type !== 'deepdive' && el.more && el.more.blocks.length === 0) delete el.more;
    });
    state.openBuilder(null);
  };

  // The element can disappear under the builder (undo): then there is nothing to build.
  useEffect(() => {
    if (missing) useStore.getState().openBuilder(null);
  }, [missing]);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, []);

  if (!element) return null;
  const more = element.more ?? { title: '', blocks: [] };
  const isButton = element.type === 'deepdive';

  const add = (block: MoreBlock): void => {
    update((m) => {
      m.blocks.push(block);
    });
    // Bring the new block into view once it is drawn.
    requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>(`[data-block-card="${block.id}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const addImage = async (): Promise<void> => {
    const id = await pickMedia('image');
    if (id) add({ id: newBlockId(), kind: 'image', asset: id, alt: '' });
  };
  const addVideoFile = async (): Promise<void> => {
    const id = await pickMedia('video');
    if (id)
      add({ id: newBlockId(), kind: 'video', source: { kind: 'asset', asset: id }, title: '' });
  };

  const drop = (to: number): void => {
    const from = more.blocks.findIndex((b) => b.id === dragged.current);
    dragged.current = null;
    setDropAt(null);
    if (from < 0) return;
    update((m) => moveBlock(m, from, to > from ? to - 1 : to));
  };

  return (
    <div
      className="builder"
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-title"
      ref={root}
      onKeyDown={(e) => {
        // Escape in a dialog that lies on top (the figures to choose from) closes that one.
        if ((e.target as HTMLElement).closest('dialog')) return;
        if (e.key === 'Escape' && !useStore.getState().mediaRequest) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header className="builder-head">
        <h2 id="builder-title">Lær mer: {describeElement(element)}</h2>
        <button type="button" className="strong" onClick={close}>
          Ferdig
        </button>
      </header>
      <div className="builder-body">
        <section className="builder-blocks" aria-label="Innhold">
          <label className="field">
            <span className="field-label">Overskrift i boksen</span>
            <input
              type="text"
              value={more.title}
              onChange={(e) =>
                update((m) => {
                  m.title = e.target.value;
                }, 'title')
              }
            />
            <span className="field-hint">
              {isButton
                ? 'Står det ingenting her, brukes teksten på knappen.'
                : 'Leses også opp som navnet på «+»-merket: «Lær mer om: …».'}
            </span>
          </label>
          {isButton ? (
            <label className="field">
              <span className="field-label">Tekst på knappen</span>
              <input
                type="text"
                value={element.label}
                onChange={(e) =>
                  useStore.getState().updateScene((s) => {
                    const el = s.elements.find((x) => x.id === elementId);
                    if (el?.type === 'deepdive') el.label = e.target.value;
                  }, `label-${elementId}`)
                }
              />
              <span className="field-hint">Står det ingenting her, står det «Lær mer».</span>
            </label>
          ) : (
            <fieldset className="segmented">
              <legend>Hvor «+»-merket står på elementet</legend>
              <div className="segmented-row">
                {MORE_CORNERS.map((corner) => (
                  <button
                    key={corner}
                    type="button"
                    aria-pressed={moreCorner(element) === corner}
                    onClick={() =>
                      update((m) => {
                        m.corner = corner;
                      })
                    }
                  >
                    {CORNER_NAMES[corner]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <ol className="block-list">
            {more.blocks.map((block, index) => (
              <li
                key={block.id}
                data-block-card={block.id}
                className={`block-card${dropAt === index ? ' drop-before' : ''}${
                  dropAt === index + 1 && index === more.blocks.length - 1 ? ' drop-after' : ''
                }`}
                onDragOver={(e) => {
                  if (!dragged.current) return;
                  e.preventDefault();
                  const box = e.currentTarget.getBoundingClientRect();
                  setDropAt(e.clientY < box.top + box.height / 2 ? index : index + 1);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dropAt !== null) drop(dropAt);
                }}
              >
                <div className="block-head">
                  <span
                    className="block-grip"
                    draggable
                    title="Dra for å flytte"
                    aria-hidden="true"
                    onDragStart={(e) => {
                      dragged.current = block.id;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', block.id);
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                      setDropAt(null);
                    }}
                  >
                    ⠿
                  </span>
                  <span className="block-kind">{BLOCK_NAMES[block.kind]}</span>
                  <span className="gap" />
                  <button
                    type="button"
                    title="Flytt opp"
                    aria-label={`Flytt ${BLOCK_NAMES[block.kind].toLowerCase()} opp`}
                    disabled={index === 0}
                    onClick={() => update((m) => moveBlock(m, index, index - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Flytt ned"
                    aria-label={`Flytt ${BLOCK_NAMES[block.kind].toLowerCase()} ned`}
                    disabled={index === more.blocks.length - 1}
                    onClick={() => update((m) => moveBlock(m, index, index + 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Slett ${BLOCK_NAMES[block.kind].toLowerCase()}`}
                    onClick={() =>
                      update((m) => {
                        m.blocks.splice(index, 1);
                      })
                    }
                  >
                    Slett
                  </button>
                </div>
                <BlockEditor elementId={elementId} block={block} />
              </li>
            ))}
          </ol>

          <div className="block-add" role="toolbar" aria-label="Legg til innhold">
            <span className="bar-label">Legg til</span>
            <button type="button" onClick={() => add(newBlock('text'))}>
              Tekst
            </button>
            <button type="button" onClick={() => add(newBlock('heading'))}>
              Overskrift
            </button>
            <button type="button" onClick={() => void addImage()}>
              Bilde
            </button>
            <div className="menu-anchor">
              <button
                type="button"
                aria-expanded={videoMenu}
                onClick={() => setVideoMenu(!videoMenu)}
              >
                Video
              </button>
              {videoMenu && (
                <div className="menu menu-up" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setVideoMenu(false);
                      add(newBlock('video-link'));
                    }}
                  >
                    Lenke (YouTube og andre)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setVideoMenu(false);
                      void addVideoFile();
                    }}
                  >
                    Fra fil
                  </button>
                </div>
              )}
            </div>
            <button type="button" onClick={() => add(newBlock('table'))}>
              Tabell
            </button>
            <button type="button" onClick={() => add(newBlock('embed'))}>
              Nettside
            </button>
            <button type="button" onClick={() => setPickingFigure(true)}>
              Figur
            </button>
          </div>
          {pickingFigure && (
            <FigurePicker
              onClose={() => setPickingFigure(false)}
              onPick={(figure) => {
                setPickingFigure(false);
                add({
                  id: newBlockId(),
                  kind: 'figure',
                  elements: figure.elements,
                  frame: figure.frame,
                  alt: '',
                });
                tellWhatWasLeft(figure);
              }}
            />
          )}

          {!isButton && (
            <div className="button-row builder-remove">
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (
                    more.blocks.length > 0 &&
                    !window.confirm('Fjerne «Lær mer» fra dette elementet? Du kan angre etterpå.')
                  ) {
                    return;
                  }
                  const state = useStore.getState();
                  state.updateScene((s) => {
                    const el = s.elements.find((x) => x.id === elementId);
                    if (el) delete el.more;
                  });
                  state.openBuilder(null);
                }}
              >
                Fjern «Lær mer»
              </button>
            </div>
          )}
        </section>
        <Preview element={element} />
      </div>
    </div>
  );
}

function newBlockId(): string {
  return newBlock('heading').id;
}
