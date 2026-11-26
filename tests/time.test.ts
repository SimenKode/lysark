// Tests for how long a slide stands: the time of a slide without sound
// (`Scene.seconds`).
import { describe, expect, it } from 'vitest';
import { setSilentSeconds } from '../src/shared/audio/edit';
import { leastSceneLength, setSceneLength } from '../src/shared/audio/tracks';
import { newScene } from '../src/shared/format/factory';
import { FORMAT_VERSION, parseProject, type Project, type Scene } from '../src/shared/format/schema';
import {
  SILENT_SCENE_SECONDS,
  SILENT_STEP_SECONDS,
  ownsSeconds,
  schedule,
  sceneDuration,
  stepTimes,
} from '../src/shared/render/clock';
import { sampleProject } from './fixtures/sampleProject';

const id = (() => {
  let n = 0;
  return (): string => `c${++n}`;
})();

/** A slide with two steps and no sound. */
function silent(): Scene {
  const scene = newScene('content', 'A');
  scene.timeline = [
    { id: 't1', actions: [{ target: 'e_a', effect: 'fade', duration: 0.4 }] },
    { id: 't2', actions: [{ target: 'e_b', effect: 'appear', duration: 0 }] },
  ];
  return scene;
}

describe('the time of a slide without sound', () => {
  it('is the default until the lecturer sets one, and then that', () => {
    const scene = silent();
    expect(sceneDuration(scene)).toBe(SILENT_SCENE_SECONDS + 2 * SILENT_STEP_SECONDS);
    scene.seconds = 12;
    expect(sceneDuration(scene)).toBe(12);
    // Steps without a time of their own are spread over it as before.
    expect(stepTimes(scene)).toEqual([4, 8]);
    expect(schedule([scene, scene]).total).toBe(24);
  });

  it('gives way to sound, and is not obeyed on a repeat or the closing animation', () => {
    const scene = silent();
    scene.seconds = 12;
    scene.audio = { clips: [{ id: 'c', kind: 'sound', asset: 'a', from: 0, to: 3 }] };
    expect(sceneDuration(scene)).toBe(3);
    delete scene.audio;
    const repeat = { ...scene, repeat: { of: 's_x', shown: [] } };
    expect(ownsSeconds(repeat)).toBe(false);
    expect(sceneDuration(repeat)).toBe(SILENT_SCENE_SECONDS + 2 * SILENT_STEP_SECONDS);
    const closing = { ...scene, closingAnimation: { seconds: 4 } };
    expect(ownsSeconds(closing)).toBe(false);
    expect(sceneDuration(closing)).toBe(6);
  });

  it('is set within its limits, and replaces pauses put in to give the slide a length', () => {
    const scene = silent();
    scene.audio = {
      clips: [
        { id: 'p1', kind: 'pause', duration: 3 },
        { id: 'p2', kind: 'pause', duration: 4 },
      ],
    };
    expect(sceneDuration(scene)).toBe(7);
    setSilentSeconds(scene, 9.04);
    expect(scene.audio).toBeUndefined();
    expect(scene.seconds).toBe(9);
    setSilentSeconds(scene, 0.1);
    expect(scene.seconds).toBe(0.5);
    setSilentSeconds(scene, 9999);
    expect(scene.seconds).toBe(600);
    // A loudness choice on the slide is kept.
    scene.audio = { clips: [{ id: 'p', kind: 'pause', duration: 2 }], gain: 3 };
    setSilentSeconds(scene, 5);
    expect(scene.audio).toEqual({ clips: [], gain: 3 });
    expect(sceneDuration(scene)).toBe(5);
  });

  it('is not set on a slide with sound, a repeat or one with the closing animation', () => {
    const spoken = silent();
    spoken.audio = { clips: [{ id: 'c', kind: 'sound', asset: 'a', from: 0, to: 3 }] };
    setSilentSeconds(spoken, 8);
    expect(spoken.seconds).toBeUndefined();
    const repeat: Scene = { ...silent(), repeat: { of: 's_x', shown: [] } };
    setSilentSeconds(repeat, 8);
    expect(repeat.seconds).toBeUndefined();
    const closing: Scene = { ...silent(), closingAnimation: { seconds: 4 } };
    setSilentSeconds(closing, 8);
    expect(closing.seconds).toBeUndefined();
  });

  it('is what dragging the edge of a slide without sound sets', () => {
    const scene = silent();
    expect(leastSceneLength(scene)).toBe(0.5);
    setSceneLength(scene, 14, id);
    expect(scene.seconds).toBe(14);
    expect(scene.audio).toBeUndefined();
    // A slide whose only "sound" is a pause is a slide without sound.
    scene.audio = { clips: [{ id: 'p', kind: 'pause', duration: 3 }] };
    setSceneLength(scene, 6, id);
    expect(scene.audio).toBeUndefined();
    expect(sceneDuration(scene)).toBe(6);
  });

  it('is kept in a project file, checked, and older files are lifted', () => {
    const { project } = sampleProject();
    const data = JSON.parse(JSON.stringify(project)) as Project;
    data.scenes[0]!.seconds = 7.5;
    expect(parseProject(data).scenes[0]!.seconds).toBe(7.5);
    expect(parseProject({ ...data, version: 17 }).version).toBe(FORMAT_VERSION);
    data.scenes[0]!.seconds = 0.2;
    expect(() => parseProject(data)).toThrow(/seconds/);
    data.scenes[0]!.seconds = 601;
    expect(() => parseProject(data)).toThrow(/seconds/);
  });
});
