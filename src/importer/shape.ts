// Which shape of slide suits a file that is being imported: Lysark looks
// at the sizes of its pages (a PDF) or of its slides (a PowerPoint file)
// and recommends the shape they have. The lecturer chooses freely; this is
// only what is chosen until he says otherwise.
import type { Orientation } from '../shared/format/constants';

export interface PageSize {
  width: number;
  height: number;
}

/**
 * The shape the pages have: upright when more of them are taller than wide
 * than are wider than tall, lying otherwise (also for square pages, and
 * when there are none).
 */
export function recommendShape(pages: readonly PageSize[]): Orientation {
  let upright = 0;
  let lying = 0;
  for (const { width, height } of pages) {
    if (!(width > 0) || !(height > 0)) continue;
    if (height > width) upright += 1;
    else if (width > height) lying += 1;
  }
  return upright > lying ? 'portrait' : 'landscape';
}
