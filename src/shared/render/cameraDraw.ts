// Puts the camera circle into a picture of the video: the lecturer's face in
// a circle with a white ring. Pure arithmetic on pixels, so the video export
// can do it for every frame without drawing the slide anew.
//
// The interface draws the same circle with CSS (`.camera-circle`): the same
// diameter, the same ring. Change the two together.
import { CAMERA_RING } from './clock';

/** The side of the square picture of the face that fills a circle of this diameter. */
export function cameraFaceSize(diameter: number): number {
  return Math.max(2, Math.round(diameter) - 2 * CAMERA_RING);
}

/**
 * How much of each pixel of a `diameter` wide square the whole circle covers
 * (`outer`) and how much the face inside the ring covers (`inner`), 0..255.
 * The edges are softened over one pixel.
 */
export function cameraMask(diameter: number): { outer: Uint8Array; inner: Uint8Array } {
  const size = Math.round(diameter);
  const outer = new Uint8Array(size * size);
  const inner = new Uint8Array(size * size);
  const centre = size / 2;
  const radius = size / 2;
  const cover = (reach: number, distance: number): number =>
    Math.round(255 * Math.max(0, Math.min(1, reach - distance + 0.5)));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
      outer[y * size + x] = cover(radius, distance);
      inner[y * size + x] = cover(radius - CAMERA_RING, distance);
    }
  }
  return { outer, inner };
}

/**
 * Draws the circle into `target` (pixels of four bytes, `width` x `height`),
 * with its centre at (`cx`, `cy`). `face` is a square picture in the same
 * pixel format, `cameraFaceSize(diameter)` on each side. What falls outside
 * the picture is left out.
 */
export function drawCamera(
  target: Uint8Array,
  width: number,
  height: number,
  face: Uint8Array,
  cx: number,
  cy: number,
  diameter: number,
  mask: { outer: Uint8Array; inner: Uint8Array },
): void {
  const size = Math.round(diameter);
  const faceSize = cameraFaceSize(diameter);
  const left = Math.round(cx - size / 2);
  const top = Math.round(cy - size / 2);
  for (let y = 0; y < size; y++) {
    const ty = top + y;
    if (ty < 0 || ty >= height) continue;
    for (let x = 0; x < size; x++) {
      const tx = left + x;
      if (tx < 0 || tx >= width) continue;
      const all = mask.outer[y * size + x]!;
      if (all === 0) continue;
      const inside = mask.inner[y * size + x]!;
      const at = (ty * width + tx) * 4;
      const fx = Math.max(0, Math.min(faceSize - 1, x - CAMERA_RING));
      const fy = Math.max(0, Math.min(faceSize - 1, y - CAMERA_RING));
      const from = (fy * faceSize + fx) * 4;
      // What was there, then the white ring, then the face: each by its share of the pixel.
      for (let channel = 0; channel < 3; channel++) {
        const under = target[at + channel]!;
        const ring = 255;
        const shown = face[from + channel]!;
        target[at + channel] = Math.round(
          (under * (255 - all) + ring * (all - inside) + shown * inside) / 255,
        );
      }
      target[at + 3] = 255;
    }
  }
}
