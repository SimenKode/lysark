// Chapters from the bookmarks of a PDF. PowerPoint writes one bookmark for
// each section, with the slides of the section under it; other programs
// write their chapters the same way. No pdf.js here: the interface finds
// which page each bookmark leads to and hands that in.

/** A bookmark at the top of the PDF's list, as far as chapters need to know it. */
export interface PdfBookmark {
  title: string;
  /** The page it leads to, counted from 0; undefined when it leads nowhere in the file. */
  page?: number;
  /** The pages the bookmarks under it lead to. */
  children: Array<number | undefined>;
}

/**
 * Which pages begin a chapter, and what the chapters are called. A bookmark
 * that leads nowhere itself begins where the first one under it leads.
 *
 * A PDF with fewer than two bookmarks is not divided into anything. Neither
 * is one where the bookmarks are a plain list with about one for every
 * page: that is a list of the pages, not of chapters.
 */
export function pdfChapters(bookmarks: readonly PdfBookmark[], pages: number): Map<number, string> {
  const chapters = new Map<number, string>();
  const nested = bookmarks.some((bookmark) => bookmark.children.length > 0);
  if (bookmarks.length < 2 || (!nested && bookmarks.length > pages / 2)) return chapters;
  for (const bookmark of bookmarks) {
    const page = bookmark.page ?? bookmark.children.find((child) => child !== undefined);
    if (page === undefined || page < 0 || page >= pages || chapters.has(page)) continue;
    chapters.set(page, bookmark.title.replace(/\s+/g, ' ').trim());
  }
  return chapters.size < 2 ? new Map() : chapters;
}
