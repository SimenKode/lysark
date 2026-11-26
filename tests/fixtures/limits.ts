// How long the tests that export a video wait for it. One export takes 30 to
// 90 s when it runs alone; when the whole suite runs, other files start the
// program beside it and the machine is busy, and it can take several times
// that (on 26.11.2026 e2e-events.test.ts went over 150 s three times in
// whole-suite runs and passed alone each time). The limits are wide enough
// for that; what the tests check is unchanged.

/** How long a test waits for «Videoen er lagret» (or the GIF). */
export const EXPORT_WAIT = 420_000;
/** The time limit of a test that exports one video: the wait, and room for the rest of the test. */
export const EXPORT_TEST = EXPORT_WAIT + 180_000;
