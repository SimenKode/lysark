// Constants that code without a need for validation can import without
// pulling the validation library into its bundle (the HTML player).

/** Logical stage size. All element boxes are in these units. */
export const STAGE = { width: 1920, height: 1080 } as const;
