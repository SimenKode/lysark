# Prosjektformatet

Ett format leses av redigeringsprogrammet, HTML-spilleren og
videoeksporten. Den bindende beskrivelsen er koden i
`src/shared/format/schema.ts`, som også kontrollerer hver prosjektfil når
den åpnes og lagres. Denne fila forklarer tankegangen. Formatet har
versjonsnummer (nå 1), slik at eldre prosjekter kan løftes automatisk
når det endres.

## Tre prinsipper

1. **Innhold og stil er adskilt.** Et element sier «jeg er en tittel» og
   «jeg bruker serie 1», ikke «36 pt Times, #7800f0». Temaet oversetter
   roller til skrift, farge og strek. Bytte fra ren til håndlaget stil
   endrer derfor ingenting i innholdet.
2. **Tidslinja består av steg.** Et steg er «nå kommer dette inn». I HTML
   går man til neste steg med tastetrykk. I video har hvert steg et
   tidspunkt, satt med tastetrykket under innspilling. Samme steg, to
   måter å gå gjennom dem på.
3. **Bildet er en ren funksjon av (prosjekt, tema, tid).** Ingenting i
   formatet er avhengig av klokka, tilfeldighet eller nett.

## På disk

```
MinForelesning/
  prosjekt.json        innholdet (under)
  media/               bilder, lyd, video; filnavn etter innholdets sjekksum
```

Et prosjekt er en mappe (valgt i spørsmål 15). «Pakk prosjektet til én
fil» i Fil-menyen lager en zip av mappa for flytting og arkivering, og
«Åpne pakket prosjekt» pakker den ut igjen.

## Oppbygging

Skissen under viser hovedtrekkene slik de ble tegnet før byggingen.
Noen detaljer ble enklere i den ferdige koden: formatet heter `lysark`,
tekst er avsnitt med nivå og listetype, farger på elementer er navn fra
profilpaletten, og hver scene har egne valg for profilformer og logo.
Diagrammaler og lyd legges til i leveranse 2 og 3.

```ts
interface Project {
  format: 'forelesning';
  version: 1;
  meta: { title: string; course?: string; author?: string; language: 'nb' | 'en' };
  stage: { width: 1920; height: 1080 };         // logical pixels, 16:9
  theme: { style: 'ren' | 'handlaget'; variant?: 'papir' | 'tavle' };
  assets: Record<AssetId, Asset>;
  scenes: Scene[];
}

interface Asset {
  kind: 'image' | 'audio' | 'video';
  file: string;                                  // path inside media/
  mime: string;
  width?: number; height?: number; duration?: number;
  origin?: { pptxPart: string };                 // where it came from on import
}

interface Scene {
  id: SceneId;
  title: string;                                 // shown in overview and table of contents
  kind: 'title' | 'section' | 'content' | 'closing';
  background: SurfaceRole;                       // theme role, never a raw colour
  elements: Element[];                           // back to front
  timeline: Step[];
  script: string;                                // voice-over manuscript, from PPTX notes
  audio?: { asset: AssetId; gain: number };      // recorded or imported voice (delivery 3)
  imported?: { slide: number; warnings: ImportWarning[] };
}

type Element =
  | TextElement | ImageElement | ShapeElement | TableElement | VideoElement
  | DeepDiveElement | DiagramElement | GroupElement;

interface ElementBase {
  id: ElementId;
  box: { x: number; y: number; w: number; h: number; rotation: number };
  name?: string;                                 // shown in the element list
}

interface TextElement extends ElementBase {
  type: 'text';
  role: 'title' | 'subtitle' | 'heading' | 'body' | 'caption' | 'number';
  content: RichText;                             // paragraphs, lists, runs
  color?: PaletteColor;                          // optional override, palette only
}
// Runs carry marks: bold, italic, highlight (the brand's text marking), link.

interface ImageElement extends ElementBase {
  type: 'image';
  asset: AssetId;
  alt: string;                                   // from PPTX alt text; required for export
  crop?: { l: number; t: number; r: number; b: number };
}

interface ShapeElement extends ElementBase {
  type: 'shape';
  geometry: 'rect' | 'ellipse' | 'line' | 'arrow' | { points: Point[] };
  fill?: FillRole; stroke?: StrokeRole;
  text?: RichText;
}

interface TableElement extends ElementBase {
  type: 'table';
  columns: number[];                             // relative widths
  rows: Array<{ header: boolean; cells: RichText[] }>;
}

interface VideoElement extends ElementBase {
  type: 'video';
  source: { asset: AssetId } | { url: string };  // local file or link
  poster?: AssetId;
  captionText?: string;
}

interface DeepDiveElement extends ElementBase {
  type: 'deepdive';                              // the "Lær mer" box
  label: string;
  body: RichText;
  media?: Array<{ asset: AssetId } | { url: string }>;
}

interface DiagramElement extends ElementBase {   // delivery 2
  type: 'diagram';
  template: 'timeline' | 'process' | 'cause-effect' | 'venn'
          | 'bar' | 'line' | 'layers' | 'comparison';
  data: unknown;                                 // what the owner typed into the form
  adjust: Record<PartId, Partial<Box>>;          // manual nudges on top of the layout
}

interface Step {
  id: StepId;
  at?: number;                                   // seconds from scene start; set while recording
  actions: Array<{
    target: ElementId | `${ElementId}#${PartId}`;// whole element or one part of a diagram
    effect: 'appear' | 'fade' | 'slide' | 'draw' | 'grow' | 'mark' | 'count' | 'leave';
    duration: number;
    delay?: number;
  }>;
}
```

## Tema

Et tema er data og tegneregler, ikke innhold:

- palett (USNs farger) og kontrasttabell
- roller: flater, tekstfarger, serieforløp for infografikk
- skriftskala for tittel, undertittel, overskrift, brødtekst, bildetekst
  og tall
- rutenett: 8 kolonner, marger, logoens plass og luft
- tegnemåte: `ren` tegner flate former; `handlaget` tegner de samme
  formene og legger kullstrek over, med fast frø per element slik at
  streken er lik fra bilde til bilde

## Hva de tre leserne gjør med formatet

| | Redigering | HTML | Video |
| --- | --- | --- | --- |
| Steg | Ordnes i en liste | Tastetrykk går til neste | Går på tidspunktet `at` |
| Tid | Kan dras fram og tilbake | Løper mens et steg spilles | Regnes ut per bilde |
| Fordypningsboks | Redigeres | Åpnes av seeren | Vises ikke |
| Manus | Redigeres | Kan vises som tekst | Grunnlag for innlest stemme og teksting |
| Lyd | Spilles inn | Kan følge med | Lydspor |

## Det som bevisst ikke er i formatet

- Rå farger og skrifter i innholdet (bare roller og profilfarger).
- PowerPoints egne animasjoner, SmartArt og diagrammer. De lages på nytt
  som steg og maler.
- Logoen. Den hører til temaet og hentes fra `merkevare/`.
