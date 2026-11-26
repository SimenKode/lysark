// The camera circle on a slide: the lecturer's face in a circle with a white
// ring, which can be dragged to where it covers nothing. In the recording
// window it shows what the camera sees; in the editor it shows the film that
// was taken, at the moment the sound panel stands at.
//
// The video export draws the same circle itself (src/shared/render/cameraDraw.ts):
// the same diameter and ring. Change the two together.
import { useEffect, useRef } from 'react';
import { STAGE } from '../../shared/format/constants';
import { CAMERA_RING } from '../../shared/render/clock';

interface Props {
  /** The centre of the circle and its width, in stage pixels. */
  x: number;
  y: number;
  diameter: number;
  /** What the camera sees right now (the recording window). Shown mirrored, like a mirror. */
  stream?: MediaStream | null;
  /** The film that was taken, and which moment of it to show (the editor). */
  film?: { url: string; time: number; playing: boolean };
  /**
   * Called while the circle is dragged, with its new centre in stage pixels:
   * 'start' when it is taken hold of, 'move' on the way, 'end' when it is let go.
   */
  onMove: (x: number, y: number, phase: 'start' | 'move' | 'end') => void;
  /** Let the arrow keys move the circle (not where they mean "next step"). */
  keyboard?: boolean;
}

export function CameraCircle({ x, y, diameter, stream, film, onMove, keyboard }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || film) return;
    el.srcObject = stream ?? null;
    if (stream) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream, film]);

  // The film follows the sound panel: it runs while the sound plays, and
  // stands on the right picture otherwise.
  const filmUrl = film?.url;
  const filmTime = film?.time ?? 0;
  const filmPlaying = film?.playing ?? false;
  useEffect(() => {
    const el = video.current;
    if (!el || filmUrl === undefined) return;
    const off = Math.abs(el.currentTime - filmTime);
    if (filmPlaying) {
      if (off > 0.3) el.currentTime = filmTime;
      if (el.paused) void el.play().catch(() => undefined);
    } else {
      if (!el.paused) el.pause();
      if (off > 0.01) el.currentTime = filmTime;
    }
  }, [filmUrl, filmTime, filmPlaying]);

  /** A point on the screen as a point on the stage. */
  const onStage = (event: React.PointerEvent): { x: number; y: number } => {
    const stage = (event.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    const box = stage?.getBoundingClientRect();
    if (!box || box.width === 0) return { x, y };
    const scale = box.width / STAGE.width;
    return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale };
  };

  return (
    <div
      className={`camera-circle${film ? '' : ' is-mirrored'}`}
      style={{
        left: x - diameter / 2,
        top: y - diameter / 2,
        width: diameter,
        height: diameter,
        borderWidth: CAMERA_RING,
      }}
      role="img"
      aria-label={
        keyboard
          ? 'Kamerasirkelen. Dra den, eller bruk piltastene, for å flytte den.'
          : 'Kamerasirkelen. Dra den dit den ikke dekker noe.'
      }
      title="Dra for å flytte kamerasirkelen"
      tabIndex={keyboard ? 0 : undefined}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const at = onStage(event);
        drag.current = { dx: at.x - x, dy: at.y - y, moved: false };
        onMove(x, y, 'start');
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        event.stopPropagation();
        const at = onStage(event);
        d.moved = true;
        onMove(at.x - d.dx, at.y - d.dy, 'move');
      }}
      onPointerUp={(event) => {
        const d = drag.current;
        if (!d) return;
        event.stopPropagation();
        drag.current = null;
        const at = onStage(event);
        if (d.moved) onMove(at.x - d.dx, at.y - d.dy, 'end');
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        if (!keyboard) return;
        const step = event.shiftKey ? 100 : 20;
        const by: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const move = by[event.key];
        if (!move) return;
        event.preventDefault();
        event.stopPropagation();
        onMove(x, y, 'start');
        onMove(x + move[0], y + move[1], 'end');
      }}
    >
      <video
        ref={video}
        src={filmUrl}
        muted
        playsInline
        preload="auto"
        // What the camera sees always runs; only the film that was taken stands still.
        onPause={(event) => {
          if (!film && stream) void event.currentTarget.play().catch(() => undefined);
        }}
      />
    </div>
  );
}
