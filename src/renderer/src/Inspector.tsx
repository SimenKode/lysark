// The side panel: properties of the selected element, of the scene, and
// the scene's steps.
import { useEffect, useState, type ReactNode } from 'react';
import { richText } from '../../shared/format/factory';
import {
  SCENE_KINDS,
  SHAPE_GEOMETRIES,
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
import { INLINE_VIDEO_LIMIT_BYTES } from '../../shared/limits';
import { allowedTextColors, isLargeText } from '../../shared/theme/contrast';
import { COLOR_NAMES, PALETTE, SERIES_ORDER } from '../../shared/theme/palette';
import { SHAPE_PAIRS } from '../../shared/theme/shapes';
import { getTheme, roleFontSize, sceneSurface } from '../../shared/theme/theme';
import { RichTextField } from './RichTextField';
import { addAsset, megabytes, replaceImage } from './actions';
import {
  GEOMETRY_NAMES,
  KIND_NAMES,
  ROLE_NAMES,
  addStep,
  addToStep,
  cloneElements,
  deleteElements,
  describeElement,
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
          disabled={el.fontSize === undefined}
          onClick={() =>
            update<typeof el>((t) => {
              delete t.fontSize;
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
          Bytt bilde …
        </button>
      </div>
    </>
  );
}

function ShapeFields({ el }: { el: Extract<Element, { type: 'shape' }> }) {
  const update = useElementUpdate(el.id);
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
        <Field
          label="Adresse"
          hint="En lenke til en videoside (for eksempel YouTube eller Panopto) åpnes i nettleseren og krever nett. En direkte lenke til en MP4- eller WebM-fil spilles i scenen."
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
              Bytt videofil …
            </button>
          </div>
        </>
      )}
    </>
  );
}

function DeepDiveFields({ el }: { el: Extract<Element, { type: 'deepdive' }> }) {
  const project = useStore((s) => s.project)!;
  const update = useElementUpdate(el.id);
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
      <div className="field">
        <span className="field-label">Innhold i panelet</span>
        <RichTextField
          key={el.id}
          label="Innhold i panelet"
          value={el.body}
          onChange={(value) =>
            update<typeof el>((d) => {
              d.body = value;
            }, 'body')
          }
        />
      </div>
      <div className="field">
        <span className="field-label">Bilder, video og lenker i panelet</span>
        {el.media.length === 0 && <p className="hint">Ingen ennå.</p>}
        {el.media.map((item, i) => (
          <div key={i} className="media-item">
            {item.kind === 'image' && (
              <Field label={`Bilde: ${project.assets[item.asset]?.name ?? ''}`}>
                <input
                  type="text"
                  placeholder="Alternativ tekst"
                  value={item.alt}
                  onChange={(e) =>
                    update<typeof el>((d) => {
                      const m = d.media[i];
                      if (m?.kind === 'image') m.alt = e.target.value;
                    }, `media-${i}`)
                  }
                />
              </Field>
            )}
            {item.kind === 'video' && (
              <Field
                label={`Video: ${item.source.kind === 'asset' ? (project.assets[item.source.asset]?.name ?? '') : 'lenke'}`}
              >
                <input
                  type="text"
                  placeholder="Tittel"
                  value={item.title}
                  onChange={(e) =>
                    update<typeof el>((d) => {
                      const m = d.media[i];
                      if (m?.kind === 'video') m.title = e.target.value;
                    }, `media-${i}`)
                  }
                />
              </Field>
            )}
            {item.kind === 'link' && (
              <>
                <Field label="Lenketekst">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      update<typeof el>((d) => {
                        const m = d.media[i];
                        if (m?.kind === 'link') m.label = e.target.value;
                      }, `media-${i}-label`)
                    }
                  />
                </Field>
                <Field label="Adresse">
                  <input
                    type="text"
                    placeholder="https://"
                    value={item.url}
                    onChange={(e) =>
                      update<typeof el>((d) => {
                        const m = d.media[i];
                        if (m?.kind === 'link') m.url = e.target.value;
                      }, `media-${i}-url`)
                    }
                  />
                </Field>
              </>
            )}
            <button
              type="button"
              className="link-button"
              onClick={() =>
                update<typeof el>((d) => {
                  d.media.splice(i, 1);
                })
              }
            >
              Fjern
            </button>
          </div>
        ))}
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              void addAsset('image').then((id) => {
                if (id)
                  update<typeof el>((d) => {
                    d.media.push({ kind: 'image', asset: id, alt: '' });
                  });
              })
            }
          >
            Bilde …
          </button>
          <button
            type="button"
            onClick={() =>
              void addAsset('video').then((id) => {
                if (id) {
                  update<typeof el>((d) => {
                    d.media.push({
                      kind: 'video',
                      source: { kind: 'asset', asset: id },
                      title: '',
                    });
                  });
                }
              })
            }
          >
            Video …
          </button>
          <button
            type="button"
            onClick={() =>
              update<typeof el>((d) => {
                d.media.push({ kind: 'link', url: '', label: '' });
              })
            }
          >
            Lenke
          </button>
        </div>
      </div>
    </>
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
        Klikk på noe i scenen for å endre det. Dobbeltklikk for å skrive.
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
      {el.type === 'shape' && <ShapeFields el={el} />}
      {el.type === 'table' && <TableFields el={el} />}
      {el.type === 'video' && <VideoFields el={el} />}
      {el.type === 'deepdive' && <DeepDiveFields el={el} />}
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
  const logoReady = logo.light || logo.dark;
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
          Tilpass til rutenett
        </button>
        <p className="hint">
          Rydder scenen inn i de åtte kolonnene, venstrestiller teksten og bruker temaets
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
          <span>Vis scenen etter</span>
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
    ['scene', 'Scene'],
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
