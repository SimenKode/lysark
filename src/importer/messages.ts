// The warnings an import can give. The texts are Norwegian bokmål, written
// for the lecturer who reads the import report.
import type { ImportWarning } from '../shared/format/schema';

function formatName(extension: string): string {
  return extension ? `formatet ${extension.toUpperCase()}` : 'et ukjent format';
}

export const WARNINGS = {
  hidden: (): ImportWarning => ({
    code: 'hidden',
    message: 'Lysbildet var skjult i PowerPoint. Slett scenen hvis den ikke skal være med.',
  }),
  animation: (): ImportWarning => ({
    code: 'animation',
    message: 'Animasjonene fra PowerPoint følger ikke med. Bruk steg i stedet.',
  }),
  background: (): ImportWarning => ({
    code: 'background',
    message: 'Bakgrunnsbildet på lysbildet følger ikke med. Temaet bestemmer bakgrunnen.',
  }),
  geometry: (): ImportWarning => ({
    code: 'geometry',
    message: 'Noen former er forenklet til rektangler.',
  }),
  smartart: (asPicture: boolean): ImportWarning => ({
    code: 'smartart',
    message: asPicture
      ? 'SmartArt-figuren er tatt med som et bilde. Lag den på nytt hvis den skal kunne endres.'
      : 'SmartArt-figuren følger ikke med og må lages på nytt.',
  }),
  chart: (asPicture: boolean): ImportWarning => ({
    code: 'chart',
    message: asPicture
      ? 'Diagrammet er tatt med som et bilde. Lag det på nytt hvis det skal kunne endres.'
      : 'Diagrammet følger ikke med og må lages på nytt.',
  }),
  embeddedObject: (asPicture: boolean): ImportWarning => ({
    code: 'embedded-object',
    message: asPicture
      ? 'Et innebygd objekt er tatt med som et bilde og kan ikke endres.'
      : 'Et innebygd objekt følger ikke med og må settes inn på nytt.',
  }),
  imageFormat: (extension: string): ImportWarning => ({
    code: 'image-format',
    message:
      `Et bilde i ${formatName(extension)} kan ikke vises og følger ikke med. ` +
      'Lagre det som PNG i PowerPoint og sett det inn på nytt.',
  }),
  imageMissing: (): ImportWarning => ({
    code: 'other',
    message: 'Et bilde mangler i fila og følger ikke med.',
  }),
  imageLinked: (): ImportWarning => ({
    code: 'other',
    message: 'Et bilde som er lenket til en fil utenfor presentasjonen, følger ikke med.',
  }),
  audio: (): ImportWarning => ({
    code: 'media',
    message: 'Lyd fra PowerPoint følger ikke med.',
  }),
  videoFormat: (extension: string): ImportWarning => ({
    code: 'media',
    message:
      `En video i ${formatName(extension)} kan ikke spilles av og følger ikke med. ` +
      'Lagre den som MP4 og sett den inn på nytt.',
  }),
  videoLinked: (): ImportWarning => ({
    code: 'media',
    message: 'En video som er lenket til en fil utenfor presentasjonen, følger ikke med.',
  }),
  noPosition: (): ImportWarning => ({
    code: 'other',
    message: 'Et tekstfelt manglet plassering og er lagt over hele lysbildet.',
  }),
  unreadableSlide: (): ImportWarning => ({
    code: 'other',
    message: 'Lysbildet kunne ikke leses og er tomt.',
  }),
};
