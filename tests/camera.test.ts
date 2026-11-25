// The camera circle: which picture of the lecturer's face is shown when,
// where the circle stands and how it glides, and how it is drawn into a
// picture of the video. No camera, no window and no FFmpeg are used here.
import { describe, expect, it } from 'vitest';
import { setCameraPlace } from '../src/shared/audio/edit';
import { newProject, newScene } from '../src/shared/format/factory';
import { FORMAT_VERSION, parseProject, type Asset, type Scene } from '../src/shared/format/schema';
import { cameraFaceSize, cameraMask, drawCamera } from '../src/shared/render/cameraDraw';
import {
  CAMERA_DIAMETER,
  CAMERA_FPS,
  CAMERA_GLIDE_SECONDS,
  CAMERA_RING,
  cameraAt,
  cameraFilmAt,
  cameraOnStage,
  cameraPlaceAt,
  defaultCameraPlace,
  hasCameraFilm,
} from '../src/shared/render/clock';

const wav = (camera?: { asset: string; offset: number }): Asset => ({
  kind: 'audio',
  file: 'media/a.wav',
  mime: 'audio/wav',
  bytes: 1,
  ...(camera ? { camera } : {}),
});
const film: Asset = { kind: 'camera', file: 'media/kamera-a.mp4', mime: 'video/mp4', bytes: 1 };

/** Two recordings with a film each, one without, and the films themselves. */
const assets: Record<string, Asset> = {
  rec1: wav({ asset: 'film1', offset: 0.1 }),
  rec2: wav({ asset: 'film2', offset: 0 }),
  plain: wav(),
  film1: film,
  film2: film,
};

function scene(clips: NonNullable<Scene['audio']>['clips']): Scene {
  const made = newScene('content');
  made.audio = { clips };
  return made;
}

describe('which picture of the face is shown', () => {
  it('follows the clip that is heard, into the film that was taken with it', () => {
    const s = scene([{ id: 'c1', kind: 'sound', asset: 'rec1', from: 2, to: 6 }]);
    expect(hasCameraFilm(s, assets)).toBe(true);
    // One second into the slide is three seconds into the recording, and the
    // film's first picture belongs 0.1 s into the recording.
    expect(cameraFilmAt(s, assets, 1)).toEqual({ asset: 'film1', time: 2.9 });
    expect(cameraFilmAt(s, assets, 0)!.time).toBeCloseTo(1.9);
  });

  it('stands still in a pause, on the last picture before it', () => {
    const s = scene([
      { id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 2 },
      { id: 'p', kind: 'pause', duration: 3 },
      { id: 'c2', kind: 'sound', asset: 'rec2', from: 5, to: 7 },
    ]);
    const held = cameraFilmAt(s, assets, 3.5)!;
    expect(held.asset).toBe('film1');
    expect(held.time).toBeCloseTo(2 - 0.1 - 1 / CAMERA_FPS);
    expect(cameraFilmAt(s, assets, 2.01)).toEqual(held);
    expect(cameraFilmAt(s, assets, 5.5)).toEqual({ asset: 'film2', time: 5.5 });
    // After the last word the last picture stands.
    expect(cameraFilmAt(s, assets, 99)!.time).toBeCloseTo(7 - 1 / CAMERA_FPS);
  });

  it('shows the first picture in a pause before anything is said', () => {
    const s = scene([
      { id: 'p', kind: 'pause', duration: 1 },
      { id: 'c1', kind: 'sound', asset: 'rec2', from: 4, to: 6 },
    ]);
    expect(cameraFilmAt(s, assets, 0.5)).toEqual({ asset: 'film2', time: 4 });
  });

  it('has no circle where the voice was recorded without the camera', () => {
    const s = scene([
      { id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 2 },
      { id: 'c2', kind: 'sound', asset: 'plain', from: 0, to: 2 },
      { id: 'p', kind: 'pause', duration: 1 },
    ]);
    expect(cameraFilmAt(s, assets, 1)).toBeDefined();
    expect(cameraFilmAt(s, assets, 3)).toBeUndefined();
    // The pause after it follows what was said last: no circle.
    expect(cameraFilmAt(s, assets, 4.5)).toBeUndefined();
    expect(
      hasCameraFilm(scene([{ id: 'c', kind: 'sound', asset: 'plain', from: 0, to: 1 }]), assets),
    ).toBe(false);
    expect(cameraFilmAt(newScene('content'), assets, 0)).toBeUndefined();
  });

  it('is not shown on a slide where the owner has hidden it', () => {
    const s = scene([{ id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 2 }]);
    s.camera = { ...defaultCameraPlace(), hidden: true };
    expect(cameraFilmAt(s, assets, 1)).toBeUndefined();
    // The film is still there, so the owner can bring the circle back.
    expect(hasCameraFilm(s, assets)).toBe(true);
  });
});

describe('where the circle stands', () => {
  it('starts in the lower right corner, wholly on the slide', () => {
    const place = defaultCameraPlace();
    const r = CAMERA_DIAMETER[place.size] / 2;
    expect(place.x + r).toBeLessThan(1920);
    expect(place.y + r).toBeLessThan(1080);
    expect(cameraOnStage(-50, 5000, 'large')).toEqual({ x: 200, y: 880 });
    expect(cameraOnStage(900.4, 500.6, 'small')).toEqual({ x: 900, y: 501 });
  });

  it('glides to where the lecturer moved it, from the moment it was moved', () => {
    const s = scene([{ id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 10 }]);
    s.camera = { x: 1600, y: 800, size: 'medium' };
    s.events = [
      { id: 'h1', at: 2, kind: 'camera-move', x: 400, y: 800 },
      { id: 'h2', at: 6, kind: 'camera-move', x: 400, y: 300 },
    ];
    expect(cameraPlaceAt(s, 0)).toEqual({ x: 1600, y: 800 });
    expect(cameraPlaceAt(s, 1.99)).toEqual({ x: 1600, y: 800 });
    const half = cameraPlaceAt(s, 2 + CAMERA_GLIDE_SECONDS / 2);
    expect(half.x).toBeCloseTo(1000);
    expect(half.y).toBe(800);
    expect(cameraPlaceAt(s, 2 + CAMERA_GLIDE_SECONDS)).toEqual({ x: 400, y: 800 });
    expect(cameraPlaceAt(s, 5)).toEqual({ x: 400, y: 800 });
    expect(cameraPlaceAt(s, 9)).toEqual({ x: 400, y: 300 });
    // A move that comes before the last glide has ended starts from where the circle had come.
    s.events = [
      { id: 'h1', at: 2, kind: 'camera-move', x: 400, y: 800 },
      { id: 'h2', at: 2 + CAMERA_GLIDE_SECONDS / 2, kind: 'camera-move', x: 1000, y: 200 },
    ];
    const turned = cameraPlaceAt(s, 2 + CAMERA_GLIDE_SECONDS / 2);
    expect(turned.x).toBeCloseTo(1000);
    expect(turned.y).toBeCloseTo(800);
    expect(cameraPlaceAt(s, 5)).toEqual({ x: 1000, y: 200 });
  });

  it('glides in from where it stood when the slide before ended', () => {
    const first = scene([{ id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 4 }]);
    first.camera = { x: 300, y: 300, size: 'small' };
    first.events = [{ id: 'h1', at: 1, kind: 'camera-move', x: 500, y: 300 }];
    const second = scene([{ id: 'c2', kind: 'sound', asset: 'rec2', from: 0, to: 4 }]);
    second.camera = { x: 1500, y: 300, size: 'large' };
    const scenes = [first, second];
    const start = cameraAt(scenes, assets, 1, 0)!;
    expect(start).toMatchObject({ asset: 'film2', time: 0, x: 500, y: 300 });
    expect(start.diameter).toBe(CAMERA_DIAMETER.large);
    expect(cameraAt(scenes, assets, 1, 1)).toMatchObject({ x: 1500, y: 300 });
    // The first slide has nothing to glide in from.
    expect(cameraAt(scenes, assets, 0, 0)).toMatchObject({ x: 300, y: 300, diameter: 200 });
    // After a slide without the circle, it simply stands where the slide says.
    const none = scene([{ id: 'c3', kind: 'sound', asset: 'plain', from: 0, to: 4 }]);
    expect(cameraAt([none, second], assets, 0, 1)).toBeUndefined();
    expect(cameraAt([none, second], assets, 1, 0)).toMatchObject({ x: 1500, y: 300 });
  });

  it('is moved afterwards: the start place, or the move that holds at that moment', () => {
    const s = scene([{ id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 10 }]);
    setCameraPlace(s, 0, { x: 700, y: 400 });
    expect(s.camera).toEqual({ x: 700, y: 400, size: 'medium' });
    s.events = [
      { id: 'h1', at: 2, kind: 'camera-move', x: 400, y: 800 },
      { id: 'h2', at: 6, kind: 'camera-move', x: 400, y: 300 },
    ];
    setCameraPlace(s, 1, { x: 100, y: 100 });
    expect(s.camera).toMatchObject({ x: 100, y: 100 });
    setCameraPlace(s, 4, { x: 900, y: 900 });
    expect(s.events[0]).toMatchObject({ at: 2, x: 900, y: 900 });
    expect(s.events[1]).toMatchObject({ at: 6, x: 400, y: 300 });
    expect(s.camera).toMatchObject({ x: 100, y: 100 });
  });
});

describe('the circle in a picture of the video', () => {
  it('draws the face inside a white ring and leaves the rest alone', () => {
    const width = 400;
    const height = 300;
    const diameter = 100;
    const side = cameraFaceSize(diameter);
    expect(side).toBe(diameter - 2 * CAMERA_RING);
    // A grey picture, and a face that is all one colour: blue 10, green 200, red 30.
    const target = new Uint8Array(width * height * 4).fill(128);
    const face = new Uint8Array(side * side * 4);
    for (let i = 0; i < face.length; i += 4) face.set([10, 200, 30, 255], i);
    drawCamera(target, width, height, face, 200, 150, diameter, cameraMask(diameter));
    const pixel = (x: number, y: number): number[] =>
      Array.from(target.subarray((y * width + x) * 4, (y * width + x) * 4 + 3));
    expect(pixel(200, 150)).toEqual([10, 200, 30]); // the middle: the face
    expect(pixel(200 - 47, 150)).toEqual([255, 255, 255]); // in the ring
    expect(pixel(200, 150 + 47)).toEqual([255, 255, 255]);
    expect(pixel(200 - 60, 150)).toEqual([128, 128, 128]); // outside the circle
    expect(pixel(200 - 49, 150 - 49)).toEqual([128, 128, 128]); // the corner of its square
    expect(pixel(5, 5)).toEqual([128, 128, 128]);
  });

  it('leaves out what falls outside the picture', () => {
    const target = new Uint8Array(50 * 50 * 4).fill(128);
    const side = cameraFaceSize(100);
    const face = new Uint8Array(side * side * 4).fill(40);
    expect(() => drawCamera(target, 50, 50, face, 0, 0, 100, cameraMask(100))).not.toThrow();
    expect(target[0]).toBe(40); // the corner of the picture is in the middle of the circle
    expect(target.length).toBe(50 * 50 * 4);
  });
});

describe('the format', () => {
  it('carries the film, the place and the moves, and reads older projects', () => {
    const project = newProject('A');
    const s = newScene('content');
    project.scenes.push(s);
    project.assets = { rec1: assets.rec1!, film1: film };
    s.audio = { clips: [{ id: 'c1', kind: 'sound', asset: 'rec1', from: 0, to: 2 }] };
    s.camera = { x: 300, y: 400, size: 'small', hidden: true };
    s.events = [{ id: 'h1', at: 1, kind: 'camera-move', x: 10, y: 20 }];
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.assets.rec1!.camera).toEqual({ asset: 'film1', offset: 0.1 });
    expect(parsed.assets.film1!.kind).toBe('camera');
    expect(parsed.scenes[0]!.camera).toEqual({ x: 300, y: 400, size: 'small', hidden: true });
    expect(parsed.scenes[0]!.events![0]).toMatchObject({ kind: 'camera-move', x: 10, y: 20 });
    const old = JSON.parse(JSON.stringify(newProject('B'))) as { version: number };
    old.version = 6;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(11);
  });
});
