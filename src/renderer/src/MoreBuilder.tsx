// The builder for "Lær mer" content: a window over the whole workspace with
// the building blocks on the left and, on the right, the panel exactly as a
// student will see it (drawn by the same code as the player uses).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../shared/api';
import { plainText, richText } from '../../shared/format/factory';
import { MORE_CORNERS, type Element, type More, type MoreBlock } from '../../shared/format/schema';
import { creditText, hasCredit, renderMore } from '../../shared/render/more';
import { SCENE_STRINGS, moreCorner, moreTitle } from '../../shared/render/scene';
import { embedTarget, youtubeRef } from '../../shared/render/web';
import { RichTextField } from './RichTextField';
import { renderContext } from './SceneView';
import { fetchYouTubeStill, megabytes, pickMedia } from './actions';
import { BLOCK_NAMES, CORNER_NAMES, describeElement, moveBlock, newBlock } from './ops';
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
            Bytt bilde …
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
              Bytt videofil …
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
                ? 'YouTube-video. Studenten får YouTubes spiller i panelet; den hentes fra YouTube når panelet åpnes.'
                : direct
                  ? 'Direkte lenke til en videofil. Den spilles i panelet og krever nett.'
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
                      ? 'Henter …'
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
                : 'Adressen til en side som skal vises i panelet, for eksempel en Panopto-video eller en GeoGebra-figur.'}
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
  }
}

// ---------- The preview ----------

function Preview({ element }: { element: Element }) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const host = useRef<HTMLDivElement>(null);
  const more = element.more;
  const ctx = renderContext(project, logo);
  useLayoutEffect(() => {
    if (!host.current) return;
    host.current.replaceChildren(
      renderMore(renderContext(project, logo), more ?? { title: '', blocks: [] }),
    );
    // The assets decide what pictures show; the content decides the rest.
  }, [more, project.assets, project.meta.language, logo]);
  return (
    <section className="builder-preview" aria-label="Slik ser studenten det">
      <p className="builder-caption">Slik ser studenten det</p>
      <div className="builder-panel">
        <h2>{moreTitle(ctx, element)}</h2>
        <div ref={host} />
        {(!more || more.blocks.length === 0) && (
          <p className="hint">Panelet er tomt. Legg til innhold til venstre.</p>
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
            <span className="field-label">Overskrift i panelet</span>
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
                    Fra fil …
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
          </div>

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
