// Reading the OPC package (the zip) behind a PPTX: parts, relationships and
// path resolution.
import { unzipSync } from 'fflate';
import { attr, children, parseXml, type XmlNode } from './xml';

export interface Relationship {
  id: string;
  /** Relationship type URI. */
  type: string;
  /** Part path inside the package (no leading slash), or the URL when external. */
  target: string;
  external: boolean;
}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return bytes.length >= magic.length && magic.every((value, i) => bytes[i] === value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolves a relationship target against the part that owns the relationship. */
export function resolveTarget(sourcePart: string, target: string): string {
  const withoutFragment = target.split('#')[0] ?? '';
  const segments: string[] = [];
  if (!withoutFragment.startsWith('/')) {
    segments.push(...sourcePart.split('/').slice(0, -1));
  }
  for (const segment of withoutFragment.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
}

/** Path of the relationships part that belongs to a part ("" is the package itself). */
export function relsPartFor(part: string): string {
  const slash = part.lastIndexOf('/');
  const dir = slash < 0 ? '' : part.slice(0, slash + 1);
  const base = slash < 0 ? part : part.slice(slash + 1);
  return `${dir}_rels/${base}.rels`;
}

/** Lower-case extension of a part path, without the dot. */
export function extensionOf(part: string): string {
  const base = part.slice(part.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
}

export function baseNameOf(part: string): string {
  return part.slice(part.lastIndexOf('/') + 1);
}

export class PptxPackage {
  private readonly files: Record<string, Uint8Array>;
  /** Part names are case-insensitive in OPC. */
  private readonly names = new Map<string, string>();
  private readonly xmlCache = new Map<string, XmlNode | undefined>();
  private readonly relsCache = new Map<string, Map<string, Relationship>>();

  constructor(bytes: Uint8Array) {
    if (startsWith(bytes, OLE_MAGIC)) {
      throw new Error(
        'Fila er passordbeskyttet eller lagret i det gamle PPT-formatet. ' +
          'Lagre den som PPTX uten passord i PowerPoint og prøv igjen.',
      );
    }
    try {
      this.files = unzipSync(bytes);
    } catch {
      throw new Error('Fila er ikke en lesbar PPTX-fil.');
    }
    for (const name of Object.keys(this.files)) {
      this.names.set(name.replace(/^\/+/, '').toLowerCase(), name);
    }
  }

  private lookup(part: string): string | undefined {
    return this.names.get(part.toLowerCase()) ?? this.names.get(safeDecode(part).toLowerCase());
  }

  has(part: string): boolean {
    return this.lookup(part) !== undefined;
  }

  bytes(part: string): Uint8Array | undefined {
    const name = this.lookup(part);
    return name === undefined ? undefined : this.files[name];
  }

  /** Root element of an XML part, or undefined when the part is missing or unreadable. */
  xml(part: string): XmlNode | undefined {
    if (this.xmlCache.has(part)) return this.xmlCache.get(part);
    const data = this.bytes(part);
    const root = data ? parseXml(new TextDecoder('utf-8').decode(data)) : undefined;
    this.xmlCache.set(part, root);
    return root;
  }

  /** Relationships of a part by id. Pass "" for the package relationships. */
  rels(part: string): Map<string, Relationship> {
    const cached = this.relsCache.get(part);
    if (cached) return cached;
    const result = new Map<string, Relationship>();
    const root = this.xml(relsPartFor(part));
    const entries = [...children(root, 'rel:Relationship'), ...children(root, 'Relationship')];
    for (const rel of entries) {
      const id = attr(rel, 'Id');
      const target = attr(rel, 'Target');
      if (id === undefined || target === undefined) continue;
      const external = attr(rel, 'TargetMode') === 'External';
      result.set(id, {
        id,
        type: attr(rel, 'Type') ?? '',
        target: external ? target : resolveTarget(part, target),
        external,
      });
    }
    this.relsCache.set(part, result);
    return result;
  }

  /** First internal relationship of a part whose type ends with the given suffix. */
  relatedPart(part: string, typeSuffix: string): string | undefined {
    for (const rel of this.rels(part).values()) {
      if (!rel.external && rel.type.endsWith(typeSuffix)) return rel.target;
    }
    return undefined;
  }
}
