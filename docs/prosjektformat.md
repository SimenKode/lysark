# Prosjektformatet

Ett format leses av redigeringsprogrammet, HTML-spilleren og
videoeksporten. Den bindende beskrivelsen er koden i
`src/shared/format/schema.ts`, som også kontrollerer hver prosjektfil når
den åpnes og lagres. Denne fila forklarer tankegangen. Formatet har
versjonsnummer (nå 18), og eldre prosjekter løftes automatisk når de
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
Figurer med skjema kom i format 11; diagrammer er ikke i formatet ennå.
Lyd kom i format 4.

## Format 18: tid uten lyd, og lysark som ikke er med i videoen

```ts
interface Scene {
  // ... som før
  seconds?: number;   // 0,5 til 600: så lenge står lysarket når det ikke har lyd
  skip?: boolean;     // lysarket er ikke med i videoen, GIF-en og «Spill av»
}
```

- **`seconds`** er hvor lenge et lysark uten lyd står i videoen, i GIF-en,
  i «Spill av» og på tidslinja. Uten feltet står det som før: 5 sekunder,
  pluss 2 for hvert steg. Steg uten eget tidspunkt fordeles jevnt over
  tiden, etter samme regel som før. Har lysarket lyd, er det lyden som
  bestemmer, og `seconds` brukes ikke.
- Foreleseren setter tallet i feltet «Tid uten lyd» i fanen «Lysark», i
  setningen i fanen «Lyd» («Bruk på alle lysark uten lyd» setter det på
  alle lysark uten lyd i én endring), eller ved å dra i kanten av lysarket
  på tidslinja.
- Et lysark der «lyden» bare er pauser (den gamle måten å bestemme
  lengden på), er et lysark uten lyd: feltet viser summen av pausene, og
  et nytt tall erstatter dem med `seconds`.
- Et lysark som vises igjen (`repeat`) og et lysark med
  avslutningsanimasjonen har sine egne regler; der brukes ikke feltet
  (`ownsSeconds` i `src/shared/render/clock.ts`).
- **`skip`** tar lysarket ut av videoen, GIF-en og «Spill av»: det tar
  ingen tid der, og klokka hopper over det (`schedule` gir det lengden 0,
  og `frameAt` viser det aldri). Den som blar i HTML-fila for hånd, ser
  det likevel. Foreleseren slår det av og på med «Ta med i videoen og i
  «Spill av»» i fanen «Lysark».
- Et opptak der foreleseren hopper framover over lysark uten lyd, setter
  `skip` på akkurat de lysarkene (`applyRecording` i
  `src/shared/audio/session.ts`), og meldingen etter opptaket sier det.
  Lysark før stedet opptaket startet, røres aldri, og et lysark som får
  lyd fra opptaket, tas med igjen.
- Et kapittel som begynner på et lysark som ikke er med, begynner i
  videoen og i «Spill av» på neste lysark som er med. Numrene på
  lysarkene (`slideNumbers`) endres ikke.
- Eldre prosjekter løftes ved at versjonsnummeret økes.

## Format 17: tabeller fra PowerPoint slik de var

En tabell kan ha med seg det PowerPoint visste om den, så den blir like
høy og bred som der. Alt er valgfritt; en tabell uten disse feltene
følger temaet som før.

- `rowHeights` på tabellen: den minste høyden på hver rad, i piksler på
  lysarket. En rad blir høyere når teksten trenger det.
- `lineHeight` på tabellen: linjehøyden, som et tall ganger
  skriftstørrelsen.
- `spaceBefore` på tabellen: luften over et avsnitt på hvert av de fem
  listenivåene, som et tall ganger skriftstørrelsen i cella. Det første
  avsnittet i en celle har aldri luft over seg.
- `scale` på en celle: skriftstørrelsen i cella, som et tall ganger
  tabellens. Feltet «Skriftstørrelse» endrer derfor fortsatt hele
  tabellen.
- `align` (`left`, `center`, `right`) og `valign` (`top`, `middle`,
  `bottom`) på en celle. Uten dem står teksten oppe til venstre.

Eldre prosjekter løftes uten endring.

## Format 16: bevegelser, og steg som markerer, tar bort og zoomer

```ts
interface StepAction {
  target: ElementId;
  effect: 'appear' | 'fade' | 'slide' | 'grow' | 'draw' | 'count';
  duration: number;                  // sekunder
  delay?: number;
}

interface Step {
  id: string;
  at?: number;                       // tidspunkt i lysarket, satt under innlesing
  actions: StepAction[];
  kind?: 'mark' | 'hide' | 'zoom';   // uten: steget viser elementene sine
  zoom?: { x; y; w; h };             // zoom-steg: utsnittet. Uten: hele lysarket
  seconds?: number;                  // zoom-steg: hvor lenge gliden varer
}
```

- **`effect`** er hvordan elementet kommer inn. Programmet foreslår den
  som passer (`proposedEffect` i `src/shared/layout/steps.ts`), og
  foreleseren kan velge en annen. Før format 16 fantes bare `appear` og
  `fade`, og de betyr det samme som før.
- **Et steg uten `kind`** viser elementene sine. Det første slike steget
  for et element bestemmer; elementer uten et slikt steg er der fra
  starten.
- **`mark`:** elementene er markert til neste steg kommer.
- **`hide`:** elementene toner bort. Et senere steg kan vise dem igjen.
- **`zoom`:** bildet glir inn på `zoom`, eller ut til hele lysarket når
  `zoom` mangler. Et slikt steg har ingen elementer, og tas derfor ikke
  bort når det er tomt (`stepStands`).
- **Én funksjon** sier hva stegene har gjort til enhver tid (`movesFrom`
  i `src/shared/render/timeline.ts`), og én tegner det
  (`applySceneMoves`). Spilleren, videoen og innlesingsvinduet bruker
  begge.
- Eldre prosjekter løftes ved at versjonsnummeret økes.

## Format 15: navn langs aksen i et linjediagram

```ts
interface FigureElement {
  // ... som før
  along?: 'names';   // linjediagram: navn langs den vannrette aksen
}
```

Uten `along` står hvert punkt i et linjediagram der radens `x` sier.
Med `along: 'names'` står radene i tabellens rekkefølge, med lik avstand,
hver over navnet sitt (`text`), slik PowerPoints vanlige linjediagram er.
Eieren valgte dette 26.11.2026. `x` beholdes når det byttes, så ingenting
går tapt ved å bytte fram og tilbake. Eldre prosjekter løftes ved at
versjonsnummeret økes.

## Format 14: figur i en «Lær mer»-boks

En «Lær mer»-boks kan holde en figur. Figuren lages på et lysark og
hentes inn i boksen (eierens valg 25.11.2026); det som legges i boksen,
er en kopi.

```ts
type MoreBlock =
  // ... som før, og
  | {
      id; kind: 'figure';
      elements: DrawnElement[];      // kopien: elementene, der de sto på lysarket
      frame: { x; y; w; h };         // den delen av lysarket figuren fylte
      alt: string;                   // hva figuren viser, for skjermleser
      caption?: string;              // figurtekst under figuren
    };
```

- **`DrawnElement`** er et element som bare viser noe: tekst, bilde,
  form, tabell, merke, forklaringsliste og figur med skjema. Det har ikke
  `more` selv (ingen boks i boksen), og video og «+ Lær mer»-knapper er
  ikke med. I koden er elementene derfor først beskrevet uten `more`, og
  får det lagt til etterpå.
- **Hva som kan hentes** (`figuresOn` i `src/shared/layout/fetch.ts`): en
  gruppe (en figur med skjema er en gruppe, med delene sine) og et bilde
  med merker. Merker og forklaringsliste følger bildet sitt.
- **Kopien** (`fetchFigure`) har egne id-er, står der figuren sto, og er
  bare tegnet: ingen gruppe, ingen festede ender, ingen steg. Lysarket
  kan endres eller slettes uten at boksen merker det. «Hent på nytt» i
  byggeren bytter kopien.
- **Tegningen:** de samme elementene, tegnet av den samme koden som
  tegner lysarket (`renderDrawing` i `src/shared/render/scene.ts`), på
  boksens hvite flate. Tegningen er i lysarkets egne piksler og krympes
  til bredden boksen har, men blir aldri større enn tre firedeler av
  størrelsen på lysarket (hele størrelsen når studenten har utvidet
  boksen). En boks med en figur er bredere enn andre bokser (760 mot
  560), så figuren kan leses; det valgte eieren 26.11.2026.
- Eldre prosjekter løftes ved at versjonsnummeret økes.

## Format 13: søyle- og linjediagram

En figur med skjema kan ha `template: "bars"` eller `"line"`. Skjemaet er
da en tabell med tall:

- `series` er seriene: `name`, og `color` når foreleseren har valgt en
  annen enn temaets.
- Radene ligger i `items`. I et søylediagram er `text` navnet under
  søylene. I et linjediagram er `x` tallet langs den vannrette aksen.
  `values` har ett tall for hver serie, og `null` der det ikke står noe.
- `xTitle` og `yTitle` er teksten ved aksene. `yMin`, `yMax`, `xMin` og
  `xMax` er endene på aksene når foreleseren har satt dem. `dots` setter
  en prikk i hvert punkt.

Delene er vanlige elementer, som i de andre malene: søylene
(`bar:<rad>:<serie>`) er rektangler, navnene under dem (`label:<rad>`),
tallene langs aksene (`tick:<n>`, `xtick:<n>`), tekstene ved aksene
(`title:x`, `title:y`) og navnene i forklaringen (`name:<serie>`) er
tekstbokser, og aksene og linjene på tvers (`axis:x`, `axis:y`,
`grid:<n>`) er linjer.

**Ny form: kurve.** En form kan ha `geometry: "curve"`: én strek gjennom
mange punkter. `points` er punktene som brøkdeler av boksen (x mot
høyre, y nedover), og `null` er et brudd. `dots` setter en prikk i hvert
punkt. En linje i et linjediagram er en slik form (`curve:<serie>`).

Et prosjekt i format 12 leses som det er.

## Format 12: tidsakse

En figur med skjema kan ha `template: "timeAxis"`: en strek med et punkt
for hver hendelse. Radene i skjemaet er hendelsene: `text` er når
hendelsen er, og `detail` er hva den er. `direction` snur aksen nedover,
som for en prosess.

- **Delene:** streken (`part` er `axis:line`), og for hver hendelse et
  punkt på streken (`dot:<rad>`), en boks med tidspunktet (`head:<rad>`)
  og teksten (`body:<rad>`).
- **Teksten er en vanlig tekstboks** (`type: "text"`) med `of`, ikke en
  form. Den finnes bare når det står noe i `detail`. Alle andre deler er
  former, som før.
- **En del som kommer til i en rad**, kommer inn i samme steg som resten
  av raden. Det gjelder alle figurer med skjema.

Et prosjekt i format 11 leses som det er.

## Format 11: figurer som tegner seg selv fra et skjema

En figur med skjema (`type: "figure"`) holder skjemaet og en ramme, og
viser ingenting selv. `template` er `process` (bokser med piler mellom),
`layers` (lag oppå hverandre) eller `comparison` (kolonner med overskrift
og punkter). `items` er radene i skjemaet: `text`, og for en
sammenligning `detail` (punktene, ett per linje). `direction` snur en
prosess nedover, og `color` og `fontSize` overstyrer malens egne.

- **Det som synes, er vanlige former.** Hver del er et eget element av
  typen `shape` med `of`: hvilken figur den hører til (`figure`) og
  hvilken del den er (`part`, for eksempel `box:<rad>` eller
  `arrow:<rad>`). Delene er gruppert med figuren (`group`), og pilene i
  en prosess er festet til boksene (`startAt`, `endAt`).
- **Skjemaet styrer.** Etter hver endring lages, plasseres og fjernes
  delene slik skjemaet sier (`followTemplates` i
  `src/shared/layout/templates.ts`). En del som flyttes for hånd, legges
  tilbake. Id-en, steget og «Lær mer» er delens egne, og følger raden om
  den flyttes i skjemaet.
- **«Gjør om til fri figur»** fjerner figurelementet. Formene står igjen
  som en vanlig gruppe uten `of`.
- Det som tegner lysarket, kjenner bare formene. Figurelementet tegnes
  som en tom ramme, og sier bare fra i redigeringsprogrammet når
  skjemaet er tomt.

Et prosjekt i format 10 leses som det er.

## Format 10: grupper, og linjer som er festet

En fri figur er ikke en egen type element. Den er vanlige elementer
(former, tekst, bilder) som er gruppert, og linjer og piler som er
festet til dem.

- **En gruppe** er elementer på samme lysark med samme verdi i `group`.
  Gruppen velges, flyttes, kopieres og endrer størrelse samlet i
  redigeringsprogrammet, men hver del er fortsatt et eget element, så
  den kan komme inn i sitt eget steg og ha «Lær mer». En gruppe har minst
  to deler, og grupper ligger ikke inni grupper. Merker og
  forklaringslister er aldri deler av en gruppe; de følger bildet sitt.
- **En festet ende.** En linje eller pil (`geometry` er `line` eller
  `arrow`) kan ha `startAt` og `endAt`: id-en til elementet hver ende er
  festet til. Spissen på en pil er i slutten. En festet ende ligger på
  kanten av elementet (en ellipse har rund kant), på den siden som
  vender mot linjas andre ende. Er begge endene festet, går linja mellom
  de to elementene slik midtpunktene deres ligger.
- **Linja er fortsatt en vanlig linje med en boks.** Boksen regnes ut på
  nytt etter hver endring (`followFigures` i
  `src/shared/layout/groups.ts`). Det som tegner lysarket (i
  redigeringsprogrammet, i HTML-spilleren og i videoen), ser derfor aldri
  på `group`, `startAt` eller `endAt`, og er ikke endret.
- Slettes elementet en ende er festet til, løsner enden og linja blir
  liggende der den lå. En linje som flyttes alene, løsner; en som
  flyttes sammen med det den er festet til, sitter.

Et prosjekt i format 9 leses som det er.

## Format 9: kapitler, og lysark som vises igjen

Et lysark kan begynne et kapittel (`chapter` er navnet). Et lysark kan
også være et annet lysark vist en gang til (`repeat`), slik at video og
«Spill av» viser lysarkene i den rekkefølgen foreleseren viste dem under
opptaket. Det har sin egen lyd, sine egne tider og sitt eget manus, men
viser alltid det lysarket det gjentar viser (`followRepeats` i
`src/shared/layout/repeats.ts`).

## Format 8: merker på et bilde

Et bilde kan ha merker som peker ut det viktige i det. Bildet sier
hvordan merkene vises (`marks`): `numbers` (nummererte punkter med en
forklaringsliste; gjelder når feltet mangler) eller `labels` (etiketter
med strek inn til punktet).

- **Et merke er et eget element** (`type: "mark"`), så det kan komme inn
  i et steg og ha «Lær mer» som alt annet. `on` er bildet det hører til,
  `text` er forklaringen (i lista) eller teksten på etiketten, og
  `point` er det merket peker på, i scenepiksler. Med tall er `box` selve
  det runde merket, med midten i `point`. Med etiketter er `box`
  etiketten, og streken går fra kanten av den til `point`.
- **Forklaringslista** (`type: "legend"`, `on` er bildet) skriver seg
  selv fra merkene, i den rekkefølgen de står i lysarket. Den lagrer
  ingen tekst selv.
- **Merkene følger bildet.** `anchor` på et merke er bildets boks da
  merket sist ble plassert. Når bildet flyttes eller endrer størrelse,
  flyttes `point` likt, og merkets egen boks regnes ut på nytt
  (`followMarks` i `src/shared/layout/marks.ts`, som kjøres etter hver
  endring). Slettes bildet, slettes merkene og lista. Nummeret til et
  merke lagres ikke; det er plassen blant bildets merker.

Et prosjekt i format 7 leses som det er.

## Format 7: kamerasirkelen

Foreleseren kan filme ansiktet sitt mens et lysark leses inn. Det vises
i en sirkel på lysarket, i videoen (ikke i HTML-fila, ikke i en GIF).

- **Filmen hører til opptaket.** Et opptak (en lydfil i `assets`) kan ha
  `camera: { asset, offset }`: filmen som ble tatt sammen med det, og
  hvor mange sekunder ut i opptaket filmens første bilde hører hjemme.
  Filmen er selv en fil i `assets`, med `kind: "camera"`: kvadratisk
  (480 × 480), 30 bilder i sekundet, uten lyd. Fordi klippene i lyden
  peker inn i opptaket, følger filmen med når lyden klippes: et klipp
  viser den delen av filmen som ble tatt mens det ble sagt. I en pause
  står ansiktet stille.
- **Plassen hører til lysarket.** `camera: { x, y, size, hidden }` på et
  lysark sier hvor sirkelens midtpunkt står når lysarket begynner (i
  scenepiksler), hvor stor den er (`small`, `medium`, `large`), og om
  den er skjult der.
- **Flytting underveis er en hendelse.** `events` kan ha
  `{ kind: "camera-move", at, x, y }`: fra tidspunktet `at` glir
  sirkelen til en ny plass.

Klokka (`cameraAt` i `src/shared/render/clock.ts`) sier hvilket bilde
av ansiktet som vises og hvor sirkelen står til enhver tid. Et prosjekt
i format 6 leses som det er.

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

I en eksportert HTML-fil ligger sporene som én lydfil for hele
forelesningen, fra starten og til det siste klippet slutter, med
musikken dempet under stemmen slik som i videoen. Den ligger på et klipp
på sporet `sound` (`k_tracks`), og spilleren får vite hvilken fil det er
(`under`). «Spill av» spiller den ved siden av stemmen og lar den gå
videre over byttet av lysark; stemmen på hvert lysark holder seg til den.
Åpnes HTML-fila som prosjekt igjen, ligger musikken og lyden som ett
klipp under hele forelesningen. (Tidligere lå musikken i lyden på
hvert lysark, og fikk et lite opphold ved hvert bytte.)

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
Et lysark uten lyd står i 5 sekunder, pluss 2 for hvert steg. Fra
format 18 bestemmer du lengden selv med «Tid uten lyd» (`seconds`, se
over); før det ble det gjort med en pause.

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
