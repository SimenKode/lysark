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
uten feil. I økt 1 ble Introduksjonen og de tjue første lysarkene om
betong sammenlignet side om side med PDF-utgavene. I økt 2 ble alle 315
sammenlignet, før og etter rettingene under. PDF-en til Praktisk HMS er
eldre enn PPTX-en (ett lysark mangler og to har byttet plass), så der er
tekstforskjeller ikke nødvendigvis feil.

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
  Arial, så løpende tekst importeres mindre. Da blir linjeskiftene som i
  PowerPoint, og teksten holder seg i boksene. Faktoren 0,9 ble
  kontrollmålt i økt 2 på 1313 linjer fra PDF-utgavene: da er 85 % av
  linjene ikke bredere enn i PowerPoint. Skriftstørrelsen avrundes nå til
  tidels piksler (før hele, som ga 65 %).
- Tabeller delte tall over to linjer («B10» ble «B1» og «0»). Tabeller
  deler aldri ord eller tall lenger.
- Overskriftsrader som er laget ved å fargelegge første rad for hånd,
  kjennes igjen.

Rettet i økt 2, etter at alle 315 lysark ble sammenlignet med
PDF-utgavene:

- **Mellomrom og tabulatorer.** Forelesningene bruker dem mye for å
  skyve ord ned på neste linje, rundt bilder (57 tekstbiter med
  tabulator, 66 med flere mellomrom på rad). Før ble de slått sammen til
  ett mellomrom, og teksten havnet under bildene. Nå blir en rekke på tre
  eller flere mellomrom og tabulatorer mellom to ord (eller to, der én er
  en tabulator) et linjeskift: målt mot PDF-ene brøt PowerPoint linjen
  ved hver eneste av dem (46 av 46). Kortere mellomrom beholdes som de
  er.
- **Tekstmarger** fra PowerPoint følges. Før lå teksten helt ut i kanten
  av boksen, og korte etiketter i små bokser ble brutt midt i ordene.
  Former med tekst har nå PowerPoints indre marg, og egne marger (for
  eksempel null) følger med.
- **Størrelse per listenivå** følger PowerPoint. USNs mal gir
  underpunkter samme størrelse som hovedpunkter; før ble de en tidel
  mindre.
- **Avstand mellom avsnitt og linjeavstand** følger PowerPoint. Før la
  Lysark inn luft mellom alle punkter, og tette lysark ble for høye.
- **Innrykk** per listenivå følger PowerPoint. Før rykket Lysark inn
  underpunkter mer enn malen, og linjene ble kortere enn i PowerPoint.
- **Nummererte lister** fortsetter forbi underpunkter (1., 2., 3. i
  stedet for 1., 1., 1.).
- **Loddrett tekst** blir dreid tekst, både i tekstbokser og i fylte
  former (etiketter som «Mest effektiv»). Før ble den vannrett og brutt
  opp i enkeltbokstaver.
- **Buede og knekte blokkpiler** tas ikke med i stedet for å bli store
  rektangler over bildene. Frihåndsstreker som bare er én rett strek
  (for eksempel røde kryss over tegninger), blir linjer.
- **Lysere og mørkere nyanser** av farger regnes ut før nærmeste
  profilfarge velges. Før kunne «indigo, lysere 80 %» bli mørk indigo.
- **Gul utheving** blir profilens tekstmarkering.
- **Senket og hevet skrift** følger med (CO₂, m², symboler med
  indeks), også når teksten redigeres. Før ble «CO₂» til «CO2».
- **Symboler fra Symbol-skriften** (for eksempel λ) blir de riktige
  tegnene. Før ble de tomme firkanter.
- **Bokstav- og romertallslister** (a., b., c.) beholder nummereringen.
  Før ble de 1., 2., 3.
- **Hvit utheving** (39 steder i Lovverk) tas ikke med; den syns ikke på
  et hvitt lysark og ble før til synlig markering.
- **Håndskrift** fra PowerPoints penn og markeringstusj (Lovverk) tegnes
  slik at teksten under syns, som i PowerPoint. Før dekket tusjstrekene
  ordene.
- **Tekst i former** beholder justeringen fra PowerPoint (venstre,
  midtstilt, høyre; topp, midten, bunn). Før ble den alltid midtstilt.
- **Cellemarger i tabeller** følger PowerPoint. Tette tabeller med smale
  marger ble før mye høyere enn i PowerPoint.
- **Logoen** slås av der innhold ligger på plassen dens, med merknad.

Det filene viste om innholdet:

- **Ingen av forelesningene har notater.** Manus må derfor skrives i
  Lysark; importen har ingenting å hente.
- **Omtrent tre av fire bilder mangler alternativ tekst** (428 av 581).
  Den må skrives for at HTML-fila skal være universelt utformet.
- **Video er mest lenker** til YouTube og Vimeo (20 stykker). De vises
  som et kort som åpnes i nettleseren, med stillbildet PowerPoint hadde
  lagret for videoen (økt 3; før var kortet en ensfarget flate). Én forelesning har en lokal
  video på 112 MB, som legges ved siden av HTML-fila ved eksport. Siste
  lysark i hver forelesning er USNs logoanimasjon som video.
- SmartArt finnes på 6 lysark, formler på 2, og 32 lysark har former som
  er forenklet til rektangler.

Gjenstår før leveransen er ferdig:

1. **Canvas.** HTML-fila er ikke prøvd der.
2. **Godkjenning av uttrykket** på dine egne scener.
3. **Restavvikene i importen** som står under «Kjente begrensninger».
4. **Windows-installasjonsfil.** Bare zip-utgaven finnes.

### Prøvd på Windows 11

Zip-utgaven er prøvd for hånd i eierens Windows 11-VM 22.11.2026: start,
import av en ekte forelesning, logo fra logopakka, tekstredigering,
lagring, forhåndsvisning, eksport og avspilling i Edge virket. Detaljer og
det som ikke ble prøvd, står i [HANDOFF.md](../HANDOFF.md). Endringene i
importen fra økt 2 er ikke prøvd på Windows ennå.

Kjente begrensninger i importen (kommer i rapporten der det er relevant):

- SmartArt, diagrammer og innebygde objekter følger ikke med.
- Formler blir bilder av hele tekstboksen, ikke redigerbar matematikk.
- Bilder i EMF, WMF og TIFF følger ikke med.
- Farger blir nærmeste profilfarge. Lysere og mørkere nyanser (som
  «lysere 80 %») regnes ut først, men nyanser som ligger nær hverandre,
  kan fortsatt bli samme profilfarge.
- Former utover rektangel, ellipse, linje og pil forenkles til
  rektangler. Buede koblinger og åpne, buede frihåndsstreker blir rette
  linjer fra start til slutt. Buede, knekte og doble
  blokkpiler tas ikke med, fordi et rektangel på plassen deres ville
  dekket det de peker på; rapporten sier fra.
- Fylte former mister omrisset, fordi temaet har flate former uten
  kantlinje.
- Tekst og bilder som ligger i PowerPoint-malen (ikke på lysarket)
  følger ikke med; temaet bestemmer bakgrunn og logo.
- Der et bilde, en form eller en bildetekst ligger på logoens plass,
  importeres scenen uten logo, med en merknad. Logoen kan slås på igjen
  under «Vis USNs logo».
- Tabeller mister fyllfarger, kantlinjer, radhøyder og justering per
  celle, og hele tabellen får én skriftstørrelse. En tabell med svært
  lave rader eller blandede størrelser kan derfor bli høyere enn i
  PowerPoint og gå inn i det som står under.
- Avstand mellom avsnitt og linjeavstand følger temaet, ikke
  PowerPoint. Teksten blir derfor litt tettere i høyden.
- Lenker på hele former og bilder følger ikke med, bare lenker i tekst.

Rettet i økt 3:

- **Miniatyrene i scenelista** stakk ut av boksen sin. De fyller nå
  plassen de har, uansett rullefelt.
- **Videolenker** viser stillbildet sitt, og lenkekortet er lesbart i
  «Lær mer»-panelet.
- **Video som ikke kan vises** (for eksempel kodet som H.265) gir en
  melding i stedet for en svart spiller, både når fila legges inn og når
  den spilles.

## Rekkefølgen videre

1. Eieren skriver tilbakemeldinger i [HANDOFF.md](../HANDOFF.md).
2. Uttrykket godkjennes, og HTML-fila prøves i Canvas.
3. Eieren kom 22.11.2026 med tre ønsker for det som gjenstår (se
   HANDOFF.md, 6.9 og 6.10). Designspørsmålene er stilt i
   [sporsmal-videre.md](sporsmal-videre.md) (økt 3), med forslag til
   fem leveranser: «Lær mer»-byggeren (2), lyd og video (3), figurer og
   bevegelser (4) og håndlaget stil (5). **Forslaget gjelder ikke før
   eieren har svart;** til da står leveranse 2 og 3 over slik de ble
   skrevet, og ingenting av dem er bygget. De tre ønskene:
   - **En rik bygger for «Lær mer»:** utdyping knyttet til hvilket som
     helst element i scenen, et større byggepanel, en mediedialog med
     bildesøk i Wikimedia Commons og opplasting, og YouTube som virker i
     forhåndsvisningen. Bildesøket krever at regelen om at programmet
     aldri kontakter nettet, endres eksplisitt.
   - **Figurer og animasjoner,** også statiske figurer (leveranse 2).
   - **Video integrert dypt:** forelesningen gjøres om til HTML, så leses
     voice-over inn, og det redigeres enkelt (klippe lyd, strekke ut
     scener). Videoarbeidet skal kunne starte fra et prosjekt, en
     eksportert HTML-fil, en PPTX eller en PDF (leveranse 3, utvidet).
