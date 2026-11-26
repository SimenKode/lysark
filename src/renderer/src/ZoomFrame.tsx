// The frame of a step that zooms, on the slide: the part of the slide the
// picture is to glide in on. The lecturer drags it into place, and drags its
// corner to make the part larger or smaller. It always has the shape of the
// slide, and stays inside it.
import { useRef, useState } from 'react';
import type { Scene } from '../../shared/format/schema';
import { fitView, smallestView, type View } from '../../shared/layout/steps';
import { useStage, useStore } from './store';

export function ZoomFrame({ scene, scale }: { scene: Scene; scale: number }) {
  const stepId = useStore((s) => s.zoomStep);
  const stage = useStage();
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<View | null>(null);
  const step = scene.timeline.find((one) => one.id === stepId && one.kind === 'zoom');
  if (!step?.zoom) return null;
  const view = live ?? step.zoom;
  const number = scene.timeline.indexOf(step) + 1;

  const onSlide = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const rect = ref.current!.parentElement!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * stage.width,
      y: ((event.clientY - rect.top) / rect.height) * stage.height,
    };
  };
  const drag =
    (how: 'move' | 'size') =>
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const from = onSlide(event);
      const first = view;
      let latest: View | null = null;
      const onMove = (moved: PointerEvent): void => {
        const p = onSlide(moved);
        if (how === 'move') {
          latest = fitView(
            { ...first, x: first.x + p.x - from.x, y: first.y + p.y - from.y },
            stage,
          );
        } else {
          // The corner follows the pointer; the opposite corner stands still.
          const widest = Math.min(
            stage.width - first.x,
            ((stage.height - first.y) * stage.width) / stage.height,
          );
          const w = Math.round(Math.max(smallestView(stage), Math.min(widest, p.x - first.x)));
          latest = { x: first.x, y: first.y, w, h: Math.round((w * stage.height) / stage.width) };
        }
        setLive(latest);
      };
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const to = latest;
        setLive(null);
        if (!to) return;
        useStore.getState().updateScene((s) => {
          const target = s.timeline.find((one) => one.id === step.id);
          if (target?.kind === 'zoom') target.zoom = to;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

  const line = 3 / scale;
  const handle = 16 / scale;
  return (
    <div
      ref={ref}
      className="zoom-frame"
      title="Dra rammen dit bildet skal zoome inn. Dra i hjørnet for å gjøre utsnittet større eller mindre."
      style={{
        left: view.x,
        top: view.y,
        width: view.w,
        height: view.h,
        outlineWidth: line,
      }}
      onPointerDown={drag('move')}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <span
        className="zoom-frame-label"
        style={{ fontSize: 15 / scale, padding: `${3 / scale}px ${8 / scale}px` }}
      >
        Steg {number}: zoomer inn hit
      </span>
      <div
        className="zoom-frame-corner"
        title="Dra for å gjøre utsnittet større eller mindre"
        style={{
          right: -handle / 2,
          bottom: -handle / 2,
          width: handle,
          height: handle,
          borderWidth: line,
        }}
        onPointerDown={drag('size')}
      />
    </div>
  );
}
