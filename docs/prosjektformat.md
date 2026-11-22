# Prosjektformatet

Ett format leses av redigeringsprogrammet, HTML-spilleren og
videoeksporten. Den bindende beskrivelsen er koden i
`src/shared/format/schema.ts`, som også kontrollerer hver prosjektfil når
den åpnes og lagres. Denne fila forklarer tankegangen. Formatet har
versjonsnummer (nå 2), og eldre prosjekter løftes automatisk når de
åpnes (`src/shared/format/migrate.ts`).

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
Importert tekst kan ha med seg det PowerPoint bestemte: størrelse per
listenivå (`levelScale`), linjeavstand (`lineHeight`), avstand før
avsnitt (`spaceBefore`) og innrykk (`indent`), alle målt i forhold til
tekstens skriftstørrelse. «Temaets størrelse» og «Tilpass til rutenett»
fjerner dem igjen. Avsnitt kan ha bokstav- eller romertallsnummerering
(`numberStyle`), og tekstbiter kan være senket eller hevet (`script`).
Former kan ha egne tekstmarger, justering og dreid tekst, tabeller egne
cellemarger, og bilder kan blandes med det som ligger under (`blend`,
brukt for håndskrift).
En video som er en lenke til en videoside, tegnes som et kort med
stillbildet sitt (`poster`) når det finnes.
Diagrammaler og lyd er ikke i formatet ennå (leveranse 3 og 4).

## Format 2: utdyping («Lær mer») og kreditering

Fra leveranse 2 kan **alle elementer** ha utdyping. Skissen lenger ned
viser fordypningsboksen slik den var i format 1 (`body` og `media`);
slik er det nå:

```ts
interface ElementBase {
  id: ElementId;
  box: Box;
  name?: string;
  more?: More;                       // utdyping; alle elementtyper kan ha det
}

interface More {
  title: string;                     // overskrift i panelet, og navnet på «+»-merket
  blocks: MoreBlock[];               // byggesteinene, i rekkefølge
  corner?: 'tr' | 'tl' | 'br' | 'bl'; // hjørnet merket står i
}

type MoreBlock =
  | { id; kind: 'heading'; text: string }
  | { id; kind: 'text'; content: RichText }
  | { id; kind: 'image'; asset: AssetId; alt: string; caption?: string }
  | { id; kind: 'video'; source: VideoSource; title: string; poster?: AssetId }
  | { id; kind: 'table'; columns: number[]; headerRow: boolean; rows: TableCell[][] }
  | { id; kind: 'embed'; url: string; title: string };

interface DeepDiveElement extends ElementBase {
  type: 'deepdive';                  // knappen «+ Lær mer»
  label: string;                     // teksten på knappen
}                                    // innholdet ligger i `more`, som for alle andre

interface Asset {
  // ... som før
  credit?: {                         // hvem som har laget bildet, og vilkårene
    title?: string; author?: string;
    license?: string; licenseUrl?: string;
    sourceUrl?: string;
    required?: boolean;              // lisensen krever at dette vises
  };
}
```

- Et element uten byggesteiner har ingen utdyping og får ikke merke.
  Knappen «+ Lær mer» har alltid et panel.
- Uten valgt hjørne står merket oppe til høyre. På tekst følger det
  teksten: til den siden og kanten teksten er justert mot.
- «Beskåret» lagres ikke i krediteringen; det leses av at bildeelementet
  har beskjæring.
- En video med YouTube-adresse tegnes i to trinn: stillbilde og knapp
  først, spilleren først når seeren trykker. Det er tegnekoden som
  kjenner igjen adressen; formatet lagrer bare adressen.
- **Løft fra format 1:** fordypningsboksens tekst blir en tekstblokk,
  bildene bildeblokker, videoene videoblokker, og lenkene tekstblokker
  med lenke. Knappeteksten beholdes og blir også overskrift i panelet.

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
| Utdyping («Lær mer») | Bygges i byggeren | Åpnes av seeren fra merket | Vises ikke |
| Manus | Redigeres | Kan vises som tekst | Grunnlag for innlest stemme og teksting |
| Lyd | Spilles inn | Kan følge med | Lydspor |

## Det som bevisst ikke er i formatet

- Rå farger og skrifter i innholdet (bare roller og profilfarger).
- PowerPoints egne animasjoner, SmartArt og diagrammer. De lages på nytt
  som steg og maler.
- Logoen. Den hører til temaet og hentes fra `merkevare/`.
