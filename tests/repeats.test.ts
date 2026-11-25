// A recording is a film of what the lecturer did: slides are shown in the
// order they were shown, and a slide the lecturer came back to is shown once
// more. Here: how a recording is put into the lecture, how the clock treats
// steps that were already there or never came, how a repeat follows its
// slide, how slides are counted, and chapters. No window is used.
import { describe, expect, it } from 'vitest';
import { applyRecording, type Take } from '../src/shared/audio/session';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Asset,
  type Project,
  type Scene,
} from '../src/shared/format/schema';
import { followRepeats, handOnChapter } from '../src/shared/layout/repeats';
import {
  chapters,
  ownIndex,
  slideCount,
  slideNumbers,
  slideSpan,
} from '../src/shared/layout/slides';
import {
  cameraAt,
  schedule,
  sceneDuration,
  sceneStateAt,
  stepTimes,
  stepsShownAt,
  stepsShownBefore,
} from '../src/shared/render/clock';
import { chapterMarks, toFfmetadata } from '../src/shared/render/captions';
import { collectCredits } from '../src/shared/render/more';

const wav: Asset = { kind: 'audio', file: 'media/a.wav', mime: 'audio/wav', bytes: 1 };

/** A slide with a title and as many steps as asked for, each bringing in one text. */
function slide(name: string, steps = 0): Scene {
  const scene = newScene('content', `Lysark ${name}`);
  scene.id = `s_${name}`;
  for (let i = 1; i <= steps; i++) {
    const id = `e_${name}${i}`;
    scene.elements.push({
      id,
      type: 'text',
      role: 'body',
      content: richText(`${name}${i}`),
      align: 'left',
      valign: 'top',
      box: { x: 100, y: 100 * i, w: 600, h: 80, rotation: 0 },
    });
    scene.timeline.push({
      id: `t_${name}${i}`,
      actions: [{ target: id, effect: 'fade', duration: 0.4 }],
    });
  }
  return scene;
}

function lecture(...scenes: Scene[]): Project {
  const project = newProject('Test');
  project.scenes.push(...scenes);
  return project;
}

/** Ids that count up, so a test can say what it expects. */
function counter(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}

function take(scene: string, seconds: number, more: Partial<Take> = {}): Take {
  return { scene, asset: `rec_${scene}`, seconds, shown: [], stepAts: {}, events: [], ...more };
}

const names = (project: Project): string[] =>
  project.scenes.map((s) => (s.repeat ? `${s.repeat.of}*` : s.id));

describe('putting a recording into the lecture', () => {
  it('gives each slide its sound when the lecturer only goes forward', () => {
    const project = lecture(slide('A', 2), slide('B'), slide('C'));
    const applied = applyRecording(
      project,
      [take('s_A', 6, { stepAts: { t_A1: 1, t_A2: 4 } }), take('s_B', 3), take('s_C', 2)],
      counter(),
    );
    expect(applied).toEqual({ slides: 3, repeats: 0, last: 's_C' });
    expect(names(project)).toEqual(['s_A', 's_B', 's_C']);
    expect(project.scenes[0]!.timeline.map((s) => s.at)).toEqual([1, 4]);
    expect(project.scenes.map(sceneDuration)).toEqual([6, 3, 2]);
  });

  it('shows a slide once more where the lecturer went back to it', () => {
    const project = lecture(slide('A', 2), slide('B'), slide('C'));
    const applied = applyRecording(
      project,
      [
        take('s_A', 6, { stepAts: { t_A1: 1, t_A2: 4 } }),
        take('s_B', 3),
        // Back to A, where both steps were shown, and then straight on to C.
        take('s_A', 5, { shown: ['t_A1', 't_A2'] }),
        take('s_C', 2),
      ],
      counter(),
    );
    expect(applied.slides).toBe(3);
    expect(applied.repeats).toBe(1);
    expect(names(project)).toEqual(['s_A', 's_B', 's_A*', 's_C']);
    const again = project.scenes[2]!;
    expect(again.repeat).toEqual({ of: 's_A', shown: ['t_A1', 't_A2'] });
    expect(again.elements).toBe(project.scenes[0]!.elements);
    expect(again.title).toBe('Lysark A');
    expect(sceneDuration(again)).toBe(5);
    // The slide itself keeps the sound of the first time it was shown.
    expect(sceneDuration(project.scenes[0]!)).toBe(6);
    expect(schedule(project.scenes).total).toBe(16);
  });

  it('makes going back one step a showing of its own, with one step fewer', () => {
    const project = lecture(slide('A', 2));
    applyRecording(
      project,
      [
        take('s_A', 6, { stepAts: { t_A1: 1, t_A2: 4 } }),
        // Back one step, and then the step again.
        take('s_A', 4, { shown: ['t_A1'], stepAts: { t_A2: 3 } }),
      ],
      counter(),
    );
    expect(names(project)).toEqual(['s_A', 's_A*']);
    const again = project.scenes[1]!;
    expect(stepsShownBefore(again)).toBe(1);
    expect(stepsShownAt(again, 0)).toBe(1);
    expect(stepsShownAt(again, 3.5)).toBe(2);
  });

  it('does not show a step the lecturer never came to', () => {
    const project = lecture(slide('A', 3), slide('B'));
    applyRecording(
      project,
      [
        take('s_A', 6, { stepAts: { t_A1: 2 } }),
        take('s_B', 2),
        take('s_A', 3, { shown: ['t_A1'] }),
      ],
      counter(),
    );
    const [first, , again] = project.scenes;
    expect(stepsShownAt(first!, 5.99)).toBe(1);
    // Also at the very end, where a fade to the next slide draws it.
    expect(stepsShownAt(first!, 6)).toBe(1);
    expect(sceneStateAt(first!, 6).get('e_A2')).toBe(0);
    expect(stepsShownAt(again!, 2.9)).toBe(1);
    expect(sceneStateAt(again!, 0).get('e_A1')).toBe(1);
    expect(sceneStateAt(again!, 2.9).get('e_A2')).toBe(0);
    // In the sound panel the steps stand at the start and at the end.
    expect(stepTimes(again!)).toEqual([0, 3, 3]);
  });

  it('counts a slide the lecturer jumped ahead to as that slide, and what comes after as going back', () => {
    const project = lecture(slide('A'), slide('B'), slide('C'), slide('D'));
    // A, then a jump to C, back to B, and on to D.
    applyRecording(
      project,
      [take('s_A', 2), take('s_C', 3), take('s_B', 4), take('s_D', 1)],
      counter(),
    );
    expect(names(project)).toEqual(['s_A', 's_B', 's_C', 's_B*', 's_D']);
    // B itself was never shown before C: it keeps what it had, here nothing.
    expect(project.scenes[1]!.audio).toBeUndefined();
  });

  it('takes away old repeats after a slide the new recording went on from, and keeps those after its last slide', () => {
    const project = lecture(slide('A'), slide('B'), slide('C'));
    const ids = counter();
    applyRecording(project, [take('s_A', 2), take('s_B', 2), take('s_A', 2), take('s_C', 2)], ids);
    applyRecording(project, [take('s_C', 2), take('s_B', 2)], ids);
    expect(names(project)).toEqual(['s_A', 's_B', 's_A*', 's_C', 's_B*']);
    // Read anew from B and on to C: what followed B then, is gone; what follows C stays.
    applyRecording(project, [take('s_B', 5), take('s_C', 6)], ids);
    expect(names(project)).toEqual(['s_A', 's_B', 's_C', 's_B*']);
    expect(sceneDuration(project.scenes[1]!)).toBe(5);
    expect(sceneDuration(project.scenes[2]!)).toBe(6);
  });

  it('goes on from a point in the sound a slide has, and keeps what was before it', () => {
    const project = lecture(slide('A', 2), slide('B'));
    const ids = counter();
    applyRecording(project, [take('s_A', 6, { stepAts: { t_A1: 1, t_A2: 4 } })], ids);
    applyRecording(
      project,
      [
        take('s_A', 3, {
          asset: 'rec_new',
          keepBefore: 2,
          shown: ['t_A1'],
          stepAts: { t_A2: 1.5 },
        }),
      ],
      ids,
    );
    const scene = project.scenes[0]!;
    expect(sceneDuration(scene)).toBe(5);
    expect(scene.timeline.map((s) => s.at)).toEqual([1, 3.5]);
  });

  it('gives the camera circle its place on the slide and on the repeat', () => {
    const project = lecture(slide('A'), slide('B'));
    project.assets.film = {
      kind: 'camera',
      file: 'media/kamera-a.mp4',
      mime: 'video/mp4',
      bytes: 1,
    };
    // One film for the whole recording: each stretch says where in it it began.
    project.assets.rec1 = { ...wav, camera: { asset: 'film', offset: 0 } };
    project.assets.rec2 = { ...wav, camera: { asset: 'film', offset: -4 } };
    project.assets.rec3 = { ...wav, camera: { asset: 'film', offset: -6 } };
    applyRecording(
      project,
      [
        take('s_A', 4, { asset: 'rec1', camera: { x: 300, y: 800, size: 'medium' } }),
        take('s_B', 2, { asset: 'rec2', camera: { x: 300, y: 800, size: 'medium' } }),
        take('s_A', 3, { asset: 'rec3', camera: { x: 1500, y: 300, size: 'medium' } }),
      ],
      counter(),
    );
    expect(project.scenes[2]!.camera).toEqual({ x: 1500, y: 300, size: 'medium' });
    // The film runs on from slide to slide: one second into the repeat is seven seconds into it.
    expect(cameraAt(project.scenes, project.assets, 0, 1)).toMatchObject({
      asset: 'film',
      time: 1,
    });
    expect(cameraAt(project.scenes, project.assets, 1, 1)).toMatchObject({
      asset: 'film',
      time: 5,
    });
    expect(cameraAt(project.scenes, project.assets, 2, 1)).toMatchObject({
      asset: 'film',
      time: 7,
    });
  });
});

describe('a repeat follows its slide', () => {
  const recorded = (): Project => {
    const project = lecture(slide('A', 2), slide('B'));
    applyRecording(
      project,
      [
        take('s_A', 6, { stepAts: { t_A1: 1, t_A2: 4 } }),
        take('s_B', 2),
        take('s_A', 3, { shown: ['t_A1'], stepAts: { t_A2: 2 } }),
      ],
      counter(),
    );
    return project;
  };

  it('leaves a lecture alone when nothing has changed', () => {
    const project = recorded();
    expect(followRepeats(project)).toBe(project);
    const plain = lecture(slide('A'));
    expect(followRepeats(plain)).toBe(plain);
  });

  it('shows what the slide shows after the slide was changed, and keeps its own times', () => {
    const project = recorded();
    const a = project.scenes[0]!;
    const changed: Project = {
      ...project,
      scenes: [
        { ...a, title: 'Nytt navn', elements: [...a.elements], showLogo: false },
        ...project.scenes.slice(1),
      ],
    };
    const next = followRepeats(changed);
    expect(next).not.toBe(changed);
    const again = next.scenes[2]!;
    expect(again.elements).toBe(next.scenes[0]!.elements);
    expect(again.title).toBe('Nytt navn');
    expect(again.showLogo).toBe(false);
    expect(again.timeline.map((s) => s.at)).toEqual([undefined, 2]);
    expect(sceneDuration(again)).toBe(3);
    // The lecture that was handed in is not touched.
    expect(changed.scenes[2]!.title).toBe('Lysark A');
  });

  it('treats a step made after the recording as one that was there', () => {
    const project = recorded();
    const a = project.scenes[0]!;
    const withStep: Project = {
      ...project,
      scenes: [
        { ...a, timeline: [...a.timeline, { id: 't_new', actions: [] }] },
        ...project.scenes.slice(1),
      ],
    };
    const again = followRepeats(withStep).scenes[2]!;
    expect(again.repeat!.shown).toEqual(['t_A1', 't_new']);
    expect(again.timeline.map((s) => s.id)).toEqual(['t_A1', 't_A2', 't_new']);
  });

  it('goes away with its slide, and music fastened to it moves on', () => {
    const project = recorded();
    project.assets.music = wav;
    project.tracks = {
      music: [{ id: 'm', asset: 'music', scene: project.scenes[2]!.id, offset: 1, from: 0, to: 4 }],
      sound: [],
    };
    const without: Project = { ...project, scenes: project.scenes.slice(1) };
    const next = followRepeats(without);
    expect(names(next)).toEqual(['s_B']);
    expect(next.tracks!.music[0]).toMatchObject({ scene: 's_B' });
    expect(without.tracks!.music[0]!.scene).toBe(project.scenes[2]!.id);
  });
});

describe('counting slides', () => {
  const project = (): Project => {
    const made = lecture(slide('A'), slide('B'), slide('C'));
    applyRecording(
      made,
      [take('s_A', 2), take('s_B', 2), take('s_A', 2), take('s_C', 2), take('s_B', 2)],
      counter(),
    );
    return made;
  };

  it('gives a repeat the number of the slide it shows', () => {
    const { scenes } = project();
    expect(names({ scenes } as Project)).toEqual(['s_A', 's_B', 's_A*', 's_C', 's_B*']);
    expect(slideNumbers(scenes)).toEqual([1, 2, 1, 3, 2]);
    expect(slideCount(scenes)).toBe(3);
    expect(ownIndex(scenes, 2)).toBe(0);
    expect(ownIndex(scenes, 3)).toBe(3);
  });

  it('finds the stretch that holds slides by their numbers, repeats after the last one included', () => {
    const { scenes } = project();
    expect(slideSpan(scenes, 1, 1)).toEqual([0, 0]);
    expect(slideSpan(scenes, 2, 2)).toEqual([1, 2]);
    expect(slideSpan(scenes, 2, 3)).toEqual([1, 4]);
    expect(slideSpan(scenes, 1, 3)).toEqual([0, 4]);
    expect(slideSpan(scenes, 4, 4)).toBeUndefined();
    expect(slideSpan(scenes, 3, 2)).toBeUndefined();
  });

  it('credits a picture on the slide it stands on, once', () => {
    const made = project();
    made.assets.pic = {
      kind: 'image',
      file: 'media/a.png',
      mime: 'image/png',
      bytes: 1,
      credit: { author: 'A', license: 'CC BY 4.0', required: true },
    };
    made.scenes[0]!.elements.push({
      id: 'e_pic',
      type: 'image',
      asset: 'pic',
      alt: '',
      box: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    });
    const followed = followRepeats(made);
    expect(collectCredits(followed).map((c) => c.scenes)).toEqual([[1]]);
  });
});

describe('chapters', () => {
  it('begin on the slide that names them and run to the next one', () => {
    const [a, b, c, d] = [slide('A'), slide('B'), slide('C'), slide('D')];
    expect(chapters([a, b, c, d])).toEqual([]);
    b.chapter = 'En';
    d.chapter = 'To';
    expect(chapters([a, b, c, d])).toEqual([
      { name: '', first: 0, last: 0 },
      { name: 'En', first: 1, last: 2 },
      { name: 'To', first: 3, last: 3 },
    ]);
  });

  it('become the chapters of a video, also of a video of some of the slides', () => {
    const [a, b, c, d] = [slide('A'), slide('B'), slide('C'), slide('D')];
    b.chapter = 'En';
    d.chapter = 'To; = #1';
    const scenes = [a, b, c, d];
    // Each slide stands five seconds.
    const all = chapterMarks(scenes, schedule(scenes), 0, 3, { lecture: 'Test' });
    expect(all).toEqual([
      { title: 'Test', start: 0, end: 5 },
      { title: 'En', start: 5, end: 15 },
      { title: 'To; = #1', start: 15, end: 20 },
    ]);
    // From the middle of a chapter: it starts with that chapter.
    const some = scenes.slice(2);
    expect(chapterMarks(scenes, schedule(some), 2, 3, { lecture: 'Test' })).toEqual([
      { title: 'En', start: 0, end: 5 },
      { title: 'To; = #1', start: 5, end: 10 },
    ]);
    // A video inside one chapter has no chapters, and neither has a lecture without any.
    expect(chapterMarks(scenes, schedule([b, c]), 1, 2, { lecture: 'Test' })).toEqual([]);
    expect(chapterMarks([slide('A')], schedule([a]), 0, 0, { lecture: 'Test' })).toEqual([]);
    // Picture credits after the last slide are a chapter of their own.
    const withCredits = { entries: schedule(scenes).entries, total: 28 };
    expect(
      chapterMarks(scenes, withCredits, 0, 3, { lecture: 'Test', credits: 'Bildekilder' }).at(-1),
    ).toEqual({ title: 'Bildekilder', start: 20, end: 28 });
    expect(toFfmetadata(all)).toBe(
      ';FFMETADATA1\n' +
        '[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=5000\ntitle=Test\n' +
        '[CHAPTER]\nTIMEBASE=1/1000\nSTART=5000\nEND=15000\ntitle=En\n' +
        '[CHAPTER]\nTIMEBASE=1/1000\nSTART=15000\nEND=20000\ntitle=To\\; \\= \\#1\n',
    );
  });

  it('move to the next slide when the slide they begin on is removed', () => {
    const [a, b, c] = [slide('A'), slide('B'), slide('C')];
    a.chapter = 'En';
    const scenes = [a, b, c];
    handOnChapter(scenes, 0);
    expect(b.chapter).toBe('En');
    // A slide that begins a chapter itself keeps its own.
    c.chapter = 'To';
    handOnChapter(scenes, 1);
    expect(c.chapter).toBe('To');
  });
});

describe('the format', () => {
  it('carries repeats and chapters, and reads older projects', () => {
    const project = lecture(slide('A', 1), slide('B'));
    project.scenes[0]!.chapter = 'En';
    applyRecording(
      project,
      [
        take('s_A', 2, { stepAts: { t_A1: 1 } }),
        take('s_B', 2),
        take('s_A', 2, { shown: ['t_A1'] }),
      ],
      counter(),
    );
    project.assets.rec_s_A = wav;
    project.assets.rec_s_B = wav;
    const read = parseProject(JSON.parse(JSON.stringify(project)));
    expect(read.scenes[2]!.repeat).toEqual({ of: 's_A', shown: ['t_A1'] });
    expect(read.scenes[0]!.chapter).toBe('En');
    const old = { ...JSON.parse(JSON.stringify(lecture(slide('A')))), version: 8 };
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(9);
  });
});
