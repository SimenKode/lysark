# Lysark

Et skrivebordsprogram **for forelesere**. Det gjør en forelesning du
allerede har, i PowerPoint (PPTX) eller PDF, om til

1. en interaktiv HTML-fil som virker uten nett, og
2. en video (MP4, 1080p) med stemmen din lest inn, og teksting, eller en
   GIF av et kort klipp,

begge i USNs visuelle profil. Programmet skal kunne brukes uten
opplæring, og virke på Windows 11 og Linux Mint / Ubuntu.

Lysark er et privat prosjekt. Det er ikke laget, eid eller godkjent av
Universitetet i Sørøst-Norge (USN). Programmet har valgt de samme
fargene, formene og skrifttypene som USNs profil; USNs logo følger ikke
med.

Lysark er fri programvare under GNU General Public License, versjon 3
eller senere (se [Lisens](#lisens)).

## Status

Tre av fem leveranser er bygd: PPTX-import med redigering og
HTML-eksport (1), «Lær mer»-byggeren (2), og lyd og video (3). Dermed
finnes en første brukbar utgave med både HTML og video. Figurer og
bevegelser (4) og håndlaget stil (5) gjenstår; planen står i
[docs/plan.md](docs/plan.md).

Hva som er prøvd, på hvilket system, og hva som ikke er prøvd, står i
[HANDOFF.md](HANDOFF.md) (kort) og [docs/historikk.md](docs/historikk.md)
(i detalj). Kort: alt er prøvd automatisk på Linux Mint,
importen er prøvd mot åtte ekte forelesninger (315 lysark), og
zip-utgaven er prøvd for hånd på Windows 11. Canvas er ikke prøvd.

## Slik bruker du programmet

1. **Importer PowerPoint.** Velg PPTX-fila, og deretter hvor prosjektet
   skal ligge. Lysark lager en mappe med `prosjekt.json` og `media/`.
2. **Les importrapporten.** Den sier hva som kom med, og hva som må lages
   på nytt (SmartArt, diagrammer, animasjoner, buede piler, bilder i
   formater som ikke kan vises), og hvor logoen er slått av fordi noe
   ligger der den skal stå. Merknadene står også på hvert lysark.
3. **Rett opp lysarkene.** Klikk for å velge, dra for å flytte,
   dobbeltklikk for å skrive. «Rydd opp lysarket» (fanen Lysark) rydder
   et lysark inn i de åtte kolonnene.
4. **Legg inn steg** (fanen Steg) for det som skal komme inn ett for ett.
5. **Legg til «Lær mer».** Høyreklikk på et hvilket som helst element
   og velg «Legg til «Lær mer»», eller bruk «+ Lær mer» for en egen
   knapp i lysarket. Byggeren har innholdet til venstre (tekst,
   overskrift, bilde, video, tabell, nettside), og til høyre lysarket
   selv med boksen slik studenten ser den. Elementet får et «+»-merke;
   når studenten trykker det, spretter boksen ut ved elementet, oppå
   lysarket.
6. **Hent bilder.** «Bilde» åpner mediedialogen: søk i Wikimedia Commons,
   last opp, eller bruk noe prosjektet allerede har. Bilder fra Commons
   får opphavsperson, lisens og kilde med seg, og Lysark viser det under
   bildet og under «Bildekilder» i HTML-fila.
7. **Forhåndsvis** (F5) viser nøyaktig det en eksport vil inneholde.
8. **Eksporter HTML.** Resultatet er én fil. Videoer over 20 MB legges i
   en mappe ved siden av fila, og programmet sier fra når det skjer.
9. **Les inn stemmen** (fanen «Lyd» under lysarket, «Les inn», eller
   Ctrl+R). Manuset og lysarket står på skjermen. Pil høyre går til neste
   steg eller neste lysark; tidspunktet for hvert steg blir der du
   trykket, og opptaket deles ved hvert lysark. Du kan lese inn hele
   forelesningen i ett strekk og likevel rette ett lysark om gangen.
   Mens du leser inn, kan du også trykke på lysarket: «+» åpner «Lær
   mer»-boksen, og en videofil spilles når du trykker på den. Det kommer
   med i videoen og i «Spill av» på samme tidspunkt. Bruk hodetelefoner
   når du spiller video med lyd, ellers tar mikrofonen den opp en gang
   til.
10. **Rett på lyden** i fanen «Lyd»: merk et stykke og klipp det bort,
    klipp bort starten eller slutten, legg inn en pause, dra stegene dit
    de skal skje, juster lydstyrken, eller ta om fra spillehodet.
    Opptakene endres aldri; alt kan angres.
    **Musikk og annen lyd** legger du inn i fanen «Tidslinje». Der står
    lysarkene på rad etter lengde, med sporene Stemme, Musikk og Lyd
    under. «Legg til musikk» setter en lydfil inn ved spillehodet; dra
    den på plass, dra i endene for å korte den inn, og velg den for å
    tone inn og ut, dele den eller endre lydstyrken. Musikken dempes av
    seg selv mens du snakker. Programmet følger ikke med musikk; bruk
    filer du har lov til å bruke, og før opp kreditering der.
11. **Eksporter video** (Ctrl+Shift+E). Du får en MP4-fil (1920 × 1080)
    og tekstingen som en egen fil ved siden av (`.vtt`), laget av
    manuset. Har lysarkene lyd, får også HTML-fila stemmen med, og
    studentene kan trykke «Spill av».
12. **Avslutt med USNs logoanimasjon.** Importerer du en forelesning
    som har den på siste lysark, tar Lysark vare på filmen og lar
    lysarket spille den av seg selv, uten knapper og uten lyd. Den kan
    også velges under Innstillinger.
13. **Lag en GIF** av et kort klipp: i samme dialog velger du «GIF» og
    hvilke lysark (hele forelesningen, bare dette lysarket, eller fra og
    til). En GIF har ikke lyd, spiller i løkke, og kan være høyst to
    minutter.

**Andre inndata** (Fil-menyen):

- **«Importer PDF …»** gjør hver side til et lysark med siden som bilde,
  tegnet i dobbel oppløsning. Teksten på siden blir bildets alternative
  tekst, så skjermleser og søk virker, og første linje blir lysarkets
  tittel. Innholdet kan ikke redigeres, men du kan legge på steg, «Lær
  mer» og manus. Sider uten tekst (skannede sider) merkes, så du kan
  skrive den alternative teksten selv. PPTX er fortsatt veien til
  redigerbart innhold.
- **«Åpne HTML-fil …»** gjør en HTML-fil som er eksportert fra Lysark,
  til et prosjekt igjen, i en ny mappe. Store videoer tas med hvis mappa
  de ligger i, står ved siden av HTML-fila; ellers sier programmet
  hvilke som mangler. Andre HTML-filer avvises.

**YouTube** vises som YouTubes egen spiller, rett i lysarket. Den hentes
fra YouTube når lysarket vises, og «Åpne på YouTube» står alltid ved
siden av. Åpnes HTML-fila rett fra disk, vises et stillbilde med en
knapp som åpner YouTube i nettleseren, fordi YouTube ikke spiller i en
slik side.

**Nett:** programmet kontakter nettet bare når du selv søker etter et
bilde i Wikimedia Commons eller henter et forhåndsbilde fra YouTube. Da
sendes bare søkeordene. Ellers ingenting, og ingenting i bakgrunnen.

**Mikrofon:** brukes bare mens du leser inn. Bare lyd, aldri kamera.
Opptakene lagres i prosjektmappa og sendes ingen steder.

**FFmpeg** lager videoen og gjør om lyd. Det er et eget program som
følger med Lysark (mappa `ffmpeg` blant programfilene), med sin egen
lisens (GNU GPL versjon 3) og lenke til kildekoden.

USNs logo hentes fra logopakka: under Innstillinger velger du mappa der
pakka er pakket ut, og Lysark finner hovedlogoen i lilla og hvit, på norsk
og engelsk.

## For utvikling

```bash
npm install
```

```bash
npm run fetch:ffmpeg
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run dist:linux
```

`npm run fetch:ffmpeg` henter FFmpeg (én fast utgave, med kontroll av
sjekksum) til `vendor/ffmpeg/`. Uten det kan programmet ikke lage video,
og testen for lyd og video hoppes over.

`npm test` bygger programmet og kjører alle testene, også åtte som
starter hele programmet (uten å vise vindu) og går gjennom import av
PowerPoint, PDF og eksportert HTML, redigering, lagring, innlesing med
en prøvemikrofon, klipping, «Lær mer» og video under innlesing,
tidslinja med musikk, eksport til HTML og video, og avspilling.

## Dokumenter

| Fil | Innhold |
| --- | --- |
| [HANDOFF.md](HANDOFF.md) | Kort status: hva programmet kan, hva som er bestemt, og hva som står for tur |
| [docs/historikk.md](docs/historikk.md) | Loggen: alt som er bygget og prøvd i detalj, og tilbakemeldingene |
| [AGENTS.md](AGENTS.md) | Reglene alle som arbeider i prosjektet skal følge |
| [docs/plan.md](docs/plan.md) | De fem leveransene og hva som er med i hver |
| [docs/stakk.md](docs/stakk.md) | Valgt teknologi, begrunnelse og lisens per avhengighet |
| [docs/prosjektformat.md](docs/prosjektformat.md) | Prosjektformatet (lysark, elementer, tidslinje) |
| [docs/sporsmal-leveranse-1.md](docs/sporsmal-leveranse-1.md) | Designspørsmålene for leveranse 1, med svar |
| [docs/sporsmal-videre.md](docs/sporsmal-videre.md) | Designspørsmålene for leveranse 2–5, med svar |
| [LICENSE](LICENSE), [EXPORT-EXCEPTION.md](EXPORT-EXCEPTION.md) | Lisensen, og unntaket for forelesninger du eksporterer |

## Mapper

| Mappe | Innhold |
| --- | --- |
| `src/shared/` | Format, tema og tegnekode som alle deler bruker |
| `src/importer/` | Import av PPTX, PDF og eksportert HTML |
| `src/player/` | Spilleren som skrives inn i HTML-fila |
| `src/exporter/` | Bygger HTML-fila |
| `src/main/`, `src/preload/` | Programmets hovedprosess (filer, video, lyd, FFmpeg) og broen til grensesnittet |
| `src/renderer/` | Redigeringsprogrammet |
| `resources/fonts/` | Liberation Sans og Serif, uendret, med lisens |
| `tests/` | Tester |
| `tools/` | Hjelpeskript: hente FFmpeg, og styre Windows-VM-en under utprøving |

Ikke i git: `merkevare/` (USNs logopakke), `eksempler/` (ekte
forelesninger), `vendor/ffmpeg/` (FFmpeg), `build/licenses/`
(lisenstekster samlet for en utgivelse), `release/` (ferdige
installasjonsfiler). USNs logo og avslutningsanimasjon ligger i
programmets egne innstillinger på din maskin, aldri i repoet.

## Lisens

Lysark er fri programvare: du kan bruke, endre og dele det videre etter
[GNU General Public License](LICENSE), versjon 3 eller senere. Deler du en
endret utgave av programmet, må kildekoden følge med på samme vilkår.
Programmet kommer uten noen garanti.

**Forelesningene du eksporterer, er dine.** En eksportert HTML-fil
inneholder spilleren fra Lysark. Et uttrykkelig unntak
([EXPORT-EXCEPTION.md](EXPORT-EXCEPTION.md)) sier at du kan dele slike
filer på de vilkårene du selv vil, uten at innholdet ditt blir underlagt
GPL.

Lisensen dekker ikke:

- **USNs navn, logo og visuelle profil.** De tilhører Universitetet i
  Sørøst-Norge. Logoen følger ikke med; du må selv ha logopakka fra USN.
- **Skriftene** Liberation Sans og Liberation Serif, som har sin egen frie
  lisens (SIL Open Font License 1.1, se `resources/fonts/LICENSE`).
- **Bibliotekene** programmet bygger på. De har egne frie lisenser, se
  [docs/stakk.md](docs/stakk.md).
