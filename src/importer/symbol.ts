// Characters written in the Symbol font. PowerPoint stores them either as
// private-use characters (U+F020-U+F0FF, with a:sym typeface="Symbol") or
// as plain letters in a run whose typeface is Symbol. Lysark does not use
// that font, so they are turned into the Unicode characters they show,
// following the font's standard encoding.

const GREEK_UPPER = 'ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ';
const GREEK_LOWER = 'αβχδεφγηιϕκλμνοπθρστυϖωξψζ';

/** Codes of the Symbol font that differ from ASCII, and what they show. */
const SYMBOL: Record<number, string> = {
  0x22: '∀',
  0x24: '∃',
  0x27: '∋',
  0x2a: '∗',
  0x2d: '−',
  0x40: '≅',
  0x5c: '∴',
  0x5e: '⊥',
  0x7e: '∼',
  0xa2: '′',
  0xa3: '≤',
  0xa5: '∞',
  0xab: '↔',
  0xac: '←',
  0xad: '↑',
  0xae: '→',
  0xaf: '↓',
  0xb0: '°',
  0xb1: '±',
  0xb2: '″',
  0xb3: '≥',
  0xb4: '×',
  0xb5: '∝',
  0xb6: '∂',
  0xb7: '•',
  0xb8: '÷',
  0xb9: '≠',
  0xba: '≡',
  0xbb: '≈',
  0xc4: '⊗',
  0xc5: '⊕',
  0xc6: '∅',
  0xc7: '∩',
  0xc8: '∪',
  0xce: '∈',
  0xd0: '∠',
  0xd6: '√',
  0xd7: '⋅',
  0xd8: '¬',
  0xd9: '∧',
  0xda: '∨',
  0xdb: '⇔',
  0xde: '⇒',
  0xe5: '∑',
  0xf2: '∫',
};
for (let i = 0; i < 26; i++) {
  SYMBOL[0x41 + i] = GREEK_UPPER[i]!;
  SYMBOL[0x61 + i] = GREEK_LOWER[i]!;
}

/**
 * The text a run in the Symbol font shows. `wholeRun` is true when the
 * run's own typeface is Symbol, so that plain letters are symbols too;
 * otherwise only private-use characters are.
 */
export function fromSymbolFont(text: string, wholeRun: boolean): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const symbolCode =
      code >= 0xf020 && code <= 0xf0ff ? code - 0xf000 : wholeRun && code < 0x100 ? code : -1;
    out += symbolCode >= 0 ? (SYMBOL[symbolCode] ?? String.fromCharCode(symbolCode)) : ch;
  }
  return out;
}
