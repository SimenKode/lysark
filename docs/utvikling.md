# For deg som vil bygge Lysark selv

Denne sida er for den som vil bygge, endre eller se inn i programmet.
Skal du bare bruke det, holder [forsiden](../README.md).

## Kommandoer

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

```bash
npm run dist:win
```

- `npm run fetch:ffmpeg` henter FFmpeg (én fast utgave, med kontroll av
  sjekksum) til `vendor/ffmpeg/`. Uten det kan programmet ikke lage
  video, og testen for lyd og video hoppes over.
- `npm test` bygger programmet og kjører alle testene, også de som
  starter hele programmet (uten å vise vindu) og går gjennom import av
  PowerPoint, PDF og eksportert HTML, redigering, lagring, innlesing med
  en prøvemikrofon, klipping, «Lær mer» og video under innlesing,
  tidslinja med musikk, eksport til HTML og video, og avspilling.
  Testene kontakter aldri nettet.
- `npm run dist:linux` lager AppImage-fila i `release/`.
- `npm run dist:win` lager zip-utgaven og installasjonsfila for Windows
  i `release/`. Det kan gjøres på Linux, og trenger da NSIS
  (`sudo apt install nsis`). Installasjonsfila lages av
  `tools/windows-installer.mjs`.
- Til en utgivelse hentes også kildekoden til FFmpeg med
  `npm run fetch:ffmpeg-source`, og legges ved utgivelsen (se
  [stakk.md](stakk.md)).

## Dokumenter

| Fil | Innhold |
| --- | --- |
| [HANDOFF.md](../HANDOFF.md) | Kort status: hva programmet kan, hva som er bestemt, og hva som står for tur |
| [historikk.md](historikk.md) | Loggen: alt som er bygget og prøvd i detalj, og tilbakemeldingene |
| [AGENTS.md](../AGENTS.md) | Reglene alle som arbeider i prosjektet skal følge |
| [plan.md](plan.md) | Planen, og hva som er med i hver del |
| [stakk.md](stakk.md) | Valgt teknologi, begrunnelse og lisens per avhengighet |
| [prosjektformat.md](prosjektformat.md) | Prosjektformatet (lysark, elementer, tidslinje) |
| [sporsmal-leveranse-1.md](sporsmal-leveranse-1.md), [sporsmal-videre.md](sporsmal-videre.md) | Designspørsmålene, med svar |
| [LICENSE](../LICENSE), [EXPORT-EXCEPTION.md](../EXPORT-EXCEPTION.md) | Lisensen, og unntaket for forelesninger du eksporterer |

Hva som er prøvd, på hvilket system, og hva som ikke er prøvd, står i
HANDOFF.md (kort) og historikk.md (i detalj).

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
| `tools/` | Hjelpeskript: hente FFmpeg, lage installasjonsfila for Windows, og styre Windows-VM-en under utprøving |
| `docs/bilder/` | Bildene på forsiden. De er tatt av testene, med prøveinnhold og uten logo |

Ikke i git: `merkevare/` (USNs logopakke), `eksempler/` (ekte
forelesninger), `vendor/ffmpeg/` (FFmpeg), `build/licenses/`
(lisenstekster samlet for en utgivelse), `release/` (ferdige
installasjonsfiler). USNs logo og avslutningsanimasjon ligger i
programmets egne innstillinger på din maskin, aldri i repoet.

## Lisens

Lysark er fri programvare: du kan bruke, endre og dele det videre etter
[GNU General Public License](../LICENSE), versjon 3 eller senere. Deler
du en endret utgave av programmet, må kildekoden følge med på samme
vilkår. Programmet kommer uten noen garanti.

En eksportert HTML-fil inneholder spilleren fra Lysark. Et uttrykkelig
unntak ([EXPORT-EXCEPTION.md](../EXPORT-EXCEPTION.md)) sier at slike
filer kan deles på de vilkårene foreleseren selv vil, uten at innholdet
blir underlagt GPL.

Lisensen dekker ikke:

- **USNs navn, logo og visuelle profil.** De tilhører Universitetet i
  Sørøst-Norge. Logoen følger ikke med; du må selv ha logopakka fra USN.
- **Skriftene** Liberation Sans og Liberation Serif, som har sin egen
  frie lisens (SIL Open Font License 1.1, se `resources/fonts/LICENSE`).
- **Bibliotekene** programmet bygger på. De har egne frie lisenser, se
  [stakk.md](stakk.md).
- **FFmpeg**, som lager videoen og gjør om lyd. Det er et eget program
  som følger med Lysark (mappa `ffmpeg` blant programfilene), med sin
  egen lisens (GNU GPL versjon 3) og lenke til kildekoden.
