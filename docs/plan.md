# Plan

Lysark er laget **for forelesere**: det skal kunne brukes uten
opplæring. Fem leveranser (valgt 22.11.2026, se
[sporsmal-videre.md](sporsmal-videre.md)). Hver er ferdig og brukbar
alene, uten stubber eller plassholdere. En leveranse begynner først når
designspørsmålene for den er besvart, og er ferdig først når den er
prøvd på både Linux Mint og Windows 11.

| Nr. | Leveranse | Status |
| --- | --- | --- |
| 1 | PPTX-import, tema, redigering og interaktiv HTML | Bygget. Gjenstår: Canvas, godkjenning av uttrykket, installasjonsfil |
| 2 | «Lær mer»-byggeren | Bygget, også endringene eieren ba om (runde 2, under), og prøvd på Linux Mint. Gjenstår: Windows, og Canvas som eieren prøver selv |
| 3 | Lyd og video | Bygget, og prøvd på Linux Mint og Windows 11 (økt 5). Gitt ut som versjon 0.2.0. Etterpå er tidslinje, musikk- og lydspor og «Lær mer» og video under innlesing bygget (23.11.2026, gitt ut som versjon 0.3.0). Gjenstår: en ekte mikrofon |
| 4 | Figurer og bevegelser | Ikke påbegynt |
| 5 | Håndlaget stil | Ikke påbegynt; venter på USNs svar om indigo tavle |

## Leveranse 1: PPTX-import, tema og interaktiv HTML

Du åpner en PPTX, får et utkast i USN-stil, retter det opp, og
eksporterer én HTML-fil studentene kan bruke uten nett.

**Import**
- Tekst (med nivåer, fet, kursiv, lenker), bilder (med beskjæring og
  alternativ tekst), plassering og størrelse, grupper, tabeller, notater
  som manus.
- Plassholdere arver plassering fra layout og mal, slik PowerPoint gjør.
- Importrapport per lysark: hva som kom med, og hva som må lages på nytt
  (SmartArt, diagrammer, animasjoner, bilder i formater som ikke kan
  vises).

**Tema**
- Ren stil ferdig: palett, kontrasttabell, skriftskala, 8 kolonner,
  profilformer på tittel- og seksjonslysark, logo fra originalfilene.
- Temaet er bygd slik at håndlaget stil kan legges til (leveranse 5)
  uten å røre innholdet.

**Redigering**
- Lysarkliste: flytte, kopiere, slette, legge til, endre lysarktype.
- Lysarket: velge, flytte, endre størrelse, feste til rutenett, rekkefølge
  foran og bak, redigere tekst og tekstrolle, tekstmarkering.
- Legge til tekst, bilde, video (fil eller lenke), lenke og
  fordypningsboks.
- Steg: hvilke elementer som kommer inn når.
- Manus per lysark. Angre og gjør om. Lagring og åpning av prosjekt.

**HTML-eksport**
- Én fil, virker uten nett. Skrifter og bilder ligger i fila.
- Tastaturnavigasjon, innholdsoversikt, framdrift, fullskjerm.
- Fordypningsbokser, video, lenker.
- Bygd for universell utforming (WCAG 2.1 AA): tastatur, skjermleser,
  alternativ tekst, kontraster fra manualens tabell.

**Ikke med:** animasjonsmaler, håndlaget stil, lyd, video-eksport.

## Leveranse 2: «Lær mer»-byggeren

Du knytter rik utdyping til hva som helst i et lysark, og studenten åpner
den i et panel.

**Utdyping på alle elementer**
- Alle elementer (tekst, bilde, form, tabell, video) kan ha utdyping:
  en tittel og en liste med byggesteiner. «+ Lær mer» er fortsatt den
  enkle veien inn: en knapp i lysarket med samme slags utdyping.
- Byggesteiner: tekst (overskrifter, lister, markering, lenker), bilde
  (med bildetekst og kreditering), video (fil eller lenke), tabell og
  innbygging. Rekkefølgen kan endres.
- Eldre prosjekter løftes automatisk til det nye formatet.

**Byggeren**
- Et stort vindu over arbeidsflaten: byggesteinene til venstre, panelet
  slik studenten ser det til høyre.
- Veier inn: «+ Lær mer», og «Legg til utdyping» på et valgt element
  (Element-fanen og høyreklikk).

**Spilleren**
- Et lite, rundt «+»-merke i hjørnet av elementet, alltid synlig. Hele
  elementet kan klikkes. Merket er en knapp med navn for skjermleser;
  Enter og mellomrom åpner, Esc lukker og setter fokus tilbake. Hjørnet
  kan velges per element. Merket vises ikke i utskrift (og ikke i video).
- Panelet kan utvides til full bredde.
- «Bildekilder»: oversikt over alle bilder med opphavsperson og lisens.

**Medier**
- Mediedialog med tre faner: «Søk i Wikimedia Commons», «Last opp» og
  «I prosjektet».
- Søket viser bare bilder til fri bruk, CC BY og CC BY-SA. Tittel,
  opphavsperson, lisens og kilde lagres med bildet og vises under det og
  i «Bildekilder». Bildet lastes ned i høyst 2560 px bredde.
- Programmet kontakter nettet bare når du selv søker eller henter et
  bilde (se [AGENTS.md](../AGENTS.md)).

**YouTube og annen innbygging**
- Først bygget i to trinn (stillbilde, og spilleren først ved klikk).
  Endret i runde 2 (under): YouTubes spiller står rett i lysarket.
  «Åpne på YouTube» står alltid ved siden av.
- Annen innbygging: «Innhold fra <vert> – klikk for å laste».
- Forhåndsvisningen vises fra en adresse på din egen maskin
  (`127.0.0.1`), slik at innbygging oppfører seg som i Canvas.
- Stillbilde for en YouTube-lenke hentes når du trykker «Hent
  forhåndsbilde».

**Canvas** prøver du selv, for hånd: skript, innbygging, filstørrelse,
fullskjerm (sjekkliste i historikk.md 6.5).

**Ikke med:** byggesteinen «figur/animasjon» (kommer med leveranse 4),
lyd, video-eksport.

### Status for leveranse 2 (22.11.2026)

Alt over er bygget. Prøvd automatisk på Linux Mint, også med hele
programmet uten vindu: byggeren, mediedialogen, søk og innsetting fra
Commons (med Wikimedia besvart av testen), nettsperren, lagring, og
panelet i spilleren med tastatur og mus.

Prøvd én gang mot ekte nett, på Linux Mint:

- søk i Wikimedia Commons («bro»): 24 treff med bilder, og et innsatt
  bilde fikk tittel, opphavsperson, lisens og kilde
- forhåndsbilde fra YouTube: hentet i 1280 × 720
- YouTube i forhåndsvisningen: videoen spilte
- YouTube i en eksportert fil åpnet rett fra disk: YouTube svarte
  «Error 153». Derfor åpner knappen YouTube i nettleseren når fila er
  åpnet fra disk

Avvik fra det som ble valgt, og hvorfor:

- **Bilder hentes i høyst 1920 px bredde**, ikke 2560. Wikimedia leverer
  bilder i faste bredder, og 1920 er lysarkets bredde.
- **Bare YouTube kjennes igjen som video i to trinn.** Vimeo, Panopto og
  andre videosider er fortsatt et kort som åpner nettleseren når de står
  som video. De kan bygges inn med byggesteinen «Innbygging».

Gjenstår før leveransen er ferdig:

1. **Canvas:** eieren prøver selv, for hånd (sjekkliste i HANDOFF.md
   6.5).
2. **Windows 11:** ingenting av leveranse 2 er prøvd der.
3. Dra-og-slipp av byggesteiner er ikke dekket av automatiske tester
   (knappene «flytt opp» og «flytt ned» er det).

### Runde 2 etter eierens utprøving (22.11.2026)

Eieren prøvde leveranse 2 og bestemte dette (historikk.md 6.14). Alt er
bygget (økt 5) og prøvd automatisk på Linux Mint:

- «Scene» heter «lysark» i alt du og studentene leser.
- Tykkelsen på piler, linjer og omriss kan endres i Element-fanen (1 til
  60), og pilspissen følger med. «Tilbakestill» gir temaets tykkelse.
- Store, runde piler på hver side av lysarket i HTML-spilleren. De står
  ved siden av lysarket, ikke oppå det. På smal skjerm (mobil) står de
  nede i hjørnene.
- Klikk på lysarket går ikke videre; det er pilene, tastaturet og sveip
  som gjør det.
- Pil opp og pil ned navigerer. Står fokus i et panel (innhold, manus,
  «Lær mer»), ruller de panelet i stedet.
- YouTube er innebygd som YouTubes spiller i lysarket og i «Lær
  mer»-panelet. Den hentes fra `youtube-nocookie.com` når lysarket
  vises eller panelet åpnes, starter ikke av seg selv, og tas bort når
  man går videre. Åpnet rett fra disk blir stillbildet stående med en
  knapp som åpner YouTube, fordi YouTube ikke spiller der. I
  redigeringen vises bare stillbildet.
- `thumb.wikimedia.org` er på lista over verter.

Annen innbygging enn YouTube er uendret: «klikk for å laste». Det
bekreftet eieren 22.11.2026.

**Navn** (bestemt 22.11.2026, byttet i programmet i økt 5): «Utdyping»
heter «Lær mer», «Byggestein» heter «Innhold», «Innbygging» heter
«Nettside», «Tilpass til rutenett» heter «Rydd opp lysarket», og «Pakk
prosjektet til én fil» heter «Lagre som én fil». Beskrivelsen av
leveranse 2 over bruker de gamle ordene, slik planen ble skrevet.

Eieren vil også ha flere animasjoner og mer lekenhet, USNs
avslutningsanimasjon som et innebygd forslag til avslutning, og flere
kilder til frie bilder. Det må spørres ut før det bygges (6.14 B).

**Første brukbare utgave** er når leveranse 3 er ferdig: da finnes både
HTML og video. Til da var repoet privat; eieren åpnet det 23.11.2026
(historikk.md 6.23).

## Leveranse 3: Lyd og video

- **Inndata:** prosjekt, PPTX, eksportert HTML («Åpne HTML-fil …» gjør
  en Lysark-eksport til prosjekt igjen) og PDF (hver side blir et lysark
  med siden som bilde; teksten hentes ut som alternativ tekst; lest med
  pdf.js, Apache-2.0).
- **Innspilling fortløpende:** manuset står på skjermen, pil høyre går
  til neste steg eller lysark og setter tidspunktet, og opptaket deles
  ved lysarkgrensene. Nedtelling, nivåmåler, pause, «ta om dette
  lysarket». Lydfil kan også importeres.
- **Tidslinje:** hvert lysark eier sin lyd og sine tidspunkter; over dette
  ligger én tidslinje for hele forelesningen.
- **Grep:** klippe start, slutt og midt i (originalen beholdes), dele,
  legge inn pause, strekke et lysark, flytte tidspunktet for hvert steg,
  ta om, lydstyrke per lysark og jevn styrke ved eksport, rent klipp
  eller kort toning mellom lysark. Ikke musikk, flere lydspor eller
  hastighetsendring.
- **Ut:** MP4 1080p, 30 bilder i sekundet, H.264 og AAC, tegnet bilde
  for bilde mot en virtuell klokke. Teksting som egen WebVTT-fil laget
  av manuset. HTML-fila får «Spill av» med stemmen og stegene på de
  samme tidspunktene. «Bildekilder» som valgfritt siste lysark.
- **FFmpeg:** GPL-bygget med libx264 fra BtbN/FFmpeg-Builds, en fast
  utgave hentet med kontroll av sjekksum, lagt ved programmet som eget
  program med lisenstekst og lenke til kildekoden. Aldri i git.
- **Mikrofon:** bare lyd, aldri kamera. Valg av mikrofon, støydemping
  på, automatisk styrkeregulering av.

### Status for leveranse 3 (22.11.2026, økt 5)

Bygget:

- **Lydpanelet** under lysarket (fanen «Lyd» ved siden av «Manus»): hele
  forelesningen som en stripe av lysark med lengder, og lyden på det
  valgte lysarket som et spor med bølgeform, pauser, steg og spillehode.
- **Innlesing** («Les inn …», Ctrl+R): lysarket og manuset på skjermen,
  valg av mikrofon, nivåmåler, nedtelling, pause, «Ta om dette
  lysarket». Pil høyre går til neste steg (og setter tidspunktet) eller
  neste lysark (og deler opptaket). «Ta om herfra …» beholder lyden fram
  til spillehodet. Lydfiler kan importeres.
- **Redigering:** klipp bort det merkede, starten eller slutten; sett inn
  pause ved spillehodet; endre eller fjern en pause; dra stegene dit de
  skal skje; lydstyrke per lysark; fjern lyden. Alt kan angres, og
  opptakene endres aldri.
- **Video** («Eksporter video …», Ctrl+Shift+E): MP4, 1920 × 1080,
  30 bilder i sekundet, H.264 og AAC. Tegnes bilde for bilde av den samme
  tegnekoden som resten, i et vindu som aldri vises. Rent klipp eller
  kort toning, jevn lydstyrke, og «Bildekilder» som avslutning.
- **Teksting** som egen WebVTT-fil ved siden av videoen, laget av
  manuset.
- **HTML-fila** får stemmen med og en «Spill av»-knapp: stemmen spilles,
  og steg og lysark følger på de samme tidspunktene.
- **Inndata:** «Importer PDF …» (hver side blir et lysark med siden som
  bilde og teksten som alternativ tekst) og «Åpne HTML-fil …» (en
  eksportert Lysark-fil blir prosjekt igjen, også med stemmen).
- **GIF** (bedt om av eieren 22.11.2026): i eksportdialogen velger du
  filtype (video eller GIF) og hvilke lysark (hele forelesningen, bare
  dette lysarket, eller fra og til). En GIF er uten lyd, 480, 640 eller
  960 piksler bred, 12,5 bilder i sekundet, og høyst to minutter.
- **FFmpeg** 9.0.2 (GPL-bygget fra BtbN, utgaven fra 31.10.2026) hentes
  av `tools/fetch-ffmpeg.mjs` med kontroll av sjekksum, og legges ved
  programmet i mappa `ffmpeg` med lisenstekst og lenke til kildekoden.

Slik ble det, der det avviker fra eller presiserer planen:

- **PDF-sidene lagres som WebP**, ikke PNG: skarpe, og en femtedel så
  store. En tittel som går over to linjer i PDF-en, blir bare første
  linje, og må rettes for hånd.
- **Åpnes en HTML-fil med stemme som prosjekt**, er klipp og pauser
  slått sammen til ett opptak per lysark, og mediefiler som lå ubrukt i
  prosjektet, er ikke med.

- **Tekstingen er beregnet, ikke lyttet fram.** Manuset til et lysark
  deles i korte biter og fordeles over tiden det snakkes, etter
  tekstens lengde. Leser du i jevnt tempo, stemmer det godt; hopper du
  over noe eller snakker fritt, stemmer det dårligere.
- **Video inne i et lysark vises som stillbilde i MP4-fila** (første
  bilde, eller forhåndsbildet). Det samme gjelder bilder som beveger seg
  (animert GIF). YouTube vises som stillbildet sitt. USNs
  logoanimasjon på siste lysark starter fra hvitt, så den blir et hvitt
  bilde.
- **GIF har 12,5 bilder i sekundet**, ikke 15: en GIF angir tid i
  hundredeler, og bare en rate som går opp i hundre, gir riktig lengde.
- **«Dele» er ikke en egen knapp.** Å sette inn en pause eller klippe
  deler lyden der det trengs.
- **Lysark uten lyd** står i 5 sekunder, pluss 2 per steg. En pause
  bestemmer lengden.
- **Jevn lydstyrke gjelder videoen.** I HTML-fila brukes lydstyrken du
  har satt per lysark.
- **Lyden lagres ukomprimert** (WAV, omtrent 6 MB per minutt), så
  klipping er nøyaktig. I HTML-fila og videoen er den komprimert.

Prøvd automatisk på Linux Mint, også med hele programmet uten vindu:
innlesing med nettlesermotorens innebygde prøvemikrofon (piper),
tidspunkt på steg fra piltasten, bølgeform, avspilling, klipping,
videoeksport (kontrollert med FFmpeg: H.264, 1920 × 1080, 30 bilder i
sekundet, AAC, riktig lengde, riktig første bilde), teksting, og
HTML-fila som spiller seg selv. En video av Stål (26 lysark, 2:10, uten
lyd) ble laget på 40 sekunder og sett på.

Prøvd for hånd på Windows 11 (eierens VM): innlesing (med stille
inndata), pause, angre, avspilling, video med FFmpeg, og HTML-fila med
«Spill av» i Edge. Detaljer og funn står i historikk.md 6.17.

En lang forelesning (41 lysark med ett minutt kunstig lyd hver) ble til
video på 9 minutter og HTML på et halvt minutt.

Ikke prøvd ennå: en ekte mikrofon (verken på Linux eller Windows), en
hel forelesning lest inn i ett strekk, og «Spill av» i andre nettlesere
enn den innebygde og Edge.

### Runde 2 av leveranse 3 (22.11.2026)

Etter at eieren hadde prøvd utgaven med lyd og video (historikk.md
6.19). Bygget:

- **Skiltformen** (rektangel med spiss), også i importen fra PowerPoint.
- **«Lær mer» som en boks på selve lysarket:** den spretter ut ved
  elementet og skyver ikke lysarket til siden. Byggeren viser lysarket
  med boksen på plass. Bilder med «Lær mer» får lilla ramme.
- **Knappene:** ingen «…», og egne ikoner der et tegn hjelper.
- **Mer liv:** lysark glir inn, steg glir på plass (også i video),
  merker og knapper svarer. Slås av for dem som vil ha lite bevegelse.
- **USNs avslutningsanimasjon** som et lysark som spiller av seg selv,
  også i video. Filmen tas vare på i innstillingene, aldri i git.
- **Lisenstekstene** til alt som er bygd inn, følger med programmet.
- **Versjon 0.2.0** er gitt ut.

### Tidslinje, flere lydspor, og «Lær mer» og video under innlesing

Bedt om av eieren 22.11.2026. Han svarte «som anbefalt» på de fire
spørsmålene (historikk.md 6.19), og alt er **bygget 23.11.2026**
(historikk.md 6.20 og 6.21):

- **Under innlesing** kan «Lær mer»-bokser åpnes og videofiler spilles
  ved å trykke på lysarket. Tidspunktene huskes, og videoen og «Spill
  av» i HTML-fila gjør det samme på samme tid. Lyden fra videoene er med
  i videofila.
- **To lydspor til**, «Musikk» og «Lyd», som går over hele
  forelesningen. Klipp kan flyttes, kortes inn, deles, tones inn og ut
  og få egen lydstyrke. Musikken dempes til en fjerdedel mens noen
  snakker (kan slås av).
- **Tidslinje**: en fane med lysarkene på rad etter lengde og sporene
  Stemme, Musikk og Lyd under. Hele forelesningen kan spilles av, og et
  lysark kan stå lenger eller kortere ved å dra i kanten.

Utenfor, med vilje: YouTube-videoer i videofila (vi har ikke fila), og
medfølgende musikk (eieren legger inn sin egen).

## Leveranse 4: Figurer og bevegelser

- En figur er statisk til delene får steg; samme bygger for begge.
- Maler med skjema: merket bilde, prosess, lagvis oppbygging,
  sammenligning, tidslinje, søyle- og linjediagram. Venndiagram og
  årsak-virkning etterpå ved behov. Malene starter tomme.
- Fri figur: bokser, ellipser, piler, koblingslinjer og etiketter som
  holdes sammen som ett element.
- Bevegelser: tone inn, gli inn, tegne strek, vokse, markere, telle opp,
  forsvinne, og zoome inn på et utsnitt.
- Figurer kan brukes i lysark, i «Lær mer» (egen byggestein) og i video.

## Leveranse 5: Håndlaget stil

- De samme formene med kullstrek over, på lys beige papir. Indigo tavle
  legges inn som variant hvis USN godkjenner den.
- Bytte mellom stilene med ett valg, uten at innholdet endres.

## Status for leveranse 1 (22.11.2026)

Bygd og prøvd automatisk på Linux Mint:

- import av PPTX til prosjektmappe, med rapport
- ren stil med palett, kontrasttabell, skriftskala, 8 kolonner og
  profilformer
- redigering: lysark, elementer, tekst i lysarket, tabeller, video,
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
2. **Godkjenning av uttrykket** på dine egne lysark.
3. **Restavvikene i importen** som står under «Kjente begrensninger».
4. **Windows-installasjonsfil.** Bare zip-utgaven finnes.

### Prøvd på Windows 11

Zip-utgaven er prøvd for hånd i eierens Windows 11-VM 22.11.2026: start,
import av en ekte forelesning, logo fra logopakka, tekstredigering,
lagring, forhåndsvisning, eksport og avspilling i Edge virket. Detaljer og
det som ikke ble prøvd, står i [historikk.md](historikk.md). Endringene i
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
  importeres lysarket uten logo, med en merknad. Logoen kan slås på igjen
  under «Vis USNs logo».
- Tabeller mister fyllfarger, kantlinjer, radhøyder og justering per
  celle, og hele tabellen får én skriftstørrelse. En tabell med svært
  lave rader eller blandede størrelser kan derfor bli høyere enn i
  PowerPoint og gå inn i det som står under.
- Avstand mellom avsnitt og linjeavstand følger temaet, ikke
  PowerPoint. Teksten blir derfor litt tettere i høyden.
- Lenker på hele former og bilder følger ikke med, bare lenker i tekst.

Rettet i økt 3:

- **Miniatyrene i lysarklista** stakk ut av boksen sin. De fyller nå
  plassen de har, uansett rullefelt.
- **Videolenker** viser stillbildet sitt, og lenkekortet er lesbart i
  «Lær mer»-panelet.
- **Video som ikke kan vises** (for eksempel kodet som H.265) gir en
  melding i stedet for en svart spiller, både når fila legges inn og når
  den spilles.

## Rekkefølgen videre

Eieren valgte anbefalingene 22.11.2026 (historikk.md 6.14). Leveranse 1,
2 og 3 er bygget. Det som står for tur:

1. **Det eieren melder** etter å ha prøvd mikrofon, video, musikk og
   Canvas. «Lær mer» og video under innlesing, tidslinje og flere
   lydspor, mer liv og lekenhet og USNs avslutningsanimasjon, som sto
   her, er bygget.
2. **Flere bildekilder**, Openverse først, når resten sitter.
3. **Leveranse 4** (figurer og bevegelser), så **leveranse 5** (håndlaget
   stil).
4. Uttrykket (historikk.md 6.1) godkjennes når eieren har sett på det;
   det er et tema og kan endres uten å røre innholdet.
5. Tabeller i importen rettes når eieren har pekt på lysark som plager
   ham.
