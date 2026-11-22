// The side panel: properties of the selected element, of the scene, and
// the scene's steps.
import { useEffect, useState, type ReactNode } from 'react';
import { hasLogo } from '../../shared/api';
import { richText } from '../../shared/format/factory';
import {
  SCENE_KINDS,
  SHAPE_GEOMETRIES,
  STROKE_WIDTH,
  SURFACES,
  TEXT_ROLES,
  type Element,
  type PaletteColor,
  type Scene,
  type SceneKind,
  type Surface,
  type TextRole,
} from '../../shared/format/schema';
import { fitToGrid } from '../../shared/layout/fitToGrid';
import { youtubeRef } from '../../shared/render/web';
import { INLINE_VIDEO_LIMIT_BYTES } from '../../shared/limits';
import { allowedTextColors, isLargeText } from '../../shared/theme/contrast';
import { COLOR_NAMES, PALETTE, SERIES_ORDER } from '../../shared/theme/palette';
import { SHAPE_PAIRS } from '../../shared/theme/shapes';
import { getTheme, roleFontSize, sceneSurface } from '../../shared/theme/theme';
import { CreditFields } from './MediaDialog';
import { addAsset, fetchYouTubeStill, megabytes, replaceImage } from './actions';
import {
  GEOMETRY_NAMES,
  KIND_NAMES,
  ROLE_NAMES,
  addStep,
  addToStep,
  cloneElements,
  deleteElements,
  describeElement,
  describeMore,
  playClosingAnimation,
  removeFromSteps,
  reorderElement,
  stepOf,
  stepPerElement,
  type OrderMove,
} from './ops';
import { currentScene, useStore } from './store';

type Tab = 'element' | 'scene' | 'steps';

// ---------- Small building blocks ----------

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(Math.round(props.value)));
  useEffect(() => setText(String(Math.round(props.value))), [props.value]);
  const commit = (raw: string): void => {
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return setText(String(Math.round(props.value)));
    const clamped = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, n));
    if (clamped !== props.value) props.onChange(clamped);
    setText(String(Math.round(clamped)));
  };
  return (
    <label className="field field-number">
      <span className="field-label">{props.label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        }}
      />
    </label>
  );
}

/** A slider and a number for the thickness of lines, arrows and outlines. */
function StrokeWidthField(props: {
  label: string;
  value: number | undefined;
  themeValue: number;
  onChange: (value: number | undefined) => void;
}) {
  const shown = props.value ?? props.themeValue;
  return (
    <div className="field field-stroke">
      <span className="field-label">{props.label}</span>
      <div className="stroke-row">
        <input
          type="range"
          aria-label={props.label}
          min={STROKE_WIDTH.min}
          max={STROKE_WIDTH.max}
          step={1}
          value={shown}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        <output>{Math.round(shown)} px</output>
        <button
          type="button"
          disabled={props.value === undefined}
          title="Bruk temaets tykkelse"
          onClick={() => props.onChange(undefined)}
        >
          Tilbakestill
        </button>
      </div>
    </div>
  );
}

function Swatches<T extends PaletteColor>(props: {
  label: string;
  colors: readonly T[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  noneLabel: string;
}) {
  return (
    <fieldset className="swatches">
      <legend>{props.label}</legend>
      <div className="swatch-row">
        <button
          type="button"
          className="swatch swatch-none"
          aria-pressed={props.value === undefined}
          onClick={() => props.onChange(undefined)}
        >
          {props.noneLabel}
        </button>
        {props.colors.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            title={COLOR_NAMES[color]}
            aria-label={COLOR_NAMES[color]}
            aria-pressed={props.value === color}
            style={{ background: PALETTE[color] }}
            onClick={() => props.onChange(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  options: Array<[T, string]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>{props.label}</legend>
      <div className="segmented-row">
        {props.options.map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={props.value === value}
            onClick={() => props.onChange(value)}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ---------- Element ----------

function useElementUpdate(id: string) {
  const updateScene = useStore((s) => s.updateScene);
  return <T extends Element>(recipe: (el: T) => void, coalesce?: string): void =>
    updateScene(
      (scene) => {
        const el = scene.elements.find((e) => e.id === id);
        if (el) recipe(el as T);
      },
      coalesce ? `${coalesce}-${id}` : undefined,
    );
}

function BoxFields({ el }: { el: Element }) {
  const update = useElementUpdate(el.id);
  const set = (key: 'x' | 'y' | 'w' | 'h' | 'rotation') => (value: number) =>
    update((e) => {
      e.box[key] = value;
    }, `box-${key}`);
  const order = (move: OrderMove) => () =>
    useStore.getState().updateScene((scene) => reorderElement(scene, el.id, move));
  return (
    <details className="group">
      <summary>Plassering og rekkefølge</summary>
      <div className="grid-2">
        <NumberField label="Fra venstre" value={el.box.x} onChange={set('x')} />
        <NumberField label="Fra toppen" value={el.box.y} onChange={set('y')} />
        <NumberField label="Bredde" value={el.box.w} min={1} onChange={set('w')} />
        <NumberField label="Høyde" value={el.box.h} min={1} onChange={set('h')} />
        <NumberField
          label="Rotasjon (grader)"
          value={el.box.rotation}
          min={-360}
          max={360}
          onChange={set('rotation')}
        />
      </div>
      <div className="button-row">
        <button type="button" onClick={order('front')}>
          Lengst fram
        </button>
        <button type="button" onClick={order('forward')}>
          Fram
        </button>
        <button type="button" onClick={order('backward')}>
          Bak
        </button>
        <button type="button" onClick={order('back')}>
          Lengst bak
        </button>
      </div>
    </details>
  );
}

function TextFields({ el, scene }: { el: Extract<Element, { type: 'text' }>; scene: Scene }) {
  const project = useStore((s) => s.project)!;
  const theme = getTheme(project);
  const update = useElementUpdate(el.id);
  const surface = sceneSurface(theme, scene);
  const themeSize = roleFontSize(theme, el.role, scene.kind);
  const size = el.fontSize ?? themeSize;
  const colors = allowedTextColors(surface, isLargeText(size, theme.roles[el.role].weight === 700));
  return (
    <>
      <Field label="Rolle">
        <select
          value={el.role}
          onChange={(e) =>
            update<typeof el>((t) => {
              t.role = e.target.value as TextRole;
            })
          }
        >
          {TEXT_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_NAMES[role]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid-2 align-end">
        <NumberField
          label="Skriftstørrelse"
          value={size}
          min={10}
          max={400}
          onChange={(value) =>
            update<typeof el>((t) => {
              t.fontSize = value;
            }, 'size')
          }
        />
        <button
          type="button"
          disabled={
            el.fontSize === undefined &&
            el.levelScale === undefined &&
            el.lineHeight === undefined &&
            el.spaceBefore === undefined &&
            el.indent === undefined
          }
          title="Bruk temaets skriftstørrelse, linjeavstand, avstand mellom avsnitt og innrykk"
          onClick={() =>
            update<typeof el>((t) => {
              delete t.fontSize;
              delete t.levelScale;
              delete t.lineHeight;
              delete t.spaceBefore;
              delete t.indent;
            })
          }
        >
          Temaets størrelse ({themeSize})
        </button>
      </div>
      <Segmented
        label="Justering"
        value={el.align}
        options={[
          ['left', 'Venstre'],
          ['center', 'Midt'],
          ['right', 'Høyre'],
        ]}
        onChange={(value) =>
          update<typeof el>((t) => {
            t.align = value;
          })
        }
      />
      <Segmented
        label="Loddrett"
        value={el.valign}
        options={[
          ['top', 'Topp'],
          ['middle', 'Midt'],
          ['bottom', 'Bunn'],
        ]}
        onChange={(value) =>
          update<typeof el>((t) => {
            t.valign = value;
          })
        }
      />
      <Swatches
        label="Tekstfarge (bare farger manualen tillater på denne flaten)"
        colors={colors}
        value={el.color && colors.includes(el.color) ? el.color : undefined}
        noneLabel="Temaets"
        onChange={(value) =>
          update<typeof el>((t) => {
            if (value) t.color = value;
            else delete t.color;
          })
        }
      />
    </>
  );
}

function ImageFields({ el }: { el: Extract<Element, { type: 'image' }> }) {
  const update = useElementUpdate(el.id);
  return (
    <>
      <Field label="Alternativ tekst" hint="Beskriv hva bildet viser, for dem som ikke ser det.">
        <textarea
          rows={3}
          value={el.alt}
          disabled={!!el.decorative}
          onChange={(e) =>
            update<typeof el>((i) => {
              i.alt = e.target.value;
            }, 'alt')
          }
        />
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={!!el.decorative}
          onChange={(e) =>
            update<typeof el>((i) => {
              if (e.target.checked) i.decorative = true;
              else delete i.decorative;
            })
          }
        />
        Bare pynt (leses ikke opp)
      </label>
      {!el.decorative && el.alt.trim() === '' && (
        <p className="warning">Bildet mangler alternativ tekst.</p>
      )}
      <div className="button-row">
        <button type="button" onClick={() => void replaceImage(el.id)}>
          Bytt bilde
        </button>
      </div>
    </>
  );
}

function ShapeFields({ el }: { el: Extract<Element, { type: 'shape' }> }) {
  const update = useElementUpdate(el.id);
  const project = useStore((s) => s.project);
  const theme = getTheme(project!);
  const line = el.geometry === 'line' || el.geometry === 'arrow';
  return (
    <>
      <Field label="Form">
        <select
          value={el.geometry}
          onChange={(e) =>
            update<typeof el>((s) => {
              const next = e.target.value as typeof el.geometry;
              const toLine = next === 'line' || next === 'arrow';
              if (toLine) {
                delete s.fill;
                delete s.content;
              } else if (line) {
                s.fill = 'lilla';
                s.box.h = Math.max(s.box.h, 120);
                s.box.w = Math.max(s.box.w, 120);
              }
              s.geometry = next;
            })
          }
        >
          {SHAPE_GEOMETRIES.map((g) => (
            <option key={g} value={g}>
              {GEOMETRY_NAMES[g]}
            </option>
          ))}
        </select>
      </Field>
      {el.geometry === 'sign' && (
        <Field label="Spissen peker mot">
          <select
            value={el.flipH ? 'left' : 'right'}
            onChange={(e) =>
              update<typeof el>((s) => {
                if (e.target.value === 'left') s.flipH = true;
                else delete s.flipH;
              })
            }
          >
            <option value="right">Høyre</option>
            <option value="left">Venstre</option>
          </select>
        </Field>
      )}
      {!line && (
        <Swatches
          label="Fyll"
          colors={SERIES_ORDER}
          value={el.fill}
          noneLabel="Uten"
          onChange={(value) =>
            update<typeof el>((s) => {
              if (value) s.fill = value;
              else delete s.fill;
            })
          }
        />
      )}
      {(line || !el.fill) && (
        <Swatches
          label="Strek"
          colors={SERIES_ORDER}
          value={el.stroke}
          noneLabel="Temaets"
          onChange={(value) =>
            update<typeof el>((s) => {
              if (value) s.stroke = value;
              else delete s.stroke;
            })
          }
        />
      )}
      {(line || !el.fill) && (
        <StrokeWidthField
          label={el.geometry === 'arrow' ? 'Tykkelse (pilspissen følger med)' : 'Tykkelse'}
          value={el.strokeWidth}
          themeValue={theme.shape.strokeWidth}
          onChange={(value) =>
            update<typeof el>(
              (s) => {
                if (value === undefined) delete s.strokeWidth;
                else s.strokeWidth = value;
              },
              // Dragging the slider is one undo step; "Tilbakestill" is its own.
              value === undefined ? undefined : 'stroke',
            )
          }
        />
      )}
      {!line && (
        <>
          <NumberField
            label="Skriftstørrelse i formen"
            value={el.fontSize ?? 36}
            min={10}
            max={300}
            onChange={(value) =>
              update<typeof el>((s) => {
                s.fontSize = value;
              }, 'size')
            }
          />
          <p className="hint">Dobbeltklikk på formen for å skrive tekst i den.</p>
        </>
      )}
    </>
  );
}

function TableFields({ el }: { el: Extract<Element, { type: 'table' }> }) {
  const update = useElementUpdate(el.id);
  const columns = el.columns.length;
  return (
    <>
      <label className="check">
        <input
          type="checkbox"
          checked={el.headerRow}
          onChange={(e) =>
            update<typeof el>((t) => {
              t.headerRow = e.target.checked;
            })
          }
        />
        Første rad er overskrifter
      </label>
      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            update<typeof el>((t) => {
              t.rows.push(
                Array.from({ length: t.columns.length }, () => ({ content: richText() })),
              );
            })
          }
        >
          Ny rad
        </button>
        <button
          type="button"
          disabled={el.rows.length <= 1}
          onClick={() =>
            update<typeof el>((t) => {
              t.rows.pop();
            })
          }
        >
          Fjern siste rad
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          onClick={() =>
            update<typeof el>((t) => {
              t.columns.push(t.columns.reduce((a, b) => a + b, 0) / t.columns.length);
              for (const row of t.rows) row.push({ content: richText() });
            })
          }
        >
          Ny kolonne
        </button>
        <button
          type="button"
          disabled={columns <= 1}
          onClick={() =>
            update<typeof el>((t) => {
              t.columns.pop();
              for (const row of t.rows) if (row.length > 1) row.pop();
            })
          }
        >
          Fjern siste kolonne
        </button>
      </div>
      <NumberField
        label="Skriftstørrelse"
        value={el.fontSize ?? 30}
        min={10}
        max={120}
        onChange={(value) =>
          update<typeof el>((t) => {
            t.fontSize = value;
          }, 'size')
        }
      />
      <p className="hint">Dobbeltklikk på en celle for å skrive i den.</p>
    </>
  );
}

/** Fetches YouTube's still picture of a video, on the owner's click and not before. */
function YouTubeStill(props: {
  url: string;
  has: boolean;
  onFetched: (assetId: string) => void;
  onRemove: () => void;
}) {
  const [fetching, setFetching] = useState(false);
  return (
    <>
      <div className="button-row">
        <button
          type="button"
          disabled={fetching}
          onClick={() => {
            setFetching(true);
            void fetchYouTubeStill(props.url).then((id) => {
              setFetching(false);
              if (id) props.onFetched(id);
            });
          }}
        >
          {fetching ? 'Henter' : props.has ? 'Hent forhåndsbilde på nytt' : 'Hent forhåndsbilde'}
        </button>
        {props.has && (
          <button type="button" onClick={props.onRemove}>
            Fjern forhåndsbildet
          </button>
        )}
      </div>
      <p className="hint">
        Forhåndsbildet hentes fra YouTube når du trykker på knappen, og lagres i prosjektet.
        {props.has ? '' : ' Uten det viser kortet bare avspillingsknappen.'}
      </p>
    </>
  );
}

function VideoFields({ el }: { el: Extract<Element, { type: 'video' }> }) {
  const project = useStore((s) => s.project)!;
  const update = useElementUpdate(el.id);
  const asset = el.source.kind === 'asset' ? project.assets[el.source.asset] : undefined;
  return (
    <>
      <Field label="Tittel" hint="Leses opp og vises sammen med videoen.">
        <input
          type="text"
          value={el.title}
          onChange={(e) =>
            update<typeof el>((v) => {
              v.title = e.target.value;
            }, 'title')
          }
        />
      </Field>
      <Segmented
        label="Kilde"
        value={el.source.kind}
        options={[
          ['asset', 'Fil'],
          ['url', 'Lenke'],
        ]}
        onChange={(kind) => {
          if (kind === el.source.kind) return;
          if (kind === 'url')
            update<typeof el>((v) => {
              v.source = { kind: 'url', url: '' };
            });
          else {
            void addAsset('video').then((id) => {
              if (id)
                update<typeof el>((v) => {
                  v.source = { kind: 'asset', asset: id };
                });
            });
          }
        }}
      />
      {el.source.kind === 'url' ? (
        <>
          <Field
            label="Adresse"
            hint="En YouTube-video vises som YouTubes spiller i lysarket, og hentes fra YouTube når lysarket vises. Her i redigeringen ser du bare stillbildet; bruk Forhåndsvis for å se spilleren. Åpner studenten fila rett fra disk, blir stillbildet stående med en knapp som åpner YouTube. Andre videosider (for eksempel Panopto) åpnes i nettleseren. En direkte lenke til en MP4- eller WebM-fil spilles i lysarket. Alt dette krever nett hos studenten."
          >
            <input
              type="text"
              placeholder="https://"
              value={el.source.url}
              onChange={(e) =>
                update<typeof el>((v) => {
                  v.source = { kind: 'url', url: e.target.value };
                }, 'url')
              }
            />
          </Field>
          {youtubeRef(el.source.url) && (
            <YouTubeStill
              url={el.source.url}
              has={!!el.poster && !!project.assets[el.poster]}
              onFetched={(id) =>
                update<typeof el>((v) => {
                  v.poster = id;
                })
              }
              onRemove={() =>
                update<typeof el>((v) => {
                  delete v.poster;
                })
              }
            />
          )}
        </>
      ) : (
        <>
          <p className="hint">
            {asset
              ? `${asset.name ?? 'Videofil'} (${megabytes(asset.bytes)})`
              : 'Videofila mangler.'}
          </p>
          {asset && asset.bytes > INLINE_VIDEO_LIMIT_BYTES && (
            <p className="warning">
              Videoen er for stor til å ligge inne i HTML-fila. Ved eksport legges den i en mappe
              ved siden av fila, og mappa må følge med.
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              onClick={() =>
                void addAsset('video').then((id) => {
                  if (id)
                    update<typeof el>((v) => {
                      v.source = { kind: 'asset', asset: id };
                    });
                })
              }
            >
              Bytt videofil
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** "Lær mer" content of the selected element: what it holds, and the way into the builder. */
function MoreFields({ el }: { el: Element }) {
  const openBuilder = useStore((s) => s.openBuilder);
  const update = useElementUpdate(el.id);
  if (el.type === 'deepdive') {
    return (
      <>
        <Field label="Tekst på knappen" hint="Står det ingenting her, står det «Lær mer».">
          <input
            type="text"
            value={el.label}
            onChange={(e) =>
              update<typeof el>((d) => {
                d.label = e.target.value;
              }, 'label')
            }
          />
        </Field>
        <p className="hint">{describeMore(el.more)}</p>
        <div className="button-row">
          <button type="button" className="strong" onClick={() => openBuilder(el.id)}>
            Bygg innholdet
          </button>
        </div>
      </>
    );
  }
  const has = !!el.more && el.more.blocks.length > 0;
  return (
    <div className="group">
      <span className="field-label">Lær mer</span>
      {has ? (
        <>
          <p className="hint">
            Elementet har et «+»-merke som åpner en boks på lysarket. {describeMore(el.more)}
          </p>
          <div className="button-row">
            <button type="button" onClick={() => openBuilder(el.id)}>
              Rediger «Lær mer»
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                update<Element>((d) => {
                  delete d.more;
                })
              }
            >
              Fjern
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            Knytt mer stoff til dette elementet: tekst, bilder, video, tabeller og nettsider.
            Studenten åpner det fra et «+»-merke.
          </p>
          <div className="button-row">
            <button type="button" onClick={() => openBuilder(el.id)}>
              Legg til «Lær mer»
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Credit of the picture an image element shows. */
function ImageCredit({ assetId }: { assetId: string }) {
  const asset = useStore((s) => s.project?.assets[assetId]);
  const update = useStore((s) => s.update);
  if (!asset) return null;
  return (
    <details className="group" open={!!asset.credit?.required}>
      <summary>Kreditering</summary>
      <CreditFields
        credit={asset.credit}
        onChange={(credit) =>
          update((draft) => {
            const target = draft.assets[assetId];
            if (!target) return;
            if (credit) target.credit = credit;
            else delete target.credit;
          }, `credit-${assetId}`)
        }
      />
    </details>
  );
}

function ElementPanel({ scene }: { scene: Scene }) {
  const selection = useStore((s) => s.selection);
  const selected = scene.elements.filter((e) => selection.includes(e.id));
  const remove = (): void => useStore.getState().updateScene((s) => deleteElements(s, selection));
  const duplicate = (): void => {
    const copies = cloneElements(selected, 24);
    useStore.getState().updateScene((s) => {
      s.elements.push(...copies);
    });
    useStore.getState().select(copies.map((c) => c.id));
  };

  if (selected.length === 0) {
    return (
      <p className="hint panel-empty">
        Klikk på noe i lysarket for å endre det. Dobbeltklikk for å skrive.
      </p>
    );
  }
  if (selected.length > 1) {
    return (
      <div className="panel-body">
        <h3>{selected.length} elementer valgt</h3>
        <div className="button-row">
          <button type="button" onClick={duplicate}>
            Lag kopi
          </button>
          <button type="button" className="danger" onClick={remove}>
            Slett
          </button>
        </div>
      </div>
    );
  }
  const el = selected[0]!;
  return (
    <div className="panel-body">
      <h3>{describeElement(el)}</h3>
      {el.type === 'text' && <TextFields el={el} scene={scene} />}
      {el.type === 'image' && <ImageFields el={el} />}
      {el.type === 'image' && <ImageCredit assetId={el.asset} />}
      {el.type === 'shape' && <ShapeFields el={el} />}
      {el.type === 'table' && <TableFields el={el} />}
      {el.type === 'video' && <VideoFields el={el} />}
      <MoreFields el={el} />
      <BoxFields el={el} />
      <div className="button-row">
        <button type="button" onClick={duplicate}>
          Lag kopi
        </button>
        <button type="button" className="danger" onClick={remove}>
          Slett
        </button>
      </div>
    </div>
  );
}

// ---------- Scene ----------

function ScenePanel({ scene, onLogo }: { scene: Scene; onLogo: () => void }) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const updateScene = useStore((s) => s.updateScene);
  const theme = getTheme(project);
  const logoReady =
    hasLogo(logo, project.meta.language, 'light') || hasLogo(logo, project.meta.language, 'dark');
  return (
    <div className="panel-body">
      <Field label="Navn i innholdsoversikten">
        <input
          type="text"
          value={scene.title}
          onChange={(e) =>
            updateScene((s) => {
              s.title = e.target.value;
            }, 'scene-title')
          }
        />
      </Field>
      <Field label="Type">
        <select
          value={scene.kind}
          onChange={(e) =>
            updateScene((s) => {
              s.kind = e.target.value as SceneKind;
              if (s.kind === 'content') s.decoration = false;
            })
          }
        >
          {SCENE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_NAMES[kind]}
            </option>
          ))}
        </select>
      </Field>
      <Swatches<Surface>
        label="Bakgrunn (flater manualen tillater)"
        colors={SURFACES}
        value={scene.background}
        noneLabel="Temaets"
        onChange={(value) =>
          updateScene((s) => {
            if (value) s.background = value;
            else delete s.background;
          })
        }
      />
      <label className="check">
        <input
          type="checkbox"
          checked={scene.decoration}
          onChange={(e) =>
            updateScene((s) => {
              s.decoration = e.target.checked;
            })
          }
        />
        Vis profilformene (to former som overlapper)
      </label>
      {scene.decoration && (
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              updateScene((s) => {
                s.shapeVariant = (s.shapeVariant + 1) % SHAPE_PAIRS.length;
              })
            }
          >
            Bytt former
          </button>
        </div>
      )}
      {scene.kind === 'closing' && (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={!!scene.closingAnimation}
              disabled={!logo.closing && !scene.closingAnimation}
              onChange={(e) =>
                updateScene((s) => {
                  if (e.target.checked && logo.closing) {
                    playClosingAnimation(s, logo.closing.seconds);
                  } else {
                    delete s.closingAnimation;
                  }
                })
              }
            />
            Spill USNs avslutningsanimasjon når lysarket vises
          </label>
          {!logo.closing ? (
            <p className="warning">
              USNs avslutningsanimasjon er ikke valgt ennå.{' '}
              <button type="button" className="link-button" onClick={onLogo}>
                Velg videofila
              </button>
            </p>
          ) : (
            scene.closingAnimation && (
              <p className="hint">
                Animasjonen starter av seg selv, uten knapper og uten lyd, og varer{' '}
                {Math.round(scene.closingAnimation.seconds)} sekunder. Her i redigeringen ser du det
                siste bildet.
              </p>
            )
          )}
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={scene.showLogo}
          onChange={(e) =>
            updateScene((s) => {
              s.showLogo = e.target.checked;
            })
          }
        />
        Vis USNs logo
      </label>
      {scene.showLogo && !logoReady && (
        <p className="warning">
          Logoen vises ikke, fordi USNs logofiler ikke er valgt ennå.{' '}
          <button type="button" className="link-button" onClick={onLogo}>
            Velg logofiler
          </button>
        </p>
      )}
      <div className="group">
        <button type="button" onClick={() => updateScene((s) => fitToGrid(s, theme))}>
          Rydd opp lysarket
        </button>
        <p className="hint">
          Rydder lysarket inn i de åtte kolonnene, venstrestiller teksten og bruker temaets
          skriftstørrelser. Kan angres.
        </p>
      </div>
      {scene.imported && scene.imported.warnings.length > 0 && (
        <div className="group">
          <h3>Fra importen (lysark {scene.imported.slide})</h3>
          <ul className="warning-list">
            {scene.imported.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
          <button
            type="button"
            className="link-button"
            onClick={() =>
              updateScene((s) => {
                if (s.imported) s.imported.warnings = [];
              })
            }
          >
            Merk som ordnet
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Steps ----------

function StepsPanel({ scene }: { scene: Scene }) {
  const selection = useStore((s) => s.selection);
  const previewSteps = useStore((s) => s.previewSteps);
  const setPreviewSteps = useStore((s) => s.setPreviewSteps);
  const updateScene = useStore((s) => s.updateScene);
  const select = useStore((s) => s.select);
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  const fromStart = scene.elements.filter((e) => stepOf(scene, e.id) < 0);
  const total = scene.timeline.length;

  const move = (index: number, delta: number) => () =>
    updateScene((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.timeline.length) return;
      const [step] = s.timeline.splice(index, 1);
      s.timeline.splice(to, 0, step!);
    });

  return (
    <div className="panel-body">
      <p className="hint">
        Et steg er «nå kommer dette inn». I HTML går studenten til neste steg med piltast. Elementer
        som ikke ligger i noe steg, er synlige fra starten.
      </p>
      <div className="button-row">
        <button
          type="button"
          disabled={selection.length === 0}
          onClick={() => updateScene((s) => addStep(s, selection))}
        >
          Nytt steg med det som er valgt
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          disabled={scene.elements.length === 0}
          onClick={() => updateScene(stepPerElement)}
        >
          Ett steg per element
        </button>
        <button
          type="button"
          disabled={total === 0}
          onClick={() =>
            updateScene((s) => {
              s.timeline = [];
            })
          }
        >
          Fjern alle steg
        </button>
      </div>

      {total > 0 && (
        <div className="step-preview">
          <span>Vis lysarket etter</span>
          <button
            type="button"
            disabled={(previewSteps ?? total) <= 0}
            onClick={() => setPreviewSteps(Math.max(0, (previewSteps ?? total) - 1))}
          >
            ←
          </button>
          <strong>{previewSteps === null ? 'alle steg' : `${previewSteps} steg`}</strong>
          <button
            type="button"
            disabled={previewSteps === null}
            onClick={() =>
              setPreviewSteps(
                previewSteps === null || previewSteps + 1 >= total ? null : previewSteps + 1,
              )
            }
          >
            →
          </button>
        </div>
      )}

      <ol className="step-list">
        <li className="step-item step-start">
          <div className="step-head">
            <strong>Fra starten</strong>
          </div>
          <ul>
            {fromStart.map((el) => (
              <li key={el.id}>
                <button type="button" className="link-button" onClick={() => select([el.id])}>
                  {describeElement(el)}
                </button>
              </li>
            ))}
            {fromStart.length === 0 && <li className="hint">Ingenting</li>}
          </ul>
        </li>
        {scene.timeline.map((step, index) => (
          <li key={step.id} className="step-item">
            <div className="step-head">
              <strong>Steg {index + 1}</strong>
              <select
                aria-label={`Hvordan steg ${index + 1} kommer inn`}
                value={step.actions[0]?.effect ?? 'fade'}
                onChange={(e) =>
                  updateScene((s) => {
                    const target = s.timeline[index];
                    if (!target) return;
                    for (const action of target.actions) {
                      action.effect = e.target.value as 'fade' | 'appear';
                      action.duration = action.effect === 'fade' ? 0.4 : 0;
                    }
                  })
                }
              >
                <option value="fade">Tones inn</option>
                <option value="appear">Vises med en gang</option>
              </select>
              <button
                type="button"
                title="Tidligere"
                disabled={index === 0}
                onClick={move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                title="Senere"
                disabled={index === total - 1}
                onClick={move(index, 1)}
              >
                ↓
              </button>
            </div>
            <ul>
              {step.actions.map((action) => {
                const el = byId.get(action.target);
                if (!el) return null;
                return (
                  <li key={action.target}>
                    <button type="button" className="link-button" onClick={() => select([el.id])}>
                      {describeElement(el)}
                    </button>
                    <button
                      type="button"
                      className="link-button quiet"
                      title="Ta ut av steget (blir synlig fra starten)"
                      onClick={() => updateScene((s) => removeFromSteps(s, [el.id]))}
                    >
                      Ta ut
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="link-button"
              disabled={selection.length === 0}
              onClick={() => updateScene((s) => addToStep(s, step.id, selection))}
            >
              Legg det som er valgt i dette steget
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Panel ----------

export function Inspector({ onLogo }: { onLogo: () => void }) {
  const scene = useStore(currentScene);
  const hasSelection = useStore((s) => s.selection.length > 0);
  const [tab, setTab] = useState<Tab>('scene');

  useEffect(() => {
    setTab((current) =>
      hasSelection
        ? current === 'steps'
          ? 'steps'
          : 'element'
        : current === 'element'
          ? 'scene'
          : current,
    );
  }, [hasSelection]);

  if (!scene) return <aside className="inspector" />;
  const tabs: Array<[Tab, string]> = [
    ['element', 'Element'],
    ['scene', 'Lysark'],
    ['steps', `Steg${scene.timeline.length ? ` (${scene.timeline.length})` : ''}`],
  ];
  return (
    <aside className="inspector" aria-label="Egenskaper">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'element' && <ElementPanel scene={scene} />}
      {tab === 'scene' && <ScenePanel scene={scene} onLogo={onLogo} />}
      {tab === 'steps' && <StepsPanel scene={scene} />}
    </aside>
  );
}
