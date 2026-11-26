// Tests for how long a slide stands: the time of a slide without sound
// (`Scene.seconds`), and slides left out of the video (`Scene.skip`).
import { describe, expect, it } from 'vitest';
import { setSilentSeconds } from '../src/shared/audio/edit';
import { applyRecording, type Take } from '../src/shared/audio/session';
import { chapterMarks, lectureCues } from '../src/shared/render/captions';
import { leastSceneLength, setSceneLength } from '../src/shared/audio/tracks';
import { newProject, newScene } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Project,
  type Scene,
} from '../src/shared/format/schema';
import {
  SILENT_SCENE_SECONDS,
  SILENT_STEP_SECONDS,
  anchorAt,
  cameraAt,
  frameAt,
  ownsSeconds,
  placeTracks,
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

describe('a slide left out of the video', () => {
  /** Slides A to D of 2, 3, 4 and 5 seconds, without sound. */
  function four(): Scene[] {
    return ['A', 'B', 'C', 'D'].map((name, index) => {
      const scene = newScene('content', name);
      scene.id = `s_${name}`;
      scene.seconds = index + 2;
      return scene;
    });
  }

  it('takes no time, and is never what is on screen', () => {
    const scenes = four();
    scenes[1]!.skip = true;
    const plan = schedule(scenes);
    expect(plan.total).toBe(2 + 4 + 5);
    expect(plan.entries.map((e) => [e.start, e.duration])).toEqual([
      [0, 2],
      [2, 0],
      [2, 4],
      [6, 5],
    ]);
    expect(frameAt(plan, 1.9, 'cut').index).toBe(0);
    expect(frameAt(plan, 2, 'cut').index).toBe(2);
    // A fade comes from the slide shown before, not from the one left out.
    expect(frameAt(plan, 2.1, 'fade').fade?.from).toBe(0);
    // After the end, the last slide that is in.
    scenes[3]!.skip = true;
    const shorter = schedule(scenes);
    expect(frameAt(shorter, 99, 'cut').index).toBe(2);
    expect(anchorAt(scenes, shorter, 99)?.scene).toBe('s_C');
  });

  it('starts a chapter that begins on it on the next slide that is in, and drops a chapter with nothing in', () => {
    const scenes = four();
    scenes[1]!.chapter = 'K1';
    scenes[1]!.skip = true;
    scenes[3]!.chapter = 'K2';
    const plan = schedule(scenes);
    expect(chapterMarks(scenes, plan, 0, 3, { lecture: 'L' })).toEqual([
      { title: 'L', start: 0, end: 2 },
      { title: 'K1', start: 2, end: 6 },
      { title: 'K2', start: 6, end: 11 },
    ]);
    scenes[2]!.skip = true;
    const none = schedule(scenes);
    expect(chapterMarks(scenes, none, 0, 3, { lecture: 'L' }).map((m) => m.title)).toEqual([
      'L',
      'K2',
    ]);
  });

  it('says nothing in the captions, lets music fastened to it start where the next slide does, and keeps the circle gliding from the slide shown before', () => {
    const scenes = four();
    scenes[1]!.skip = true;
    scenes[1]!.script = 'A B';
    scenes[1]!.audio = { clips: [{ id: 'c', kind: 'sound', asset: 'a_rec', from: 0, to: 3 }] };
    const plan = schedule(scenes);
    expect(lectureCues(scenes, plan)).toEqual([]);
    const placed = placeTracks({
      scenes,
      tracks: {
        music: [{ id: 'k', asset: 'm', scene: 's_B', offset: 0, from: 0, to: 1 }],
        sound: [],
      },
    });
    expect(placed[0]!.start).toBe(2);
    // The circle on C glides from where it stood at the end of A, not of B.
    const assets = {
      a_rec: {
        kind: 'audio' as const,
        file: 'media/a.wav',
        mime: 'audio/wav',
        bytes: 1,
        camera: { asset: 'f', offset: 0 },
      },
      f: { kind: 'camera' as const, file: 'media/f.webm', mime: 'video/webm', bytes: 1 },
    };
    for (const scene of scenes) {
      scene.audio = {
        clips: [{ id: `c${scene.id}`, kind: 'sound', asset: 'a_rec', from: 0, to: 2 }],
      };
    }
    scenes[0]!.camera = { x: 300, y: 300, size: 'medium' };
    scenes[1]!.camera = { x: 900, y: 900, size: 'medium' };
    scenes[2]!.camera = { x: 600, y: 600, size: 'medium' };
    const start = cameraAt(scenes, assets, 2, 0)!;
    expect([start.x, start.y]).toEqual([300, 300]);
  });

  it('is what a recording that jumps forward over slides without sound makes of them', () => {
    const project = newProject('Test');
    project.scenes.push(...four(), ...four().map((s) => ({ ...s, id: `${s.id}2` })));
    // The second slide already has sound, and is not touched; a slide before the start neither.
    project.scenes[3]!.audio = {
      clips: [{ id: 'c', kind: 'sound', asset: 'a_old', from: 0, to: 1 }],
    };
    project.scenes[6]!.skip = true;
    project.scenes[7]!.skip = true;
    let n = 0;
    const take = (scene: string): Take => ({
      scene,
      asset: `rec_${scene}`,
      seconds: 2,
      shown: [],
      stepAts: {},
      events: [],
    });
    // Starts on B, jumps to E (over C and D), then on to H (over F and G).
    const applied = applyRecording(
      project,
      [take('s_B'), take('s_A2'), take('s_D2')],
      (prefix) => `${prefix}_${++n}`,
    );
    expect(applied.left).toEqual(['s_C', 's_B2']);
    expect(project.scenes.map((s) => s.skip ?? false)).toEqual([
      false, // A: before the start
      false, // B: read in
      true, // C: jumped over, no sound
      false, // D: jumped over, but has sound
      false, // E: read in
      true, // F: jumped over
      true, // G: was left out already, and stays so (not said again)
      false, // H: was left out, and is taken in again by the sound it got
    ]);
  });
});
