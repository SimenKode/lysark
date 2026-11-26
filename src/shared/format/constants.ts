// Constants that code without a need for validation can import without
// pulling the validation library into its bundle (the HTML player).

/** Size of a stage in stage pixels. All element boxes are in these units. */
export interface Stage {
  readonly width: number;
  readonly height: number;
}

/** The shape of a project's slides: lying (16:9) or upright (9:16). */
export type Orientation = 'landscape' | 'portrait';

const LYING: Stage = { width: 1920, height: 1080 };
const UPRIGHT: Stage = { width: 1080, height: 1920 };

/** The stage of a shape. Code that works on a project uses `stageOf`. */
export function stageFor(orientation: Orientation): Stage {
  return orientation === 'portrait' ? UPRIGHT : LYING;
}

/** The shape of a project: upright when it says so, lying otherwise. */
export function orientationOf(project: { orientation?: 'portrait' }): Orientation {
  return project.orientation === 'portrait' ? 'portrait' : 'landscape';
}

/**
 * How large the stage of a project is: 1920 x 1080 for a lying project,
 * 1080 x 1920 for an upright one. The one place that says so.
 */
export function stageOf(project: { orientation?: 'portrait' }): Stage {
  return stageFor(orientationOf(project));
}

/** The shorter side of a stage: what sizes that must suit both shapes follow. */
export function shortSide(stage: Stage): number {
  return Math.min(stage.width, stage.height);
}
