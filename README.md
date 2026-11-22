# Lysark

Skrivebordsprogram som gjør en PowerPoint-forelesning (PPTX) om til

1. en interaktiv HTML-fil som virker uten nett, og
2. en animasjonsvideo (MP4, 1080p) med innspilt voice-over (kommer i
   leveranse 3),

begge i USNs visuelle profil. Programmet skal virke på Windows 11 og
Linux Mint / Ubuntu.

## Status

Leveranse 1 er bygd: PPTX-import, USN-tema (ren stil), redigering og
eksport til én HTML-fil. Den er prøvd automatisk på Linux Mint, og
importen er prøvd mot åtte ekte forelesninger. Det som gjenstår før
leveransen kan kalles ferdig, står i [docs/plan.md](docs/plan.md):
utprøving på Windows 11 og i læringsplattformen, og godkjenning av
uttrykket.

## Slik bruker du programmet

1. **Importer PowerPoint.** Velg PPTX-fila, og deretter hvor prosjektet
   skal ligge. Lysark lager en mappe med `prosjekt.json` og `media/`.
2. **Les importrapporten.** Den sier hva som kom med, og hva som må lages
   på nytt (SmartArt, diagrammer, animasjoner, bilder i formater som ikke
   kan vises). Merknadene står også på hver scene.
3. **Rett opp scenene.** Klikk for å velge, dra for å flytte,
   dobbeltklikk for å skrive. «Tilpass til rutenett» (fanen Scene) rydder
   en scene inn i de åtte kolonnene.
4. **Legg inn steg** (fanen Steg) for det som skal komme inn ett for ett.
5. **Forhåndsvis** (F5) viser nøyaktig det en eksport vil inneholde.
6. **Eksporter HTML.** Resultatet er én fil. Videoer over 20 MB legges i
   en mappe ved siden av fila, og programmet sier fra når det skjer.

USNs logo hentes fra logopakka: under Innstillinger velger du mappa der
pakka er pakket ut, og Lysark finner hovedlogoen i lilla og hvit, på norsk
og engelsk.

## For utvikling

```bash
npm install
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

`npm test` bygger programmet og kjører alle testene, også to som starter
hele programmet (uten å vise vindu) og går gjennom import, redigering,
lagring, eksport og avspilling.

## Dokumenter

| Fil | Innhold |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Reglene alle som arbeider i prosjektet skal følge |
| [docs/plan.md](docs/plan.md) | De tre leveransene og hva som er med i hver |
| [docs/stakk.md](docs/stakk.md) | Valgt teknologi, begrunnelse og lisens per avhengighet |
| [docs/prosjektformat.md](docs/prosjektformat.md) | Prosjektformatet (scener, elementer, tidslinje) |
| [docs/designmanual.md](docs/designmanual.md) | Det som gjelder fra USNs designmanual, og hvordan programmet følger det |
| [docs/sporsmal-leveranse-1.md](docs/sporsmal-leveranse-1.md) | Designspørsmålene for leveranse 1, med svar |

## Mapper

| Mappe | Innhold |
| --- | --- |
| `src/shared/` | Format, tema og tegnekode som alle deler bruker |
| `src/importer/` | PPTX-import |
| `src/player/` | Spilleren som skrives inn i HTML-fila |
| `src/exporter/` | Bygger HTML-fila |
| `src/main/`, `src/preload/` | Programmets hovedprosess og broen til grensesnittet |
| `src/renderer/` | Redigeringsprogrammet |
| `resources/fonts/` | Liberation Sans og Serif, uendret, med lisens |
| `tests/` | Tester |

Ikke i git: `merkevare/` (USNs logopakke), `eksempler/` (ekte
forelesninger), `release/` (ferdige installasjonsfiler).
