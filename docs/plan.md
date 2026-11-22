# Plan

Tre leveranser. Hver er ferdig og brukbar alene, uten stubber eller
plassholdere. En leveranse begynner først når designspørsmålene for den
er besvart, og er ferdig først når den er prøvd på både Linux Mint og
Windows 11.

## Leveranse 1: PPTX-import, tema og interaktiv HTML

Du åpner en PPTX, får et utkast i USN-stil, retter det opp, og
eksporterer én HTML-fil studentene kan bruke uten nett.

**Import**
- Tekst (med nivåer, fet, kursiv, lenker), bilder (med beskjæring og
  alternativ tekst), plassering og størrelse, grupper, tabeller, notater
  som manus.
- Plassholdere arver plassering fra layout og mal, slik PowerPoint gjør.
- Importrapport per scene: hva som kom med, og hva som må lages på nytt
  (SmartArt, diagrammer, animasjoner, bilder i formater som ikke kan
  vises).

**Tema**
- Ren stil ferdig: palett, kontrasttabell, skriftskala, 8 kolonner,
  profilformer på tittel- og seksjonsscener, logo fra originalfilene.
- Temaet er bygd slik at håndlaget stil kan legges til i leveranse 2 uten
  å røre innholdet.

**Redigering**
- Sceneliste: flytte, kopiere, slette, legge til, endre scenetype.
- Scenen: velge, flytte, endre størrelse, feste til rutenett, rekkefølge
  foran og bak, redigere tekst og tekstrolle, tekstmarkering.
- Legge til tekst, bilde, video (fil eller lenke), lenke og
  fordypningsboks.
- Steg: hvilke elementer som kommer inn når.
- Manus per scene. Angre og gjør om. Lagring og åpning av prosjekt.

**HTML-eksport**
- Én fil, virker uten nett. Skrifter og bilder ligger i fila.
- Tastaturnavigasjon, innholdsoversikt, framdrift, fullskjerm.
- Fordypningsbokser, video, lenker.
- Bygd for universell utforming (WCAG 2.1 AA): tastatur, skjermleser,
  alternativ tekst, kontraster fra manualens tabell.

**Ikke med:** animasjonsmaler, håndlaget stil, lyd, video-eksport.

## Leveranse 2: Animasjonsmaler og begge stiler

- Åtte maler: tidslinje, prosess, årsak-virkning, venndiagram,
  søylediagram, linjediagram, lagvis oppbygging, sammenligning.
- Hver mal har et skjema for innholdet. Malen legger ut delene, og hver
  del kan flyttes og justeres for hånd etterpå. Hver del kan få sitt eget
  steg.
- Bevegelser: tone inn, gli inn, tegne strek, vokse, markere, telle opp.
- Håndlaget stil: de samme formene med kullstrek over, på lys beige
  papir. Indigo tavle legges inn som variant hvis USN godkjenner den.
- Bytte mellom stilene med ett valg, uten at innholdet endres.
- Malene virker i HTML-eksporten fra leveranse 1.

## Leveranse 3: Innspilling og MP4

- Innspilling per scene i programmet, med nedtelling, nivåmåler, ta om
  igjen og klipping av start og slutt. Lydfil kan også importeres.
- Manus vises mens du leser inn.
- Ett tastetrykk under innspilling setter tidspunktet for neste steg.
  Tidspunktene kan finjusteres på en tidslinje etterpå.
- Eksport: bilde for bilde mot en virtuell klokke, kodet med FFmpeg til
  MP4 1080p med lyd. Ikke skjermopptak.
- Teksting laget av manuset følger med videoen.
- Innlest lyd kan også følge med HTML-fila.

## Status for leveranse 1 (22.11.2026)

Bygd og prøvd automatisk på Linux Mint:

- import av PPTX til prosjektmappe, med rapport
- ren stil med palett, kontrasttabell, skriftskala, 8 kolonner og
  profilformer
- redigering: scener, elementer, tekst i scenen, tabeller, video,
  fordypningsbokser, steg, manus, angre og gjør om
- forhåndsvisning og eksport til én HTML-fil
- spilleren: tastatur, klikk, sveip, innhold, manus, fordypningspanel,
  hjelp, fullskjerm og utskrift
- USNs logo, hentet uendret fra logopakka (norsk og engelsk, lilla og
  hvit)

### Prøvd mot de ekte forelesningene

Alle de åtte forelesningene i PB1020 (315 lysark) og malfila importeres
uten feil. Introduksjonen og de tjue første lysarkene om betong er
sammenlignet side om side med PDF-utgavene. Etter rettingene under
stemmer tekst, linjeskift, bilder og tabeller godt overens.

Det de ekte filene avslørte, og som er rettet:

- Forelesningene bruker USNs PowerPoint-mal, som ikke merker hva slags
  lysark det er. Tittel-, seksjons- og avslutningslysark kjennes nå igjen
  på navnet på oppsettet («Tittellysbilde», «Deloverskrift»,
  «Avslutningsside»).
- Malens eget logobilde på tittellysarket tas ikke med; temaet setter inn
  logoen.
- Tekstbokser med formler mistet teksten. PowerPoint lagrer et bilde av
  hele boksen, og det brukes nå, slik at formlene blir nøyaktig som i
  PowerPoint. Boksen kan da ikke redigeres, og rapporten sier fra.
- Lysarkene er satt opp med Calibri (PowerPoint bytter til den når
  profilskriften Maison Neue ikke er installert). Calibri er smalere enn
  Arial, så løpende tekst importeres en tidel mindre. Da blir
  linjeskiftene som i PowerPoint, og teksten holder seg i boksene.
- Tabeller delte tall over to linjer («B10» ble «B1» og «0»). Tabeller
  deler aldri ord eller tall lenger.
- Overskriftsrader som er laget ved å fargelegge første rad for hånd,
  kjennes igjen.

Det filene viste om innholdet:

- **Ingen av forelesningene har notater.** Manus må derfor skrives i
  Lysark; importen har ingenting å hente.
- **Omtrent tre av fire bilder mangler alternativ tekst** (428 av 581).
  Den må skrives for at HTML-fila skal være universelt utformet.
- **Video er mest lenker** til YouTube og Vimeo (20 stykker). De vises
  som en lenke som åpnes i nettleseren. Én forelesning har en lokal
  video på 112 MB, som legges ved siden av HTML-fila ved eksport. Siste
  lysark i hver forelesning er USNs logoanimasjon som video.
- SmartArt finnes på 6 lysark, formler på 2, og 32 lysark har former som
  er forenklet til rektangler.

Gjenstår før leveransen er ferdig:

1. **Canvas.** HTML-fila er ikke prøvd der.
2. **Godkjenning av uttrykket** på dine egne scener.
3. **De øvrige lysarkene.** Bare 30 av 315 er sett på side om side.
4. **Windows-installasjonsfil.** Bare zip-utgaven finnes.

### Prøvd på Windows 11

Zip-utgaven er prøvd for hånd i eierens Windows 11-VM 22.11.2026: start,
import av en ekte forelesning, logo fra logopakka, tekstredigering,
lagring, forhåndsvisning, eksport og avspilling i Edge virket. Detaljer og
det som ikke ble prøvd, står i [HANDOFF.md](../HANDOFF.md).

Kjente begrensninger i importen (kommer i rapporten der det er relevant):

- SmartArt, diagrammer og innebygde objekter følger ikke med.
- Formler blir bilder av hele tekstboksen, ikke redigerbar matematikk.
- Bilder i EMF, WMF og TIFF følger ikke med.
- Farger blir nærmeste profilfarge; lyse og mørke varianter av samme
  farge kan bli like.
- Former utover rektangel, ellipse, linje og pil forenkles til
  rektangler. Buede koblinger blir rette.
- Tekst og bilder som ligger i PowerPoint-malen (ikke på lysarket)
  følger ikke med; temaet bestemmer bakgrunn og logo.
- Tabeller mister fyllfarger, kantlinjer, radhøyder og justering per
  celle.
- Avstand mellom avsnitt følger temaet, ikke PowerPoint.
- Lenker på hele former og bilder følger ikke med, bare lenker i tekst.

## Rekkefølgen videre

1. Eieren skriver tilbakemeldinger i [HANDOFF.md](../HANDOFF.md).
2. Uttrykket godkjennes, og HTML-fila prøves i Canvas.
3. Leveranse 2.
