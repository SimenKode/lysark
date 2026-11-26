// The side panel: properties of the selected element, of the scene, and
// the scene's steps.
import { useEffect, useState, type ClipboardEvent, type ReactNode } from 'react';
import { hasLogo } from '../../shared/api';
import { newId, richText } from '../../shared/format/factory';
import {
  CAMERA_SIZES,
  SCENE_KINDS,
  SHAPE_GEOMETRIES,
  STROKE_WIDTH,
  SURFACES,
  TEXT_ROLES,
  type CameraSize,
  type Element,
  type FigureElement,
  type PaletteColor,
  type Scene,
  type SceneKind,
  type Step,
  type StepEffect,
  type Surface,
  type TextRole,
} from '../../shared/format/schema';
import { stageOf } from '../../shared/format/constants';
import { fitToGrid } from '../../shared/layout/fitToGrid';
import {
  canFasten,
  canGroup,
  connect,
  groupElements,
  membersOf,
  stepPerPart,
  ungroupElements,
  wholeGroup,
} from '../../shared/layout/groups';
import {
  addMark,
  markNumber,
  markStyle,
  marksOf,
  pictureOf,
  setMarkStyle,
  stepPerMark,
} from '../../shared/layout/marks';
import {
  addSeries,
  emptyRow,
  formatNumber,
  isChart,
  parseNumber,
  pasteTable,
  removeSeries,
  rowsByName,
  setAlong,
} from '../../shared/layout/charts';
import {
  SPEEDS,
  effectSeconds,
  effectsFor,
  setStepSpeed,
  stepSpeed,
  viewAround,
  zoomedBefore,
  type Speed,
} from '../../shared/layout/steps';
import {
  figureFontSize,
  figureOf,
  moveItem,
  partsOf,
  releaseFigure,
  setDirection,
  stepPerItem,
  wholeFigure,
} from '../../shared/layout/templates';
import { setSilentSeconds } from '../../shared/audio/edit';
import {
  SILENT_SECONDS,
  cameraOnStage,
  defaultCameraPlace,
  formatTime,
  hasCameraFilm,
  hasSound,
  ownsSeconds,
  sceneDuration,
} from '../../shared/render/clock';
import { youtubeRef } from '../../shared/render/web';
import { INLINE_VIDEO_LIMIT_BYTES } from '../../shared/limits';
import { allowedTextColors, isLargeText } from '../../shared/theme/contrast';
import { COLOR_NAMES, PALETTE, SERIES_ORDER } from '../../shared/theme/palette';
import { SHAPE_PAIRS } from '../../shared/theme/shapes';
import { getTheme, roleFontSize, sceneSurface } from '../../shared/theme/theme';
import { Icon } from './Icon';
import { CreditFields } from './MediaDialog';
import { SecondsInput } from './SecondsInput';
import { addAsset, fetchYouTubeStill, megabytes, replaceImage } from './actions';
import {
  GEOMETRY_NAMES,
  ITEM_NAMES,
  KIND_NAMES,
  ROLE_NAMES,
  TEMPLATE_NAMES,
  addKindStep,
  addStep,
  addToStep,
  addZoomStep,
  cloneElements,
  deleteElements,
  newStep,
  describeElement,
  describeMore,
  playClosingAnimation,
  removeFromStep,
  reorderElement,
  stepMaker,
  stepOf,
  stepPerElement,
  type OrderMove,
} from './ops';
import { currentScene, useStage, useStore } from './store';

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
  // A curve has a stroke and nothing else: no fill, no text, and it cannot become another shape.
  const curve = el.geometry === 'curve';
  const line = el.geometry === 'line' || el.geometry === 'arrow' || curve;
  return (
    <>
      {!curve && (
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
            {SHAPE_GEOMETRIES.filter((g) => g !== 'curve').map((g) => (
              <option key={g} value={g}>
                {GEOMETRY_NAMES[g]}
              </option>
            ))}
          </select>
        </Field>
      )}
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
      {line && !curve && <LineEnds el={el} />}
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

/** What the ends of a line or an arrow are fastened to, and how to let them go. */
function LineEnds({ el }: { el: Extract<Element, { type: 'shape' }> }) {
  const scene = useStore(currentScene);
  const update = useElementUpdate(el.id);
  const arrow = el.geometry === 'arrow';
  const ends: Array<['startAt' | 'endAt', string]> = [
    ['startAt', 'Starten'],
    ['endAt', arrow ? 'Spissen' : 'Slutten'],
  ];
  const fastened = ends.filter(([key]) => el[key] !== undefined);
  return (
    <div className="group">
      <h3>Festet til</h3>
      {fastened.length === 0 ? (
        <p className="hint">
          Dra en ende av {arrow ? 'pila' : 'linja'} inn på en boks, så fester den seg og følger
          boksen når du flytter den. Hold Alt nede for å la være.
        </p>
      ) : (
        <ul className="fastened-list">
          {fastened.map(([key, name]) => {
            const target = scene?.elements.find((e) => e.id === el[key]);
            return (
              <li key={key}>
                <span>
                  {name}: {target ? describeElement(target) : 'ukjent'}
                </span>
                <button
                  type="button"
                  aria-label={`Løsne ${name.toLowerCase()}`}
                  onClick={() =>
                    update<typeof el>((s) => {
                      delete s[key];
                    })
                  }
                >
                  Løsne
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** For one or more chosen elements: making a group of them, and breaking a group up. */
function GroupFields({ scene, selected }: { scene: Scene; selected: Element[] }) {
  const ids = selected.map((el) => el.id);
  const whole = wholeGroup(scene, ids);
  const grouped = selected.find((el) => el.group)?.group;
  const single = selected.length === 1 ? selected[0]! : undefined;
  // The order things were chosen in: an arrow goes from the first to the last.
  const chosen = useStore((s) => s.selection);
  const pair =
    selected.length === 2 && selected.every(canFasten)
      ? chosen.filter((id) => ids.includes(id))
      : undefined;
  const group = (): void => {
    const state = useStore.getState();
    let members: string[] = [];
    state.updateScene((s) => {
      members = groupElements(s, ids, () => newId('g'));
    });
    if (members.length) state.select(members);
  };
  const ungroup = (): void => useStore.getState().updateScene((s) => ungroupElements(s, ids));
  const arrowBetween = (): void => {
    if (!pair) return;
    const state = useStore.getState();
    let made: string | undefined;
    state.updateScene((s) => {
      made = connect(s, pair[0]!, pair[1]!, () => newId('e'))?.id;
    });
    if (made) state.select([made]);
  };
  const steps = (): void => {
    if (!whole) return;
    useStore.getState().updateScene((s) => stepPerPart(s, whole, stepMaker(s)));
  };
  if (!canGroup(scene, ids) && !grouped && !pair) return null;
  return (
    <div className="group">
      <h3>Gruppe</h3>
      {single && grouped && (
        <p className="hint">
          Dette er en del av en gruppe med {membersOf(scene, grouped).length} deler.
        </p>
      )}
      {!grouped && canGroup(scene, ids) && (
        <p className="hint">
          En gruppe flyttes, kopieres og endrer størrelse samlet. Hver del kan fortsatt komme inn i
          sitt eget steg.
        </p>
      )}
      <div className="button-row">
        {canGroup(scene, ids) && (
          <button type="button" onClick={group}>
            Grupper
          </button>
        )}
        {single && grouped && (
          <button
            type="button"
            onClick={() =>
              useStore.getState().select(membersOf(scene, grouped).map((member) => member.id))
            }
          >
            Velg hele gruppen
          </button>
        )}
        {grouped && (
          <button type="button" onClick={ungroup}>
            Del opp gruppen
          </button>
        )}
        {whole && (
          <button
            type="button"
            onClick={steps}
            title="Delene kommer inn én etter én, i leseretning. En pil kommer sammen med det den peker på."
          >
            Ett steg per del
          </button>
        )}
        {pair && (
          <button
            type="button"
            onClick={arrowBetween}
            title="Pila går fra det du valgte først, til det du valgte sist, og følger begge når de flyttes."
          >
            Sett pil mellom dem
          </button>
        )}
      </div>
    </div>
  );
}

/** Changes a figure with a form, and keeps the whole of it chosen afterwards. */
function useFigureChange(
  figure: FigureElement,
): (recipe: (f: FigureElement) => void, coalesce?: string) => void {
  const updateScene = useStore((s) => s.updateScene);
  return (recipe, coalesce) => {
    updateScene(
      (s) => {
        const f = s.elements.find((e) => e.id === figure.id);
        if (f?.type === 'figure') recipe(f);
      },
      coalesce ? `${coalesce}-${figure.id}` : undefined,
    );
    // The figure may have got parts, or lost some: the whole of it is still what is chosen.
    const state = useStore.getState();
    const scene = currentScene(state);
    if (!scene) return;
    const all = [figure.id, ...partsOf(scene, figure.id).map((el) => el.id)];
    const now = state.selection;
    if (all.length !== now.length || all.some((id) => !now.includes(id))) state.select(all);
  };
}

/** Makes a figure with a form into a free one, and leaves its parts chosen. */
function releaseToFree(figure: FigureElement): void {
  const state = useStore.getState();
  const parts = partsOf(currentScene(state)!, figure.id).map((el) => el.id);
  state.updateScene((s) => releaseFigure(s, figure.id));
  state.select(parts);
}

/** One number of a diagram's table. It is written as in Norwegian, with a comma. */
function NumberCell(props: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const shown = (value: number | null): string => (value === null ? '' : formatNumber(value));
  const [text, setText] = useState(shown(props.value));
  // What is being written stays as written; a number changed from elsewhere is shown.
  useEffect(() => {
    setText((now) => (parseNumber(now) === props.value ? now : shown(props.value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={props.label}
      aria-invalid={parseNumber(text) === undefined || undefined}
      placeholder={props.placeholder}
      value={text}
      onPaste={props.onPaste}
      onChange={(e) => {
        setText(e.target.value);
        const value = parseNumber(e.target.value);
        if (value !== undefined && value !== props.value) props.onChange(value);
      }}
    />
  );
}

/** The form of a diagram: the table of its numbers, and what stands at its axes. */
function ChartFields({ figure }: { figure: FigureElement }) {
  const updateScene = useStore((s) => s.updateScene);
  const change = useFigureChange(figure);
  const bars = figure.template === 'bars';
  /** The first column holds names: a bar diagram, and a line diagram with names along its axis. */
  const named = rowsByName(figure);
  const series = figure.series ?? [];
  const seriesName = (k: number): string => series[k]!.name.trim() || `Serie ${k + 1}`;
  /** Several cells copied from a spreadsheet are laid into the table from the cell they are pasted in. */
  const paste =
    (row: number, column: number) =>
    (event: ClipboardEvent<HTMLInputElement>): void => {
      const text = event.clipboardData.getData('text/plain');
      if (!/[\t\n]/.test(text.replace(/[\r\n]+$/, ''))) return;
      event.preventDefault();
      change((f) => pasteTable(f, row, column, text, () => newId('e')));
    };
  const title = (key: 'xTitle' | 'yTitle', label: string) => (
    <Field label={label}>
      <input
        type="text"
        value={figure[key] ?? ''}
        onChange={(e) =>
          change((f) => {
            if (e.target.value) f[key] = e.target.value;
            else delete f[key];
          }, key)
        }
      />
    </Field>
  );
  const end = (key: 'xMin' | 'xMax' | 'yMin' | 'yMax', label: string) => (
    <label className="field field-number">
      <span className="field-label">{label}</span>
      <NumberCell
        label={label}
        placeholder="Automatisk"
        value={figure[key] ?? null}
        onChange={(value) =>
          change((f) => {
            if (value === null) delete f[key];
            else f[key] = value;
          }, key)
        }
      />
    </label>
  );
  return (
    <div className="group">
      <p className="hint">
        Diagrammet tegner seg selv fra tallene du skriver her. Du kan lime inn rett fra Excel. Dra i
        rammen rundt diagrammet for å flytte det eller endre størrelsen.
      </p>
      {!bars && (
        <fieldset className="segmented">
          <legend>Langs den vannrette aksen</legend>
          <div className="segmented-row">
            <button
              type="button"
              aria-pressed={!named}
              title="Punktene står der tallet sier, så avstanden mellom dem følger tallene."
              onClick={() => change((f) => setAlong(f, 'numbers'))}
            >
              Tall
            </button>
            <button
              type="button"
              aria-pressed={named}
              title="Punktene står med lik avstand, hvert over navnet sitt."
              onClick={() => change((f) => setAlong(f, 'names'))}
            >
              Navn
            </button>
          </div>
        </fieldset>
      )}
      <div className="chart-table-wrap">
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">{named ? 'Navn' : 'X'}</th>
              {series.map((one, k) => (
                <th key={one.id} scope="col">
                  <input
                    type="text"
                    aria-label={`Navn på serie ${k + 1}`}
                    placeholder={`Serie ${k + 1}`}
                    value={one.name}
                    onChange={(e) =>
                      change((f) => {
                        f.series![k]!.name = e.target.value;
                      }, `series-name-${one.id}`)
                    }
                  />
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {figure.items.map((row, r) => (
              <tr key={row.id}>
                <td>
                  {named ? (
                    <input
                      type="text"
                      aria-label={`Navn på rad ${r + 1}`}
                      value={row.text}
                      onPaste={paste(r, 0)}
                      onChange={(e) =>
                        change((f) => {
                          f.items[r]!.text = e.target.value;
                        }, `row-name-${row.id}`)
                      }
                    />
                  ) : (
                    <NumberCell
                      label={`X i rad ${r + 1}`}
                      value={row.x ?? null}
                      onPaste={paste(r, 0)}
                      onChange={(value) =>
                        change((f) => {
                          f.items[r]!.x = value;
                        }, `row-x-${row.id}`)
                      }
                    />
                  )}
                </td>
                {series.map((one, k) => (
                  <td key={one.id}>
                    <NumberCell
                      label={`${seriesName(k)}, rad ${r + 1}`}
                      value={row.values?.[k] ?? null}
                      onPaste={paste(r, k + 1)}
                      onChange={(value) =>
                        change((f) => {
                          const item = f.items[r]!;
                          item.values = Array.from(
                            { length: f.series?.length ?? 0 },
                            (_, i) => item.values?.[i] ?? null,
                          );
                          item.values[k] = value;
                        }, `cell-${row.id}-${one.id}`)
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Fjern rad ${r + 1}`}
                    onClick={() =>
                      change((f) => {
                        f.items.splice(r, 1);
                      })
                    }
                  >
                    Fjern
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {series.length > 1 && (
            <tfoot>
              <tr>
                <td />
                {series.map((one, k) => (
                  <td key={one.id}>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Fjern serie ${k + 1}`}
                      onClick={() => change((f) => removeSeries(f, k))}
                    >
                      Fjern
                    </button>
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="strong"
          onClick={() => change((f) => void f.items.push(emptyRow(f, newId('e'))))}
        >
          Legg til rad
        </button>
        <button type="button" onClick={() => change((f) => addSeries(f, newId('e')))}>
          Legg til serie
        </button>
      </div>
      {(series.length > 1 || (bars && figure.items.length > 1)) && (
        <div className="button-row">
          {bars && figure.items.length > 1 && (
            <button
              type="button"
              title="Søylene kommer inn rad for rad, hver med navnet sitt. Aksene står der fra start."
              onClick={() => updateScene((s) => stepPerItem(s, figure.id, stepMaker(s)))}
            >
              Ett steg per rad
            </button>
          )}
          {series.length > 1 && (
            <button
              type="button"
              title="Seriene kommer inn én etter én. Aksene står der fra start."
              onClick={() => updateScene((s) => stepPerItem(s, figure.id, stepMaker(s), 'series'))}
            >
              Ett steg per serie
            </button>
          )}
        </div>
      )}
      {title('yTitle', 'Tekst ved den loddrette aksen')}
      {title('xTitle', 'Tekst ved den vannrette aksen')}
      <p className="hint">
        {bars
          ? 'Søylene starter alltid på null. Aksen følger ellers tallene, om du ikke skriver noe her.'
          : named
            ? 'Den loddrette aksen følger tallene, om du ikke skriver noe her.'
            : 'Aksene følger tallene, om du ikke skriver noe her.'}
      </p>
      {end('yMin', 'Laveste tall på den loddrette aksen')}
      {end('yMax', 'Høyeste tall på den loddrette aksen')}
      {!named && end('xMin', 'Laveste tall på den vannrette aksen')}
      {!named && end('xMax', 'Høyeste tall på den vannrette aksen')}
      {!bars && (
        <label className="check">
          <input
            type="checkbox"
            checked={figure.dots === true}
            onChange={(e) =>
              change((f) => {
                if (e.target.checked) f.dots = true;
                else delete f.dots;
              })
            }
          />
          Vis punktene
        </label>
      )}
      {series.map((one, k) => (
        <Swatches
          key={one.id}
          label={`Farge på ${seriesName(k)}`}
          colors={SERIES_ORDER}
          value={one.color}
          noneLabel="Temaets"
          onChange={(value) =>
            change((f) => {
              if (value) f.series![k]!.color = value;
              else delete f.series![k]!.color;
            })
          }
        />
      ))}
      <NumberField
        label="Skriftstørrelse"
        value={figureFontSize(figure)}
        min={10}
        max={200}
        onChange={(value) =>
          change((f) => {
            f.fontSize = value;
          }, 'figure-size')
        }
      />
      <div className="button-row">
        <button type="button" onClick={() => releaseToFree(figure)}>
          Gjør om til fri figur
        </button>
      </div>
      <p className="hint">
        En fri figur kan du flytte og endre del for del. Tabellen blir da borte for godt.
      </p>
    </div>
  );
}

/** The form of a figure that draws itself: its rows, and how the figure is to look. */
function FigureFields({ figure }: { figure: FigureElement }) {
  const updateScene = useStore((s) => s.updateScene);
  const stage = useStage();
  const [added, setAdded] = useState<string | null>(null);
  const change = useFigureChange(figure);
  const name = ITEM_NAMES[figure.template];
  const comparison = figure.template === 'comparison';
  const axis = figure.template === 'timeAxis';
  /** What the first field of a row is, and the second where the template has two. */
  const first = comparison
    ? { label: 'Overskrift i', hint: 'Overskrift' }
    : axis
      ? { label: 'Tidspunkt for', hint: 'Tidspunkt' }
      : { label: 'Tekst i', hint: 'Tekst' };
  const second = comparison
    ? { label: 'Punkter i', hint: 'Punkter, ett på hver linje', rows: 3 }
    : axis
      ? { label: 'Tekst til', hint: 'Tekst', rows: 2 }
      : undefined;
  const release = (): void => releaseToFree(figure);
  if (isChart(figure)) return <ChartFields figure={figure} />;
  return (
    <div className="group">
      <p className="hint">
        Figuren tegner seg selv fra det du skriver her. Dra i rammen rundt den for å flytte den
        eller endre størrelsen.
      </p>
      <ol className="figure-form">
        {figure.items.map((item, index) => (
          <li key={item.id}>
            <span className="mark-list-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="figure-form-fields">
              <input
                type="text"
                aria-label={`${first.label} ${name} ${index + 1}`}
                placeholder={first.hint}
                value={item.text}
                autoFocus={item.id === added}
                onChange={(e) =>
                  change((f) => {
                    f.items[index]!.text = e.target.value;
                  }, `item-text-${item.id}`)
                }
              />
              {second && (
                <textarea
                  rows={second.rows}
                  aria-label={`${second.label} ${name} ${index + 1}`}
                  placeholder={second.hint}
                  value={item.detail ?? ''}
                  onChange={(e) =>
                    change((f) => {
                      if (e.target.value) f.items[index]!.detail = e.target.value;
                      else delete f.items[index]!.detail;
                    }, `item-detail-${item.id}`)
                  }
                />
              )}
            </div>
            <div className="figure-form-buttons">
              <button
                type="button"
                className="icon-only"
                disabled={index === 0}
                aria-label={`Flytt ${name} ${index + 1} opp`}
                title="Flytt opp"
                onClick={() => change((f) => moveItem(f, index, index - 1))}
              >
                <Icon name="up" />
              </button>
              <button
                type="button"
                className="icon-only"
                disabled={index === figure.items.length - 1}
                aria-label={`Flytt ${name} ${index + 1} ned`}
                title="Flytt ned"
                onClick={() => change((f) => moveItem(f, index, index + 1))}
              >
                <Icon name="down" />
              </button>
              <button
                type="button"
                className="danger"
                aria-label={`Fjern ${name} ${index + 1}`}
                onClick={() =>
                  change((f) => {
                    f.items.splice(index, 1);
                  })
                }
              >
                Fjern
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="button-row">
        <button
          type="button"
          className="strong"
          onClick={() => {
            const id = newId('e');
            change((f) => {
              f.items.push({ id, text: '' });
            });
            setAdded(id);
          }}
        >
          Legg til {name}
        </button>
        {figure.items.length > 1 && (
          <button
            type="button"
            title={
              figure.template === 'process'
                ? 'Boksene kommer inn én etter én, hver sammen med pila som leder til den.'
                : axis
                  ? 'Hendelsene kommer inn én etter én. Selve aksen står der fra start.'
                  : undefined
            }
            onClick={() => updateScene((s) => stepPerItem(s, figure.id, stepMaker(s)))}
          >
            Ett steg per {name}
          </button>
        )}
      </div>
      {(figure.template === 'process' || axis) && (
        <Segmented
          label="Retning"
          options={[
            ['across', 'Bortover'],
            ['down', 'Nedover'],
          ]}
          value={figure.direction ?? 'across'}
          onChange={(value) => change((f) => setDirection(f, value, stage))}
        />
      )}
      <Swatches
        label="Farge"
        colors={SERIES_ORDER}
        value={figure.color}
        noneLabel="Malens"
        onChange={(value) =>
          change((f) => {
            if (value) f.color = value;
            else delete f.color;
          })
        }
      />
      <NumberField
        label="Skriftstørrelse"
        value={figureFontSize(figure)}
        min={10}
        max={200}
        onChange={(value) =>
          change((f) => {
            f.fontSize = value;
          }, 'figure-size')
        }
      />
      <div className="button-row">
        <button type="button" onClick={release}>
          Gjør om til fri figur
        </button>
      </div>
      <p className="hint">
        En fri figur kan du flytte og endre del for del. Skjemaet blir da borte for godt.
      </p>
    </div>
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

/** The marks of a picture: how they are drawn, what each says, and a way to add one. */
function ImageMarks({ el, scene }: { el: Extract<Element, { type: 'image' }>; scene: Scene }) {
  const updateScene = useStore((s) => s.updateScene);
  const stage = useStage();
  const marks = marksOf(scene, el.id);
  const style = markStyle(el);
  const [added, setAdded] = useState<string | null>(null);
  const setText = (id: string, text: string): void =>
    updateScene((s) => {
      const mark = s.elements.find((e) => e.id === id);
      if (mark?.type === 'mark') mark.text = text;
    }, `mark-text-${id}`);
  return (
    <div className="group">
      <h3>Merker på bildet</h3>
      {marks.length === 0 && (
        <p className="hint">
          Pek ut det viktige i bildet. Hvert merke kan komme inn i et steg og ha «Lær mer».
        </p>
      )}
      <Field label="Slik vises merkene">
        <select
          value={style}
          onChange={(e) =>
            updateScene((s) =>
              setMarkStyle(
                s,
                el.id,
                e.target.value === 'labels' ? 'labels' : 'numbers',
                () => newId('e'),
                stage,
              ),
            )
          }
        >
          <option value="numbers">Tall, med forklaring ved siden av</option>
          <option value="labels">Etiketter med strek</option>
        </select>
      </Field>
      {marks.length > 0 && (
        <ol className="mark-list">
          {marks.map((mark, index) => (
            <li key={mark.id}>
              <span className="mark-list-number" aria-hidden="true">
                {index + 1}
              </span>
              <input
                type="text"
                aria-label={`Tekst til merke ${index + 1}`}
                placeholder="Hva peker merket på?"
                value={mark.text}
                autoFocus={mark.id === added}
                onChange={(e) => setText(mark.id, e.target.value)}
              />
              <button
                type="button"
                className="danger"
                aria-label={`Fjern merke ${index + 1}`}
                onClick={() => updateScene((s) => deleteElements(s, [mark.id]))}
              >
                Fjern
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="button-row">
        <button
          type="button"
          className="strong"
          onClick={() => {
            let made: string | null = null;
            updateScene((s) => {
              made = addMark(s, el.id, () => newId('e'), stage)?.id ?? null;
            });
            setAdded(made);
          }}
        >
          Legg til merke
        </button>
        {marks.length > 1 && (
          <button
            type="button"
            onClick={() => updateScene((s) => stepPerMark(s, el.id, (id) => newStep(s, [id])))}
          >
            Ett steg per merke
          </button>
        )}
      </div>
      {marks.length > 0 && (
        <p className="hint">
          Dra merkene på plass i lysarket. Klikk på et merke for å gi det «Lær mer»
          {style === 'labels'
            ? ', og dra i den runde prikken for å flytte det etiketten peker på'
            : ''}
          .
        </p>
      )}
    </div>
  );
}

/** One mark on a picture: what it says, and the way back to its picture. */
function MarkFields({ el, scene }: { el: Extract<Element, { type: 'mark' }>; scene: Scene }) {
  const update = useElementUpdate(el.id);
  const select = useStore((s) => s.select);
  const picture = pictureOf(scene, el);
  const numbers = markStyle(picture) === 'numbers';
  return (
    <>
      <Field
        label={numbers ? `Forklaring til merke ${markNumber(scene, el)}` : 'Tekst på etiketten'}
        hint={
          numbers
            ? 'Står i lista ved siden av bildet.'
            : 'Dra i den runde prikken for å flytte det etiketten peker på.'
        }
      >
        <input
          type="text"
          value={el.text}
          placeholder="Hva peker merket på?"
          onChange={(e) =>
            update<typeof el>((m) => {
              m.text = e.target.value;
            }, 'text')
          }
        />
      </Field>
      {picture && (
        <div className="button-row">
          <button type="button" onClick={() => select([picture.id])}>
            Velg bildet merket står på
          </button>
        </div>
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
  // A figure that draws itself from a form is changed in the form, whatever part of it is chosen.
  const ids = selected.map((el) => el.id);
  const figure =
    wholeFigure(scene, ids) ?? (selected.length === 1 ? figureOf(scene, selected[0]!) : undefined);
  if (figure && (selected.length > 1 || selected[0]!.type === 'figure')) {
    return (
      <div className="panel-body">
        <h3>{describeElement(figure)}</h3>
        <FigureFields figure={figure} />
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
  if (figure) {
    const part = selected[0]!;
    return (
      <div className="panel-body">
        <h3>{describeElement(part)}</h3>
        <p className="hint">
          Dette er en del av en figur ({TEMPLATE_NAMES[figure.template].toLowerCase()}). Tekst,
          farge og plass styres av skjemaet til figuren. «Lær mer» og steg er delens egne.
        </p>
        <div className="button-row">
          <button
            type="button"
            onClick={() =>
              useStore
                .getState()
                .select([figure.id, ...partsOf(scene, figure.id).map((el) => el.id)])
            }
          >
            Vis skjemaet
          </button>
        </div>
        <MoreFields el={part} />
        <div className="button-row">
          <button type="button" className="danger" onClick={remove}>
            Slett
          </button>
        </div>
      </div>
    );
  }
  if (selected.length > 1) {
    const group = wholeGroup(
      scene,
      selected.map((el) => el.id),
    );
    return (
      <div className="panel-body">
        <h3>
          {group
            ? `Gruppe med ${membersOf(scene, group).length} deler`
            : `${selected.length} elementer valgt`}
        </h3>
        {group && (
          <p className="hint">
            Klikk en gang til på en del for å velge bare den. Dobbeltklikk for å skrive i den.
          </p>
        )}
        <GroupFields scene={scene} selected={selected} />
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
      {el.type === 'image' && <ImageMarks el={el} scene={scene} />}
      {el.type === 'image' && <ImageCredit assetId={el.asset} />}
      {el.type === 'mark' && <MarkFields el={el} scene={scene} />}
      {el.type === 'legend' && (
        <p className="hint">
          Lista skriver seg selv fra merkene på bildet. Teksten endrer du på bildet eller på hvert
          merke. Dra lista dit den skal stå.
        </p>
      )}
      {el.type === 'shape' && <ShapeFields el={el} />}
      {el.type === 'table' && <TableFields el={el} />}
      {el.type === 'video' && <VideoFields el={el} />}
      <MoreFields el={el} />
      <GroupFields scene={scene} selected={selected} />
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

/**
 * How long the slide stands when it has no sound: the length that applies
 * now, which the lecturer can change. On a slide with sound, the sound
 * decides, and that is said instead.
 */
function SceneTime({ scene }: { scene: Scene }) {
  const updateScene = useStore((s) => s.updateScene);
  if (!ownsSeconds(scene)) return null;
  if (hasSound(scene)) {
    return (
      <div className="field">
        <span className="field-label">Tid</span>
        <p className="hint scene-time-sound">
          Lysarket har lyd, og står så lenge lyden varer: {formatTime(sceneDuration(scene))}.
          Lengden endres i fanen «Lyd».
        </p>
      </div>
    );
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor="scene-seconds">
        Tid uten lyd
      </label>
      <span className="scene-seconds">
        <SecondsInput
          key={scene.id}
          id="scene-seconds"
          className="audio-number"
          label="Tid uten lyd, i sekunder"
          describedBy="scene-seconds-hint"
          min={SILENT_SECONDS.min}
          max={SILENT_SECONDS.max}
          value={sceneDuration(scene)}
          onChange={(seconds) => updateScene((s) => setSilentSeconds(s, seconds))}
        />{' '}
        sekunder
      </span>
      <span className="field-hint" id="scene-seconds-hint">
        Så lenge står lysarket i videoen og i «Spill av» når det ikke har lyd.
      </span>
    </div>
  );
}

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
          checked={!scene.skip}
          onChange={(e) =>
            updateScene((s) => {
              if (e.target.checked) delete s.skip;
              else s.skip = true;
            })
          }
        />
        Ta med i videoen og i «Spill av»
      </label>
      {scene.skip && (
        <p className="hint">
          Lysarket er ikke med i videoen og i «Spill av», og tar ingen tid der. Den som blar i
          HTML-fila for hånd, ser det likevel.
        </p>
      )}
      <SceneTime scene={scene} />
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
      {hasCameraFilm(scene, project.assets) && (
        <div className="group">
          <h3>Kamerasirkelen</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={!scene.camera?.hidden}
              onChange={(e) =>
                updateScene((s) => {
                  const place = s.camera ?? defaultCameraPlace(stageOf(project));
                  s.camera = { x: place.x, y: place.y, size: place.size };
                  if (!e.target.checked) s.camera.hidden = true;
                })
              }
            />
            Vis kamerasirkelen på dette lysarket
          </label>
          <Field label="Størrelse">
            <select
              value={scene.camera?.size ?? defaultCameraPlace().size}
              onChange={(e) =>
                updateScene((s) => {
                  const stage = stageOf(project);
                  const place = s.camera ?? defaultCameraPlace(stage);
                  const size = e.target.value as CameraSize;
                  // A larger circle is kept wholly on the slide.
                  s.camera = { ...place, ...cameraOnStage(place.x, place.y, size, stage), size };
                })
              }
            >
              {CAMERA_SIZES.map((size) => (
                <option key={size} value={size}>
                  {{ small: 'Liten', medium: 'Middels', large: 'Stor' }[size]}
                </option>
              ))}
            </select>
          </Field>
          <p className="hint">
            Dra sirkelen på lysarket for å flytte den. Den er med i videoen, ikke i HTML-fila.
          </p>
        </div>
      )}
      <div className="group">
        <button type="button" onClick={() => updateScene((s) => fitToGrid(s, theme))}>
          Rydd opp lysarket
        </button>
        <p className="hint">
          Rydder lysarket inn i de {theme.grid.columns === 4 ? 'fire' : 'åtte'} kolonnene,
          venstrestiller teksten og bruker temaets skriftstørrelser. Kan angres.
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

/** What the movements are called where the lecturer chooses one. */
const EFFECT_NAMES: Record<StepEffect, string> = {
  fade: 'Toner inn',
  slide: 'Glir inn fra siden',
  grow: 'Vokser fram',
  draw: 'Tegnes',
  count: 'Teller opp',
  appear: 'Vises med en gang',
};
const SPEED_NAMES: Record<Speed, string> = { fast: 'Rask', normal: 'Vanlig', slow: 'Langsom' };

/** What a step does, in a word, for one that does something else than bring elements in. */
function stepDoes(step: Step): string | undefined {
  if (step.kind === 'mark') return 'markerer';
  if (step.kind === 'hide') return 'tar bort';
  if (step.kind === 'zoom') return step.zoom ? 'zoomer inn' : 'zoomer ut';
  return undefined;
}

function StepsPanel({ scene }: { scene: Scene }) {
  const selection = useStore((s) => s.selection);
  const stage = useStage();
  const previewSteps = useStore((s) => s.previewSteps);
  const setPreviewSteps = useStore((s) => s.setPreviewSteps);
  const zoomStep = useStore((s) => s.zoomStep);
  const setZoomStep = useStore((s) => s.setZoomStep);
  const updateScene = useStore((s) => s.updateScene);
  const select = useStore((s) => s.select);
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  // A figure with a form is one line here, not one for each of its many parts.
  const fromStart = scene.elements.filter((e) => stepOf(scene, e.id) < 0 && !e.of);
  const total = scene.timeline.length;

  // The frame of a zoom lies on top of the slide and takes the pointer. It is
  // put away when the steps are left, so it is never in the way of the slide.
  useEffect(() => () => useStore.getState().setZoomStep(null), []);

  const move = (index: number, delta: number) => () =>
    updateScene((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.timeline.length) return;
      const [step] = s.timeline.splice(index, 1);
      s.timeline.splice(to, 0, step!);
    });
  const change = (index: number, recipe: (step: Step) => void): void =>
    updateScene((s) => {
      const step = s.timeline[index];
      if (step) recipe(step);
    });
  const zoomIn = (): void => {
    // Round what is chosen, when something is; otherwise the middle of the slide.
    const chosen = scene.elements.filter((el) => selection.includes(el.id)).map((el) => el.box);
    let made = '';
    updateScene((s) => {
      made = addZoomStep(s, viewAround(chosen, stage), stage);
    });
    setZoomStep(made);
  };

  return (
    <div className="panel-body">
      <p className="hint">
        Et steg er «nå skjer dette»: noe kommer inn, blir markert eller tatt bort, eller bildet
        zoomer. I HTML går studenten til neste steg med piltast. Elementer som ikke kommer inn i noe
        steg, er synlige fra starten.
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
          disabled={selection.length === 0}
          title="Et steg som setter en ramme rundt det som er valgt, til neste steg kommer."
          onClick={() => updateScene((s) => addKindStep(s, 'mark', selection))}
        >
          Marker det som er valgt
        </button>
        <button
          type="button"
          disabled={selection.length === 0}
          title="Et steg som lar det som er valgt, tone bort."
          onClick={() => updateScene((s) => addKindStep(s, 'hide', selection))}
        >
          Ta bort det som er valgt
        </button>
      </div>
      <div className="button-row">
        <button
          type="button"
          title="Et steg der bildet glir inn på en del av lysarket. Du drar rammen dit du vil."
          onClick={zoomIn}
        >
          Zoom inn
        </button>
        <button
          type="button"
          disabled={!zoomedBefore(scene.timeline, total)}
          title="Et steg der bildet glir ut til hele lysarket igjen."
          onClick={() => updateScene((s) => void addZoomStep(s, undefined, stage))}
        >
          Zoom ut igjen
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
        {scene.timeline.map((step, index) => {
          const does = stepDoes(step);
          const moves = step.kind === 'zoom' || step.actions.some((a) => a.effect !== 'appear');
          return (
            <li key={step.id} className="step-item">
              <div className="step-head">
                <strong>
                  Steg {index + 1}
                  {does ? `: ${does}` : ''}
                </strong>
                {moves && (
                  <select
                    aria-label={`Fart på steg ${index + 1}`}
                    value={stepSpeed(step)}
                    onChange={(e) => change(index, (s) => setStepSpeed(s, e.target.value as Speed))}
                  >
                    {SPEEDS.map((speed) => (
                      <option key={speed} value={speed}>
                        {SPEED_NAMES[speed]}
                      </option>
                    ))}
                  </select>
                )}
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
              {step.kind === 'zoom' ? (
                <>
                  <p className="hint">
                    {step.zoom
                      ? 'Bildet glir inn på utsnittet i rammen på lysarket.'
                      : 'Bildet glir ut til hele lysarket igjen.'}
                  </p>
                  <div className="button-row">
                    {step.zoom && (
                      <button
                        type="button"
                        aria-pressed={zoomStep === step.id}
                        onClick={() => setZoomStep(zoomStep === step.id ? null : step.id)}
                      >
                        {zoomStep === step.id ? 'Ferdig med rammen' : 'Flytt utsnittet'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Fjern steg ${index + 1}`}
                      onClick={() =>
                        updateScene((s) => {
                          s.timeline.splice(index, 1);
                        })
                      }
                    >
                      Fjern steget
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ul>
                    {step.actions.map((action) => {
                      const el = byId.get(action.target);
                      if (!el) return null;
                      return (
                        <li key={action.target}>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => select([el.id])}
                          >
                            {describeElement(el)}
                          </button>
                          {!step.kind && (
                            <select
                              aria-label={`Hvordan ${describeElement(el)} kommer inn`}
                              value={action.effect}
                              onChange={(e) =>
                                change(index, (s) => {
                                  const target = s.actions.find((a) => a.target === el.id);
                                  if (!target) return;
                                  const speed = stepSpeed(s);
                                  target.effect = e.target.value as StepEffect;
                                  target.duration = effectSeconds(target.effect, speed);
                                })
                              }
                            >
                              {effectsFor(el).map((effect) => (
                                <option key={effect} value={effect}>
                                  {EFFECT_NAMES[effect]}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            className="link-button quiet"
                            title={
                              step.kind
                                ? 'Ta ut av dette steget'
                                : 'Ta ut av steget (blir synlig fra starten)'
                            }
                            onClick={() => updateScene((s) => removeFromStep(s, step.id, [el.id]))}
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
                </>
              )}
            </li>
          );
        })}
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
