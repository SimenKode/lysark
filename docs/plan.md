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

## Rekkefølgen i leveranse 1

1. Svar på spørsmålene i
   [sporsmal-leveranse-1.md](sporsmal-leveranse-1.md).
2. Logopakke og to–tre ekte forelesninger på plass (utenfor git).
3. Importen prøves mot de ekte filene. Det avgjør hva importrapporten må
   dekke.
4. Temaet vises fram på dine egne scener, så uttrykket kan godkjennes
   før resten bygges rundt det.
5. Redigering, så HTML-eksport.
6. Utprøving på Linux Mint og Windows 11, og i læringsplattformen.
