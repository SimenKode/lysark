// Limits shared by the editor and the exporter.

/** Videos up to this size are written into the exported HTML file itself. */
export const INLINE_VIDEO_LIMIT_BYTES = 20 * 1024 * 1024;

/**
 * A picture fetched from a source that hands out pictures in their full
 * size (Openverse) is scaled down to this width when it is wider: the
 * stage is this wide, and the exported HTML file carries every picture.
 */
export const FETCHED_PICTURE_MAX_WIDTH = 1920;
/** The largest picture the main process will take in from the web or from the interface. */
export const FETCHED_PICTURE_LIMIT_BYTES = 40 * 1024 * 1024;

/** A PDF larger than this is not read; it would not fit in the memory the import needs. */
export const PDF_LIMIT_BYTES = 300 * 1024 * 1024;

/**
 * The largest picture of one PDF page the main process will store. A page is
 * at most 3840 x 2160 pixels, which is about 33 MB before any compression.
 */
export const PDF_PAGE_LIMIT_BYTES = 40 * 1024 * 1024;
