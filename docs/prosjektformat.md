# Prosjektformatet

Ett format leses av redigeringsprogrammet, HTML-spilleren og
videoeksporten. Den bindende beskrivelsen er koden i
`src/shared/format/schema.ts`, som også kontrollerer hver prosjektfil når
den åpnes og lagres. Denne fila forklarer tankegangen. Formatet har
versjonsnummer (nå 6), og eldre prosjekter løftes automatisk når de
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

Et prosjekt er en mappe (valgt i spørsmål 15). «Lagre som én
fil» i Fil-menyen lager en zip av mappa for flytting og arkivering, og
«Åpne prosjekt lagret som én fil» pakker den ut igjen.

## Oppbygging

Skissen under viser hovedtrekkene slik de ble tegnet før byggingen.
Noen detaljer ble enklere i den ferdige koden: formatet heter `lysark`,
tekst er avsnitt med nivå og listetype, farger på elementer er navn fra
profilpaletten, og hvert lysark har egne valg for profilformer og logo.
Importert tekst kan ha med seg det PowerPoint bestemte: størrelse per
listenivå (`levelScale`), linjeavstand (`lineHeight`), avstand før
avsnitt (`spaceBefore`) og innrykk (`indent`), alle målt i forhold til
tekstens skriftstørrelse. «Temaets størrelse» og «Rydd opp lysarket»
fjerner dem igjen. Avsnitt kan ha bokstav- eller romertallsnummerering
(`numberStyle`), og tekstbiter kan være senket eller hevet (`script`).
Former kan ha egne tekstmarger, justering og dreid tekst, tabeller egne
cellemarger, og bilder kan blandes med det som ligger under (`blend`,
brukt for håndskrift).
En video som er en lenke til en videoside, tegnes som et kort med
stillbildet sitt (`poster`) når det finnes.
Diagrammaler er ikke i formatet ennå (leveranse 4). Lyd kom i format 4.

## Format 6: det som åpnes og spilles under innlesing, og lydspor

**Hendelser.** Et lysark kan ha en liste `events`: det foreleseren
gjorde på lysarket mens det ble lest inn, utenom å gå til neste steg.
Hver hendelse har en `id` og et tidspunkt `at` i sekunder fra lysarkets
start, akkurat som stegenes `at`. Det er fire slag:

- `more-open` med `element`: «Lær mer»-boksen til elementet spretter ut.
- `more-close`: boksen som er åpen, legges bort.
- `video-play` med `element` (og `block` når videoen ligger inne i
  elementets boks), `from` (hvor i filmen den starter) og `duration`
  (filmens lengde, så klokka vet når den er slutt).
- `video-pause` med `element` (og `block`).

Ut fra lista sier klokka hvilken boks som er åpen og hvor hver video
står på et hvilket som helst tidspunkt. En video stopper når den blir
stoppet, når filmen er slutt, når boksen den ligger i legges bort, og
når lysarket er slutt. Videoeksporten og «Spill av» i HTML-fila gjør det
samme på samme tid. Når lyden klippes eller får en pause, flytter
hendelsene seg sammen med stegene; fjernes lyden, fjernes de.

**Lydspor.** Prosjektet kan ha `tracks: { music, sound }`: lyd som hører
til hele forelesningen, ikke til ett lysark. Stemmen er ikke her; den
ligger på hvert lysark som før. Et klipp på et spor har en lydfil
(`asset`, i prosjektets lydformat), et feste (`scene` og `offset`:
hvilket lysark det starter på, og hvor mange sekunder ut i det), et
utsnitt av fila (`from`, `to`) og valgfritt `gain`, `fadeIn` og
`fadeOut`. Festet gjør at klippet følger med når lysark flyttes eller
endrer lengde. `video.duckMusic` sier om musikken skal dempes mens det
snakkes (på når det ikke står noe).

## Format 5: skiltformen og avslutningsanimasjonen

**Skilt** er en ny form (`geometry: 'sign'`): et rektangel med spiss,
som et skilt som peker. Spissen står til høyre, eller til venstre når
`flipH` er satt, og er halve den korte siden dyp. Formen kan ha fyll,
omriss og tekst som andre former; teksten holder seg unna spissen.

**Avslutningsanimasjonen** er et valg på et lysark:
`closingAnimation: { seconds }`. Lysarket spiller da merkevarens
avslutningsfilm av seg selv når det vises. Filmen ligger **ikke** i
prosjektet: den er din egen fil, tatt vare på i programmets
innstillinger slik som logoen. I prosjektet står bare lengden, fordi
klokka må vite hvor lenge lysarket står (filmens lengde pluss to
sekunder), og at hvert bilde av filmen er et nytt bilde i videoen. I en
eksportert HTML-fil legges filmen ved én gang, slik logoen gjør.

## Format 4: lyd, tid og valg for video

**Opptakene** er lydfiler i `media/` og står i `assets` med
`kind: 'audio'`. All lyd i et prosjekt er WAV i mono, 48 kHz og 16 bit.
Da er et tidspunkt i et opptak et bestemt sted i fila, og ingenting må
dekodes for å klippe. Lydfiler du importerer (MP3, M4A og andre), gjøres
om til dette formatet når de legges inn.

**Lyden på et lysark** er `audio` på lysarket: en liste med klipp som
spilles etter hverandre, og en valgfri endring av lydstyrken (`gain`, i
desibel, fra -18 til 18).

```ts
type AudioClip =
  | { id: string; kind: 'sound'; asset: string; from: number; to: number } // sekunder i opptaket
  | { id: string; kind: 'pause'; duration: number };                      // stillhet
```

Et opptak endres aldri. Å klippe bort et stykke gjør ett klipp om til to
som peker på hver sin del av det samme opptaket. Derfor kan alt angres,
og «originalen beholdes» er sant bokstavelig. En pause er et eget klipp.

**Lengden på et lysark** i video og i «Spill av» er lengden på lyden.
Et lysark uten lyd står i 5 sekunder, pluss 2 for hvert steg; vil du
bestemme lengden selv, legger du inn en pause.

**Tidspunktet for et steg** er `at` på steget, i sekunder fra lysarket
starter. Det settes når du trykker pil høyre under innlesing, og kan
flyttes på tidslinja. Steg uten tidspunkt fordeles jevnt. Når lyd
klippes bort eller en pause legges inn, flytter stegene etterpå seg
tilsvarende, så det som vises, fortsatt følger det som sies.

**Valgene for video** står i `video` på prosjektet: overgang mellom
lysark (`transition`: rent klipp eller kort toning), jevn lydstyrke
(`evenLoudness`) og «Bildekilder» som avslutning (`credits`).

**Klokka** (`src/shared/render/clock.ts`) regner ut hva som står på
skjermen ved et hvilket som helst tidspunkt. Videoeksporten, «Spill av»
i HTML-fila og lydpanelet i programmet bruker den samme klokka, og den
leser aldri veggklokka.

**I en eksportert HTML-fil** ligger ikke opptakene. Lyden på hvert
lysark settes sammen (klipp, pauser, lydstyrke) og kodes som én liten
AAC-fil, og lysarket peker på den. Åpner du HTML-fila som prosjekt
igjen, er klippene derfor slått sammen.

## Format 3: tykkelse på strek

En form kan ha sin egen tykkelse på streken (`strokeWidth`, i
lysarkpiksler, fra 1 til 60). Den gjelder linjer, piler og omrisset på
former uten fyll. Pilspissen vokser med tykkelsen (lengden er tre ganger
tykkelsen pluss 6), så en tynn pil fortsatt har en spiss som syns. Uten
feltet brukes temaets tykkelse (6 i ren stil), slik som før. Prosjekter
i format 2 løftes ved at versjonsnummeret økes; ingenting annet endres.

Importen fra PowerPoint setter ikke feltet: importerte linjer og piler
får temaets tykkelse, som før, og kan endres i Element-fanen.

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
  audio?: { clips: AudioClip[]; gain?: number }; // the slide's sound: see "Format 4" above
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
