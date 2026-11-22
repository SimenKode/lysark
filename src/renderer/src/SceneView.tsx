// Shows a scene using the shared render code. Nodes of elements that have
// not changed are kept between renders, so images do not reload while the
// owner edits something else.
import { memo, useLayoutEffect, useRef } from 'react';
import { logoUrl, mediaUrl, type LogoStatus } from '../../shared/api';
import type { Element, Project, Scene } from '../../shared/format/schema';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../../shared/render/scene';
import { sceneState } from '../../shared/render/timeline';
import { getTheme } from '../../shared/theme/theme';

export function renderContext(project: Project, logo: LogoStatus): RenderContext {
  return {
    doc: document,
    project,
    theme: getTheme(project),
    mode: 'edit',
    assetUrl: (id) => {
      const asset = project.assets[id];
      return asset ? mediaUrl(asset.file) : undefined;
    },
    logo: {
      light: logo.light ? logoUrl('light', logo.version) : undefined,
      dark: logo.dark ? logoUrl('dark', logo.version) : undefined,
    },
    strings: SCENE_STRINGS[project.meta.language],
  };
}

/** True when the old node still shows the element correctly (only the box may differ). */
function canReuse(before: Element, after: Element): boolean {
  if (before === after) return true;
  if (before.type !== after.type || after.type === 'shape') return false;
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (key !== 'box' && a[key] !== b[key]) return false;
  }
  return true;
}

interface Kept {
  key: string;
  editingId: string | null;
  nodes: Map<string, { element: Element; node: HTMLElement }>;
}

interface Props {
  scene: Scene;
  project: Project;
  logo: LogoStatus;
  /** The element being edited in place; its node is never reused. */
  editingId?: string | null;
  /** Show the scene as it is after this many steps; later elements are dimmed. */
  previewSteps?: number | null;
}

export const SceneView = memo(function SceneView({
  scene,
  project,
  logo,
  editingId = null,
  previewSteps = null,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const kept = useRef<Kept | null>(null);
  const { assets, theme, meta } = project;

  useLayoutEffect(() => {
    if (!host.current) return;
    const root = renderScene(renderContext(project, logo), scene);
    const key = [scene.kind, scene.background, theme.style, meta.language, logo.version].join('|');
    const before = kept.current;
    const nodes: Kept['nodes'] = new Map();

    for (const element of scene.elements) {
      const fresh = root.querySelector<HTMLElement>(`[data-el="${element.id}"]`);
      if (!fresh) continue;
      const old = before?.nodes.get(element.id);
      const editingNow = element.id === editingId || element.id === before?.editingId;
      if (old && before?.key === key && !editingNow && canReuse(old.element, element)) {
        old.node.style.cssText = fresh.style.cssText;
        fresh.replaceWith(old.node);
        nodes.set(element.id, { element, node: old.node });
      } else {
        nodes.set(element.id, { element, node: fresh });
      }
    }

    const state = previewSteps === null ? null : sceneState(scene, previewSteps, Infinity);
    for (const [id, { node }] of nodes) {
      node.style.opacity = state && (state.get(id) ?? 1) < 1 ? '0.16' : '';
    }

    host.current.replaceChildren(root);
    kept.current = { key, editingId, nodes };
    // `project` itself is deliberately not a dependency: only these parts matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, assets, theme, meta.language, logo, editingId, previewSteps]);

  return <div ref={host} className="scene-host" />;
});
