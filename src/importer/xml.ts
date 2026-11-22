// A small ordered XML tree on top of fast-xml-parser. Element and attribute
// names are rewritten to the conventional OOXML prefixes (a:, p:, r:, ...)
// by namespace, so the rest of the importer can match on fixed names even
// when a file declares the namespaces under other prefixes.
import { XMLParser } from 'fast-xml-parser';

export interface XmlNode {
  /** Canonical qualified name, e.g. "p:sp". */
  name: string;
  attrs: Record<string, string>;
  /** Child elements in document order. */
  children: XmlNode[];
  /** Concatenated character data directly inside the element. */
  text: string;
}

const CANONICAL_PREFIX: Record<string, string> = {
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
  'http://purl.oclc.org/ooxml/drawingml/main': 'a',
  'http://schemas.openxmlformats.org/presentationml/2006/main': 'p',
  'http://purl.oclc.org/ooxml/presentationml/main': 'p',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
  'http://purl.oclc.org/ooxml/officeDocument/relationships': 'r',
  'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
  'http://schemas.microsoft.com/office/powerpoint/2010/main': 'p14',
  'http://schemas.microsoft.com/office/drawing/2010/main': 'a14',
  'http://schemas.microsoft.com/office/drawing/2017/decorative': 'adec',
  'http://schemas.openxmlformats.org/package/2006/relationships': 'rel',
  'http://schemas.openxmlformats.org/package/2006/metadata/core-properties': 'cp',
  'http://purl.org/dc/elements/1.1/': 'dc',
};

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  // Entities are decoded below, so that numeric references work as well.
  processEntities: false,
  cdataPropName: '#cdata',
  ignoreDeclaration: true,
  ignorePiTags: true,
  maxNestedTags: 1000,
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

type RawNode = Record<string, unknown>;
type Scope = Map<string, string>;

function canonicalName(qualified: string, scope: Scope, isAttribute: boolean): string {
  const colon = qualified.indexOf(':');
  // Attributes without a prefix are in no namespace.
  if (colon < 0 && isAttribute) return qualified;
  const prefix = colon < 0 ? '' : qualified.slice(0, colon);
  const local = colon < 0 ? qualified : qualified.slice(colon + 1);
  const uri = scope.get(prefix);
  const canonical = uri === undefined ? undefined : CANONICAL_PREFIX[uri];
  return canonical ? `${canonical}:${local}` : qualified;
}

function rawText(items: unknown): string {
  if (!Array.isArray(items)) return '';
  let out = '';
  for (const item of items as RawNode[]) {
    const value = item['#text'];
    if (typeof value === 'string') out += value;
    else if (typeof value === 'number' || typeof value === 'boolean') out += String(value);
  }
  return out;
}

function convert(raw: RawNode, parentScope: Scope): XmlNode | undefined {
  const tag = Object.keys(raw).find((key) => key !== ':@');
  if (!tag || tag.startsWith('#') || tag.startsWith('?')) return undefined;

  const rawAttrs = (raw[':@'] ?? {}) as Record<string, unknown>;
  let scope = parentScope;
  for (const [key, value] of Object.entries(rawAttrs)) {
    if (key === '@_xmlns' || key.startsWith('@_xmlns:')) {
      if (scope === parentScope) scope = new Map(parentScope);
      scope.set(key === '@_xmlns' ? '' : key.slice('@_xmlns:'.length), String(value));
    }
  }

  const attrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawAttrs)) {
    if (!key.startsWith('@_')) continue;
    const qualified = key.slice(2);
    if (qualified === 'xmlns' || qualified.startsWith('xmlns:')) continue;
    attrs[canonicalName(qualified, scope, true)] = decodeEntities(String(value));
  }

  const node: XmlNode = { name: canonicalName(tag, scope, false), attrs, children: [], text: '' };
  const content = raw[tag];
  if (Array.isArray(content)) {
    for (const item of content as RawNode[]) {
      if ('#text' in item) {
        node.text += decodeEntities(String(item['#text']));
      } else if ('#cdata' in item) {
        node.text += rawText(item['#cdata']);
      } else {
        const childNode = convert(item, scope);
        if (childNode) node.children.push(childNode);
      }
    }
  }
  return node;
}

/** Parses a document and returns its root element, or undefined when there is none. */
export function parseXml(source: string): XmlNode | undefined {
  let parsed: unknown;
  try {
    parsed = parser.parse(source);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  for (const item of parsed as RawNode[]) {
    const node = convert(item, new Map());
    if (node) return node;
  }
  return undefined;
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node ? node.children.filter((c) => c.name === name) : [];
}

/** Follows a path of child names from a node. */
export function descend(node: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let current = node;
  for (const name of names) {
    current = child(current, name);
    if (!current) return undefined;
  }
  return current;
}

export function attr(node: XmlNode | undefined, name: string): string | undefined {
  return node?.attrs[name];
}

/** Integer attribute, or undefined when missing or not a number. */
export function intAttr(node: XmlNode | undefined, name: string): number | undefined {
  const value = attr(node, name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** OOXML booleans are written as 1/0 or true/false. */
export function boolAttr(node: XmlNode | undefined, name: string): boolean {
  const value = attr(node, name);
  return value === '1' || value === 'true';
}

/** First descendant (depth first, document order) with one of the given names. */
export function findDescendant(
  node: XmlNode | undefined,
  names: ReadonlySet<string>,
): XmlNode | undefined {
  if (!node) return undefined;
  for (const c of node.children) {
    if (names.has(c.name)) return c;
    const found = findDescendant(c, names);
    if (found) return found;
  }
  return undefined;
}
