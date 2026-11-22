# Handoff: Lysark etter leveranse 2

Skrevet 22.11.2026 og holdt oppdatert gjennom økt 2, 3, 4 og 5. Sist
endret i økt 5, etter at A1–A6 i 6.14 var bygget (se 6.15).

## Start her

1. Les [AGENTS.md](AGENTS.md). Reglene er bindende, og flere ble endret
   av eieren 22.11.2026.
2. Les [6.14](#614-eieren-har-prøvd-leveranse-2-22112026): eierens
   tilbakemelding etter utprøvingen, ordrett, og hva den betyr.
3. Les [del 7](#7-arbeidsordre-for-neste-økt): det som skal bygges, i
   rekkefølge, og hva som må spørres om først.
4. Resten av fila er historikk og bakgrunn. Slå opp ved behov.

**Kort status:** leveranse 1 (PPTX til HTML) og 2 («Lær mer»-byggeren)
er bygget og prøvd på Linux Mint. Eieren har prøvd leveranse 2 og sier
«mye bra», men vil ha endringer i navn, navigasjon, YouTube og former,
og mer animasjon og lekenhet. Målet nå er en første brukbar utgave med
**både HTML og video**. Repoet ligger privat på GitHub til den finnes.

**Økt 2 i korte trekk:** del 6 var ikke fylt ut, så ingenting i
uttrykket (6.1) er endret, og leveranse 2 er ikke påbegynt. Økten
sammenlignet i stedet alle 315 lysark med PDF-utgavene og rettet
importen der den bommet (se [del 4](#4-hva-de-ekte-forelesningene-viste)).
Valgene som ble tatt underveis, står i [6.8](#68-valg-tatt-i-økt-2).
Etter økten ga eieren tilbakemelding i chat, med retning for neste økt:
se [6.9](#69-eierens-tilbakemelding-i-chat-etter-økt-2-22112026) («Lær
mer»-byggeren) og [6.10](#610-mer-fra-eieren-samme-dag-figurer-animasjon-og-video)
(figurer, animasjon og video).

## 1. Hvor ting er

| Hva | Hvor |
| --- | --- |
| Prosjektet | `~/Forelesningsverktoy/lysark/`, eget git-repo, gren `main` |
| På GitHub | `SimenKode/lysark`, **privat** til eieren selv gjør det offentlig eller ber om det |
| Lisens | GPL-3.0-or-later ([LICENSE](LICENSE)), med unntak for eksporterte forelesninger ([EXPORT-EXCEPTION.md](EXPORT-EXCEPTION.md)) |
| Commits | se `git log`. Eieren har sagt ja til commits på `main` etter hvert ferdige, testede trinn, og til at de pushes til det private repoet fortløpende. Synlighet og publisering avgjør han. |
| Ferdige programfiler | `release/Lysark-0.1.0.AppImage` (Linux) og `release/Lysark-0.1.0-win.zip` (Windows), bygget på nytt etter økt 3 |
| Spørsmål som venter på svar | [docs/sporsmal-videre.md](docs/sporsmal-videre.md) |
| Eierens forelesninger | `eksempler/` (åtte PPTX med PDF-utgaver, ikke i git) |
| USNs logopakke | `merkevare/` (pakket ut, ikke i git) |
| Plan og status | [docs/plan.md](docs/plan.md) |
| Valgene som er tatt | [docs/sporsmal-leveranse-1.md](docs/sporsmal-leveranse-1.md) |
| Designmanualens regler | [docs/designmanual.md](docs/designmanual.md) |
| Stakk og lisenser | [docs/stakk.md](docs/stakk.md) |

Kommandoer: `npm run dev` (start), `npm test` (bygger og kjører alt),
`npm run dist:linux`, `npm run dist:win`.

## 2. Hva som er laget

Leveranse 1 og 2 av 5. Leveranse 1: PPTX inn, interaktiv HTML ut.

- **Import** av PPTX til en prosjektmappe, med rapport over det som må
  lages på nytt.
- **Tema** «ren»: USNs palett, kontrasttabellen som data, 8 kolonner,
  profilformer på tittellysark, logo hentet uendret fra logopakka.
- **Redigering:** lysark, flytte og endre størrelse med feste til
  rutenett, tekst rett i lysarket, tabeller, video, «Lær mer»-bokser, steg,
  manus, angre.
- **Eksport** til én HTML-fil uten nettkall, og forhåndsvisning av
  nøyaktig det samme.
- **Spilleren:** piltaster, klikk, sveip, innhold, manus, «Lær mer»-panel,
  hjelp, fullskjerm, utskrift.
- **Lagring** som mappe, pluss pakking til én fil og tilbake.

Leveranse 2, «Lær mer»-byggeren:

- **Utdyping på alle elementer:** tekst, bilde, form, tabell og video kan
  få et «+»-merke som åpner et panel. «+ Lær mer» er fortsatt en egen
  knapp i lysarket.
- **Byggeren:** et vindu over hele arbeidsflaten med byggesteiner (tekst,
  overskrift, bilde, video, tabell, innbygging) til venstre og panelet
  slik studenten ser det til høyre. Veier inn: «+ Lær mer», Element-fanen
  og høyreklikk i lysarket.
- **Mediedialogen:** søk i Wikimedia Commons, opplasting, og «I
  prosjektet». Bilder fra Commons får kreditering med seg.
- **Spilleren:** merket er en knapp med navn for skjermleser, hele
  elementet kan klikkes, panelet kan utvides, og «Bildekilder» lister
  alle krediterte bilder.
- **YouTube og innbygging i to trinn:** stillbilde og knapp først;
  ingenting hentes før seeren trykker.
- **Format 2**, med automatisk løft av eldre prosjekter.

Ikke påbegynt: leveranse 3 (lyd og video), 4 (figurer og bevegelser) og
5 (håndlaget stil).

## 3. Hva som er prøvd, og hvordan

| Hva | Resultat |
| --- | --- |
| Automatiske tester på Linux Mint | Etter leveranse 2: 206 består (161 etter økt 3, 157 etter økt 2, 129 etter økt 1). Tre testfiler starter hele programmet uten vindu og går gjennom åpne, redigere, angre, lagre, eksportere, spille av, bygge «Lær mer» og hente medier. |
| Det pakkede Linux-programmet | Bygget på nytt etter leveranse 2 (AppImage og Windows-zip, 22.11.2026). De tre gjennomkjøringene (27 tester) besto mot `release/linux-unpacked/lysark`. AppImage-fila selv er ikke startet, og Windows-zip-en er ikke prøvd. |
| Leveranse 2 mot ekte nett | Én gang på Linux Mint: Commons-søk, innsetting med kreditering, forhåndsbilde fra YouTube, YouTube i forhåndsvisningen (spilte) og fra en fil åpnet fra disk («Error 153»). Se 6.13. |
| Rettingene i økt 3, sett på skjermbilder | Programmet ble kjørt uten vindu på Linux Mint med Stål importert: lysarklista, lenkekortet med stillbilde og meldingene for video som ikke kan vises. Ikke prøvd på Windows. |
| Import av de ekte forelesningene | Alle åtte (315 lysark) og malfila importeres uten feil. Økt 2: alle 315 er sammenlignet side om side med PDF-utgavene, før og etter rettingene (se del 4). Gjennomgangen ble gjort av hjelpeagenter som så på bildene, og jeg sjekket funnene og de viktigste rettingene selv. |
| Windows 11 (eierens VM) | Prøvd for hånd 22.11.2026 med zip-utgaven (økt 1), se under. Endringene fra økt 2 og økt 3, og hele leveranse 2, er ikke prøvd på Windows. |
| Canvas | Ikke prøvd. |

### Windows 11, det som ble prøvd i VM-en

Zip-utgaven ble pakket ut og startet. Alt dette virket:

- programmet starter (første start tok omtrent et halvt minutt), norsk
  meny, riktige skrifter
- import av `PB1020 2025 - 04 - Stål.pptx` gjennom Windows' egne
  fildialoger: 26 lysark og importrapport
- logopakka valgt under Innstillinger: norsk og engelsk logo funnet
- tekst redigert rett i lysarket, lagret med Ctrl+S
- eksport til HTML (22,5 MB) og avspilling i Edge: klikk, piltaster og
  innholdsoversikt
- forhåndsvisning (F5)

Ikke prøvd på Windows: installasjonsfil (finnes ikke), pakking til én
fil, video, utskrift, flytting og størrelsesendring med mus, og lange
arbeidsøkter. Det lå ingen SmartScreen-advarsel i veien, men fila kom inn
via et CD-bilde og ikke som nedlasting, så det sier ingenting om hva en
nedlastet fil vil møte.

Testmappa `C:\Users\simen\lysark-test\` ligger igjen i VM-en med
programmet, logopakka, to forelesninger, prosjektet og `staal.html`.
Lysark har også lagret innstillinger i VM-en. Slett mappa når den ikke
trengs.

**Uhell under testen:** de første tastetrykkene mine traff skrivebordet
i stedet for Kjør-dialogen, fordi dialogen ikke hadde fått fokus. Det
utløste trolig «Learn about this picture» (bakgrunnsbildet byttet).
Ingenting annet ble startet, og kommandoen som sto i Kjør-dialogen fra
før (`cmd /c E:\309-rydd.cmd`) ble ikke kjørt.

Slik testes det i VM-en neste gang: se toppen av
[tools/windows-vm.py](tools/windows-vm.py).

## 4. Hva de ekte forelesningene viste

- De er bygd på USNs PowerPoint-mal, i 16:9. Importen er rettet for den
  (se [docs/plan.md](docs/plan.md)).
- **Ingen har notater.** Manus må skrives i Lysark.
- **428 av 581 bilder mangler alternativ tekst.**
- **Video:** 20 lenker til YouTube og Vimeo, én lokal fil på 112 MB, og
  USNs logoanimasjon som siste lysark i hver forelesning.
- SmartArt på 6 lysark, formler på 2, former forenklet til rektangler på
  32.
- Malen bruker profilskriften Maison Neue. Den er ikke installert hos
  eieren, så PowerPoint viser Calibri, og lysarkene er satt opp etter
  det. Derfor importeres løpende tekst en tidel mindre. Kontrollmålt i
  økt 2 på 1313 linjer fra PDF-utgavene: 85 % av linjene blir da ikke
  bredere enn i PowerPoint.
- **Linjer brytes ofte med tabulatorer og mellomrom** for å få teksten
  rundt bildene (57 tekstbiter med tabulator, 66 med flere mellomrom på
  rad). Målt mot PDF-ene brøt PowerPoint linjen ved alle rekker på tre
  eller flere, så importen gjør dem nå om til linjeskift (økt 2).
- **Gul utheving** brukes 61 steder, flest i Lovverk (39).
- **Mange bilder har hvit bakgrunn** og står tett inntil teksten. På
  PowerPoints hvite lysark syns ikke bakgrunnen.
- PDF-en til **Praktisk HMS er eldre enn PPTX-en**: «Ergonomi»
  (lysark 4) mangler, og «Asbest» og «Åndedrettsvern» har byttet plass.

### Sammenligningen med PDF-ene i økt 2

Alle 315 lysark ble lagt side om side med PDF-utgavene, først med
importen slik den var etter økt 1, så etter rettingene. Hjelpeagenter så
på bildene og listet avvik; jeg kontrollerte funnene i XML-en og
PDF-ens ordposisjoner før noe ble rettet, og så selv på resultatet.
Betong og HMS ble gjennomgått to ganger, de øvrige én gang etter de
første rettingene. Etter de siste rettingene (innrykk og
skriftavrunding) ble Introduksjonen, Trevirke og Betong 36–38 tatt og
sett på på nytt; resten er ikke sett på med akkurat den versjonen.
Funnene, og hva som ble gjort:

| Funn (første runde) | Lysark (eksempler) | Tiltak |
| --- | --- | --- |
| Tekst går inn under bilder fordi linjene brytes andre steder | Betong 16, 22, 24, 36, 38, 64, 67, 92; HMS 7, 28, 31, 36, 37, 42 | Mellomrom beholdes, og lange rekker blir linjeskift |
| Korte etiketter brytes midt i ord («Sta/g») | Betong 33, 51, 67; HMS 33 | PowerPoints tekstmarger følges, også i former |
| Underpunkter for små | mange (86 tekstbokser) | Størrelse per nivå følger PowerPoint |
| Underpunkter brytes tidligere enn i PowerPoint | mange | Innrykk per nivå følger PowerPoint, og skriftstørrelsen avrundes til tidels piksler |
| Tette lysark blir for høye etter at underpunktene fikk riktig størrelse | Betong 36 | Avstand mellom avsnitt og linjeavstand følger PowerPoint |
| Nummerering «1., 1., 1.» | Betong 36 | Nummereringen fortsetter forbi underpunkter |
| Buede piler blir store rektangler over bildene | Betong 54, 70, 72, 80, 87; HMS 41 | Tas ikke med, med merknad |
| Røde kryss blir skjeve rektangler | Betong 74–76 | Frihåndsstreker som er én rett strek, blir linjer |
| Lys tone av en profilfarge blir mørk | Betong 65 | Lysere og mørkere nyanser regnes ut |
| Gul utheving forsvinner | HMS 14 | Blir profilens tekstmarkering |
| «λ» blir en tom firkant | Bygg 9, 10 | Symbol-skriftens tegn oversettes |
| Buede skillelinjer blir tykke, hule rektangler | Bygg 23 | Åpne frihåndskurver blir rette linjer, med merknad |
| Bokstavlister (a., b., c.) blir 1., 2., 3. | Teoretisk HMS 2, 8 | Bokstav- og romertall beholdes |
| Usynlig hvit utheving blir lime markering | Lovverk 9, 11, 16 (39 steder) | Hvit utheving tas ikke med |
| Tusjstreker (håndskrift) dekker lovteksten | Lovverk 5, 10, 15 | Tegnes gjennomskinnelig, som i PowerPoint |
| Tekst i former alltid midtstilt | Lovverk 16 | Justeringen fra PowerPoint følger med |
| Tette tabeller blir for høye | Trevirke 19 | Cellemargene fra PowerPoint følger med (radhøyder og blandede størrelser gjenstår) |
| Senket skrift blir vanlig («CO2», «fmk») | Trevirke 9, 19 (23 steder); hevet skrift i Stål (6) | Senket og hevet skrift følger med |
| Logoen dekkes av bilder og bildetekster | Betong 25, 61, 65, 69, 70, 72, 73; HMS 39 | Logoen slås av på lysarket, med merknad |
| Loddrett tekst blir vannrett og knekt | Betong 33; HMS 33; Trevirke 19; Bygg 14 | Dreid tekst, også i fylte former |

## 5. Kjente mangler og småfeil

Større:

1. **Formler** blir bilder av hele tekstboksen. De er riktige, men kan
   ikke redigeres og følger ikke temaets skrift. Ekte matematikk i
   teksten er ikke laget.
2. **SmartArt, diagrammer og innebygde objekter** følger ikke med.
3. **Windows-installasjonsfil** mangler. Den må bygges på Windows, eller
   på Linux med Wine.
4. **Windows-programfila har Electrons ikon**, fordi ikonet ikke kan
   skrives inn når programmet bygges på Linux.
5. **Radhøyder og justering i tabeller** følger temaet, og hele tabellen
   får én skriftstørrelse. Tette tabeller kan derfor bli høyere enn i
   PowerPoint og gå inn i det som står under eller ut av lysarket
   (Praktisk HMS 35, Trevirke 17 og 19, Stål 4). Lange ord i smale
   kolonner brytes ikke, så de kan gå inn i nabocellen. Cellemargene
   følger PowerPoint fra økt 2. Dette er den største gjenværende feilen
   i importen.
6. **Mediefiler som ikke lenger brukes**, ryddes ikke ut av
   prosjektmappa.
7. **Hvite bildebakgrunner** syns som hvite felt på den lys beige flaten.
   I PowerPoint forsvinner de mot det hvite lysarket. Dette er ikke en
   importfeil, men henger sammen med valget av grunnflate (6.1).

Mindre:

- Videolenker fra PowerPoint heter «Media på Internett 4» og lignende,
  fordi det er navnet PowerPoint ga dem. Tittelen må skrives for hånd.
- Edge tilbyr å oversette siden fordi den er merket som norsk.
- Formelbildene har PowerPoints skrift og størrelse, så de ser større ut
  enn teksten ved siden av.
- Tittelskriften er litt bredere enn Calibri, så en tittel som går helt
  inntil et bilde, kan få siste bokstav dekket (Betong 33 og 42).

Rettet under leveranse 2: det valgte lysarket i lysarklista ble lyst med
hvit tittel når musa sto over det. Rettingen fra økt 3 holdt ikke (en
generell knappregel vant); nå er den rettet og har en test.

Rettet i økt 3: miniatyrene i lysarklista holder seg i boksen sin,
videolenker viser stillbildet sitt, lenkekortet er lesbart i «Lær
mer»-panelet, og en video som ikke kan vises, sier fra (se 6.11).

Rettet i økt 2: avstand mellom avsnitt og linjeavstand følger nå
PowerPoint, siste lysark (logoanimasjonen) får ikke lenger temaets logo
oppå seg, forhåndsvisningsvinduet heter «Forhåndsvisning – …», og
importerte prosjekter får navn etter tittellysarket («Stål») når
PowerPoint-fila ikke har egen tittel.

## 6. Tilbakemeldinger fra eieren

Skriv rett under hvert punkt. Tomt felt betyr «ikke sett på ennå».

### 6.1 Uttrykket (må godkjennes før leveranse 2)

Åpne `release/Lysark-0.1.0.AppImage`, importer en forelesning fra
`eksempler/`, og bruk Forhåndsvis.

- **Titler i serif (Times-lik), lilla.** Designmanualen sier at titler
  skal stå i Clearface, med Times New Roman som reserve. USNs egen
  PowerPoint-mal bruker likevel en skrift uten seriffer i titlene. Skal
  Lysark følge manualen (som nå) eller malen?

  Svar:

- **Lys beige grunnflate** på innholdslysark (malen har hvit). Merk
  (økt 2): mange av bildene dine har hvit bakgrunn, og den syns som hvite
  felt på beige. På hvit grunnflate ville de gått i ett med lysarket, slik
  som i PowerPoint.

  Svar:

- **Tittellysarket:** lilla flate, hvit tekst, to profilformer til høyre.

  Svar:

- **Logoen** nede til venstre på alle lysark.

  Svar:

- **Tekststørrelsen** (en tidel mindre enn i PowerPoint, for å få samme
  linjeskift).

  Svar:

- **Punktmerker** (små firkanter), tabeller (lilla overskriftsrad),
  «Lær mer»-knappen.

  Svar:

### 6.2 Importen

- Stemmer lysarkene med PowerPoint der du har sett? Noter lysark som
  bommer (forelesning og nummer).

  Svar:

- Formler som bilde: godt nok for nå, eller trengs ekte matematikk
  tidlig?

  Svar:

- SmartArt: skal den lages på nytt med malene i leveranse 2, eller bør
  importen ta den med som bilde?

  Svar:

### 6.3 Redigeringsprogrammet

- Hva var tungvint eller uforståelig?

  Svar:

- Hva mangler du for å rette opp en forelesning?

  Svar:

### 6.4 HTML-fila og spilleren

- Navigasjon, innholdsoversikt, manuspanel, «Lær mer»-panel:

  Svar:

- Filstørrelsen (Stål ble 22,5 MB; Trevirke blir langt større):

  Svar:

### 6.5 Canvas

**Eieren prøver Canvas selv, for hånd. Ingen KI brukes der** (eieren,
22.11.2026). Dette er lista over hva han bør se etter; skriv inn det han
melder tilbake:

1. Last opp en eksportert HTML-fil under Filer og åpne den. Vises
   forelesningen, eller bare en tom side eller kildekoden?
2. Virker den også når den bygges inn i en Canvas-side, og når den åpnes
   i egen fane?
3. Piltaster, de runde pilene, innholdsoversikten og fullskjerm.
4. «+»-merkene og «Lær mer»-panelet, «Utvid» og «Bildekilder».
5. YouTube: spiller videoen inne i lysarket?
6. Lenker ut av forelesningen.
7. Hvor stor fil godtar emnet? (Stål er 23 MB; Trevirke er større.)
8. En forelesning med stor video: følger mappa ved siden av med?
9. På mobil, i Canvas-appen.

  Svar:

### 6.6 Windows

- Er VM-en representativ, eller skal programmet også prøves på en
  USN-styrt maskin?

  Svar:

- Trengs installasjonsfil, eller holder zip-utgaven?

  Svar:

### 6.7 Veien videre

- Skal leveranse 2 (animasjonsmaler og håndlaget stil) starte nå, eller
  skal noe i leveranse 1 rettes først?

  Svar:

- Har USN svart om indigo tavle med lys strek?

  Svar:

- Annet:

  Svar:

### 6.8 Valg tatt i økt 2

Disse valgene tok jeg selv under rettingen av importen. Si fra om noe
skal være annerledes.

- **Logoen slås av ved import** på lysark der et bilde, en form eller en
  bildetekst ligger der logoen skal stå, i stedet for at innholdet
  dekker halve logoen. Lysarket får en merknad, og «Vis USNs logo» slår den
  på igjen. I de åtte forelesningene gjelder det 42 av 315 lysark: de 8
  siste lysarkene med logoanimasjonen, og 34 der bilder, former eller
  bildetekster ligger nede til venstre.

  Svar:

- **Gul utheving** i PowerPoint blir profilens tekstmarkering (syregrønn
  flate bak ordene). Når hele teksten i en boks er uthevet, tas
  markeringen bort, fordi manualen sier at den ikke skal brukes på
  enkeltstående tekst. Hvit utheving, som ikke syns i PowerPoint, tas
  heller ikke med.

  Svar:

- **Lange rekker med mellomrom og tabulatorer** mellom ord (tre eller
  flere) blir linjeskift i teksten, fordi det var det de gjorde i
  PowerPoint. Linjeskiftet står da fast også om tekstboksen gjøres
  bredere i Lysark, og kan slettes som et vanlig linjeskift.

  Svar:

- **Buede, knekte og doble blokkpiler** tas ikke med. Før ble de store,
  fylte rektangler som dekket bildene de pekte på.

  Svar:

- **Prosjektnavnet** hentes fra tittellysarket («Stål») når
  PowerPoint-fila bare har standardtittelen. Før ble det filnavnet
  («PB1020 2025 - 04 - Stål»). Navnet brukes også som filnavn ved
  eksport.

  Svar:

### 6.9 Eierens tilbakemelding i chat etter økt 2 (22.11.2026)

Ordrett:

> Godt utgangspunkt. Liten bug at lysarket er utenfor lilla boks. Tenker
> helhetlig at dette er et godt grunnlag for neste chat til å lage det
> som skal gjøre dette programmet unikt, nemlig at man kan redigere
> innholdet i lysarkene til å også være "lær mer". Tenker funksjonen er
> god som den er, men har godt av en bedre GUI med mer plass til en rik
> bygger for innholdspanelet. Den er trang nå, uten funksjoner for å
> bygge rikt innhold, med innbygging, video, animasjoner, lenker tekst,
> tabeller osv. Jeg vil altså at "+ Lær mer" skal være en enkel måte å
> implementere det på, men at man også skal kunne klikke på bilder,
> overskrifter osv, hva enn foreleseren vil utdype. Opplastning burde ha
> en popup med både wikimedia commons bildesøk som galleri og "last opp
> medie". YT forhåndsvisning fungerer også ikke.

Slik er det lest (bekreftes med eieren i neste økt):

- «Godt utgangspunkt» er en positiv helhetsvurdering, men ikke svar på
  punktene i 6.1–6.8. De står fortsatt åpne.
- **Feil i lysarklista:** miniatyren til det valgte lysarket stikker ut av
  den lilla boksen (skjermbilde fra eieren, lysark 70 i Betong). Trolig
  årsak, ikke undersøkt: miniatyren er fast 192 px bred
  (`THUMB_SCALE = 0.1` i `src/renderer/src/SceneList.tsx`), mens spalten
  er 252 px (`styles.css`, `.workspace`). Etter marger, nummerspalte og
  rullefelt er det for lite plass.
- **Et av tre store ønsker** (de to andre står i 6.10): en rik bygger
  for «Lær mer». Knappen «+ Lær
  mer» beholdes som den enkle veien inn, men læreren skal også kunne
  klikke på et hvilket som helst element i lysarket (bilde, overskrift,
  tekst …) og knytte utdypende innhold til det. Panelet som bygger
  innholdet, trenger mer plass enn sidepanelet har i dag, og byggesteiner
  for tekst, lenker, tabeller, bilder, video, innbygging og animasjoner.
- **Mediedialog:** et vindu med to veier inn: bildesøk i Wikimedia
  Commons som galleri, og «Last opp medie».
- **YouTube:** forhåndsvisning virker ikke. Skjermbildet viser
  «Lær mer»-panelet i forhåndsvisningen med en svart videospiller
  (0:02 / 0:05). I dag er YouTube-lenker bevisst et kort som åpner
  nettleseren (`src/shared/render/scene.ts`, `renderVideo`; panelet i
  `src/player/player.ts`). Eieren vil ha en virkelig forhåndsvisning.

Dette berører regler og valg som er tatt, og må avklares før noe bygges:

- **Wikimedia Commons-søk betyr at programmet kontakter nettet.**
  [AGENTS.md](AGENTS.md) sier at programmet aldri sender noe noe sted, og
  valg-lista for leveranse 1 sier at programmet aldri kontakter nettet.
  Eieren ber nå selv om søket, men regelen må endres eksplisitt og
  avgrenses (for eksempel bare når læreren selv søker, ingen
  personopplysninger, ingenting i bakgrunnen), og AGENTS.md må
  oppdateres etter svaret.
- **Lisens på bilder fra Commons:** de fleste krever navngivelse
  (CC BY, CC BY-SA). Fotograf, lisens og kilde må lagres med bildet og
  vises i HTML-eksporten.
- **YouTube innebygd** laster skript og informasjonskapsler fra Google i
  HTML-fila og i forhåndsvisningen. Det er tillatt etter AGENTS.md når
  læreren selv har satt inn lenken, men personvernet bør avgjøres (for
  eksempel `youtube-nocookie.com`, og at videoen først lastes når
  studenten klikker).
- **Plassen i planen:** [docs/plan.md](docs/plan.md) har leveranse 2 som
  animasjonsmaler og håndlaget stil. Om «Lær mer»-byggeren blir egen
  leveranse, del av leveranse 2 eller kommer før den, avgjør eieren.
- **Format:** i dag er «Lær mer» et eget element (`deepdive`) med
  tittel, rik tekst og en medieliste. Å knytte innhold til et hvilket som
  helst element krever en endring i prosjektformatet
  ([docs/prosjektformat.md](docs/prosjektformat.md)), og spilleren må
  vise at et element har utdyping, på en måte som også virker med
  tastatur og skjermleser.

### 6.10 Mer fra eieren samme dag: figurer, animasjon og video

Ordrett:

> Synes også funksjonaliteten med å bygge animasjoner/statiske figurer er
> fraværende. Videoaspektet må integreres dypt slik at man enkelt kan
> lage video med dette verktøyet også. Tanken er at man moderniserer til
> en HTML fil, så kan man ta opp voiceover og redigere lett (klippe lyd,
> strekke ut scener osv.), bør håndtere prosjektfiler, html og pptx/pdf
> for videoproduksjon.

Slik er det lest (bekreftes med eieren):

- **Figurer og animasjoner** mangler i programmet. Det stemmer: det er
  leveranse 2 i [docs/plan.md](docs/plan.md) (åtte maler med skjema,
  bevegelser, håndlaget stil), og ingenting av den er bygget. Eieren
  nevner også *statiske* figurer, altså figurer som kan lages uten å
  animeres. Om det betyr mer enn malene uten steg (for eksempel en friere
  figurbygger), må avklares.
- **Video skal være en hoveddel av verktøyet, ikke et tillegg.**
  Arbeidsflyten eieren beskriver: forelesningen gjøres om til moderne
  HTML, så leses voice-over inn, og så redigeres det enkelt: klippe lyd,
  strekke ut lysark og lignende. Leveranse 3 i planen dekker innspilling
  per lysark, klipping av start og slutt, tidspunkt for steg og MP4 bilde
  for bilde. Nytt er ønsket om enkel redigering på en tidslinje
  (klipping inne i lyden, lengden på lysarkene) og at det skal være dypt
  integrert.
- **Inndata for video:** prosjektfiler, HTML og PPTX eller PDF.
  - Prosjektfiler: finnes.
  - HTML: den eksporterte fila inneholder hele prosjektet
    (`<script type="application/json" id="lysark-data">` og mediene i
    base64), så den kan åpnes igjen. Det er ikke bygget.
  - PPTX: importen finnes.
  - PDF: helt nytt. Sidene må tegnes som bilder per lysark. Det krever en
    PDF-leser med fri lisens: pdf.js (Apache-2.0) kan bygges inn, mens
    Poppler (GPL) bare kan brukes som eget program. Tekst fra PDF blir
    bilder, ikke redigerbar tekst, med mindre noe mer avansert bygges.

Dette må avklares før noe bygges:

- **Rekkefølgen:** tre store ønsker konkurrerer om neste plass:
  «Lær mer»-byggeren (6.9), figurer og animasjoner (leveranse 2) og
  dyp videointegrasjon (leveranse 3). Planen må skrives om etter eierens
  svar. Hver leveranse skal fortsatt være ferdig og brukbar alene.
- **Videoredigering:** hvor mye som trengs (klipp, flytt, strekk, pauser,
  musikk?), og om redigeringen skjer per lysark eller på én samlet
  tidslinje for hele forelesningen.
- **Arkitekturen holder:** formatet har allerede tidslinje med steg, og
  tegningen er en ren funksjon av (prosjekt, tema, tid), slik at
  videoeksport bilde for bilde blir nøyaktig. Lyd og redigering må passe
  inn i det samme formatet, ikke få egen kopi av innholdet.
- **FFmpeg:** brukes som eget program (GPL/LGPL), aldri som npm-pakke
  (`ffmpeg-static` er avvist). Hvilket bygg som brukes, er ikke avgjort
  ([docs/stakk.md](docs/stakk.md)).
- **Mikrofon:** innspilling krever tilgang til mikrofonen i Electron, både
  på Linux og Windows. Ingenting sendes noe sted.

### 6.11 Økt 3: det som ble rettet, og det som venter på svar

**Lysarklista (rettet).** Årsaken var som antatt: miniatyren var fast
192 px bred, men etter marger, nummerspalte og rullefelt var det bare
omtrent 180 px igjen. Feilen gjaldt alle lysark, men syntes bare på det
valgte, fordi det har farget bakgrunn. Miniatyrene måler nå plassen de
har, og fyller den (også når rullefeltet kommer og går, og på Windows
der rullefeltet har en annen bredde). I samme slengen: når musa sto over
det valgte lysarket, ble bakgrunnen lys med hvit tittel oppå, altså
uleselig. Det valgte lysarket beholder nå den lilla fargen. Prøvd med
skjermbilde av programmet uten vindu, og med en ny test som også tvinger
fram rullefeltet.

**YouTube i forhåndsvisningen (undersøkt).** Prøvd uten vindu med Stål
importert, og med en «Lær mer»-boks som hadde en videofil og en
YouTube-lenke:

- En YouTube-lenke blir aldri en spiller. Den blir et kort som åpner
  nettleseren, både i lysarket og i panelet. Det er et valg fra
  leveranse 1, ikke en feil, og innbygging står som spørsmål 10 i
  [docs/sporsmal-videre.md](docs/sporsmal-videre.md).
- **Feil, rettet:** kortet viste aldri stillbildet PowerPoint hadde
  lagret for videoen, enda importen tok det med. En importert
  YouTube-video var derfor bare en stor mørk flate. Nå fyller
  stillbildet kortet, med avspillingsmerke, tittel og «Åpnes i
  nettleseren (krever nett)» i et felt under. Bildet er en fil i
  prosjektet; ingenting hentes fra nettet.
- **Feil, rettet:** i «Lær mer»-panelet hadde lenkekortet lilla tekst på
  mørk indigo (uleselig), og var like stort som i et lysark. Nå er
  teksten hvit, og kortet følger panelets størrelse.
- **Den svarte spilleren (0:02 / 0:05) er ikke gjenskapt.** En vanlig
  videofil (USNs logoanimasjon, 10 s, 3840 × 2160) spiller riktig i
  panelet. I byggeren kan «Video …» i en «Lær mer»-boks bare ta en fil,
  så spilleren i skjermbildet må ha vært en fil på fem sekunder. Mest
  sannsynlig, men ikke bekreftet: en fil der bildet er kodet på en måte
  programmet ikke kan vise (for eksempel H.265). Da spilles lyden mot
  svart bilde. Prøvd med en lydfil uten bilde, laget i programmet selv:
  den ga nettopp en svart spiller der tiden gikk.
- **Rettet uansett årsak:** en video uten bilde som kan vises, får nå en
  melding i stedet for bare svart («Bildet i videoen kan ikke vises her,
  bare lyden …»), og en fil som ikke kan spilles i det hele tatt, får
  «Videoen kan ikke spilles av her …». Programmet sier også fra idet en
  slik fil legges inn. Prøvd med lydfila og med en ødelagt fil; **ikke**
  prøvd med en ekte H.265-fil, for jeg har ingen, og FFmpeg er ikke
  installert på maskinen.

Eieren bør svare på spørsmål 24 (hvilken fil eller lenke det var).

**Spørsmålene.** 24 spørsmål i fem grupper, hvert med én anbefaling, i
[docs/sporsmal-videre.md](docs/sporsmal-videre.md): rekkefølge og ny
plan, «Lær mer»-byggeren (format, merke i spilleren, nettilgang,
lisenser, YouTube), figurer og bevegelser, video (tidslinje, grep,
inndata, FFmpeg, mikrofon). AGENTS.md er **ikke** endret; ordlyden for
unntaket fra «sender ingenting» står som forslag i spørsmål 8 og skrives
inn først når eieren har svart.

To ting jeg slo opp og ikke har prøvd selv:

- YouTube krever at siden som bygger inn en video, oppgir hvor den kommer
  fra. En HTML-fil åpnet rett fra disk gjør trolig ikke det («Feil
  153»). Må prøves i Canvas og fra disk før innbygging loves.
- Om LGPL-bygget av FFmpeg fra BtbN har en brukbar H.264-koder, fant jeg
  ikke bekreftet. Må sjekkes på selve fila.

### 6.12 Eierens svar og åpen kildekode (22.11.2026)

**Designspørsmålene:** «Alt som anbefalt». Valgene står i
[docs/sporsmal-videre.md](docs/sporsmal-videre.md), planen i
[docs/plan.md](docs/plan.md), og unntaket for nettilgang i
[AGENTS.md](AGENTS.md). Én ting der er fortsatt åpen: hvilken fil som ga
den svarte videospilleren. (Canvas prøver eieren selv, og mikrofon i
VM-en kan rigges av den som bygger; se 6.14.)

**Commits:** eieren valgte én commit for økt 2 og 3, og at jeg committer
underveis i leveranse 2 når et trinn er ferdig og testene består.

**Åpen kildekode.** Eieren skrev: «Jeg tenker vi kan gjøre prosjektet
open source på GH». Før noe ble lagt ut, gikk jeg gjennom hva som ville
blitt offentlig, og eieren valgte:

- **Lisens: GPL-3.0.** Lagt inn som GPL-3.0-or-later («versjon 3 eller
  senere», den vanlige formen). Si fra hvis det skal være bare versjon 3.
- **E-post:** commitene er skrevet om til GitHub-kontoens skjulte
  adresse, og repoet bruker den framover. Den private adressen lå i alle
  commits, og ville blitt offentlig.
- **Privat repo nå, offentlig når eieren har sett gjennom det.**
- **Arbeidsnotatene (denne fila og `docs/`) blir liggende i git.**

Gjennomgangen viste at historikken er ren: ingen forelesninger,
logofiler, lisensierte skrifter eller programfiler har ligget i git.

Tre ting eieren må ta stilling til før repoet gjøres offentlig:

1. **Unntaket for eksporterte forelesninger**
   ([EXPORT-EXCEPTION.md](EXPORT-EXCEPTION.md)) er skrevet av meg og ikke
   bekreftet av eieren. Bakgrunn: en eksportert HTML-fil inneholder
   spilleren fra Lysark. Uten unntaket kunne det reises tvil om hele fila
   (altså forelesningen) måtte deles under GPL. Unntaket sier at
   forelesningen er forfatterens egen. Jeg er ikke jurist.
2. **USNs profil.** Koden gjengir USNs farger og profilformer, og
   `docs/designmanual.md` oppsummerer designmanualen. Logoen ligger ikke
   i repoet. En lisens på koden gir ingen rett til USNs profil; README
   sier det. Eieren bør likevel høre med USN (kommunikasjonsavdelingen)
   om det er greit at et åpent verktøy bygger inn profilen.
3. **Hvem eier koden.** Er programmet laget som del av stillingen ved
   USN, kan arbeidsgiveren ha rettighetene til det (åndsverkloven § 71
   om datamaskinprogrammer). Da er det USN som må si ja til lisensen.
   Jeg kan ikke avgjøre dette.

Gjenstår før ferdige programfiler deles offentlig (ikke nødvendig for å
legge ut kildekoden): en samlet fil med lisenstekstene til bibliotekene
som bygges inn.

Til leveranse 2: Wikimedia ber programmer oppgi kontaktinformasjon i
forespørslene. Når repoet er offentlig, kan adressen til repoet brukes
til det, uten e-post.

### 6.13 Leveranse 2 er bygget (22.11.2026)

Bygget i samme økt som svarene kom. Hva som er laget, står i del 2; hva
som er valgt, i [docs/sporsmal-videre.md](docs/sporsmal-videre.md).

**Slik er det prøvd, alt på Linux Mint:**

- Automatiske tester (tallet står i del 3). Nye testfiler:
  `tests/more.test.ts` (formatet, løftet fra format 1, panelet, merket,
  YouTube i to trinn, kreditering), `tests/commons.test.ts`
  (tillatelseslista, søket, lisensfilteret, lesing av svaret) og
  `tests/e2e-more.test.ts`, som starter hele programmet uten vindu og går
  gjennom byggeren, mediedialogen, et Commons-søk der testen selv svarer
  for Wikimedia, nettsperren, lagring, og panelet i spilleren med
  tastatur og mus.
- Skjermbilder av byggeren, mediedialogen, høyreklikkmenyen, panelet og
  «Bildekilder» er sett på.
- **Én gang mot ekte nett** (fire forespørselsrunder, med Stål importert):
  søk i Commons etter «bro» ga 24 treff med bilder; ett bilde ble satt
  inn med tittel, opphavsperson, lisens og kilde; forhåndsbildet til en
  YouTube-video ble hentet (1280 × 720); videoen spilte i
  forhåndsvisningen; og samme video i en eksportert fil åpnet rett fra
  disk ga «Error 153» fra YouTube.

**Det ekte nettet lærte meg to ting, og begge er rettet:**

- Wikimedia leverer nå småbilder fra `thumb.wikimedia.org`. Den verten
  sto ikke på lista eieren godkjente, så første ekte søk ga null treff.
  Eieren sa siden ja til verten (6.14), og den står nå på lista.
  Sporingsparametrene Wikimedia legger på adressene, sendes ikke med.
- YouTube spiller ikke i en fil åpnet fra disk. Avspillingsknappen åpner
  derfor YouTube i nettleseren der, i stedet for å vise en feilmelding.

**Ikke prøvd:** Windows 11, Canvas, andre nettlesere enn den innebygde
(Chromium), skjermleser i praksis (rollene og navnene er testet, ikke
opplevelsen), og dra-og-slipp av byggesteiner i automatiske tester.

**Mangler og ting å vite:**

- Bare YouTube kjennes igjen som video i to trinn. Vimeo, Panopto og
  andre er fortsatt et kort som åpner nettleseren når de står som video;
  de kan bygges inn med byggesteinen «Innbygging».
- Tabeller i byggeren har ren tekst i cellene (ingen fet, lenker eller
  sammenslåtte celler).
- Bilder fra Commons hentes i høyst 1920 px bredde. SVG hentes som PNG.
- Bildene som fulgte med fra PowerPoint, har ingen kreditering.
  «Bildekilder» viser bare det som er fylt inn (Element-fanen,
  «Kreditering», eller mediedialogen).
- Merket på et dreid element holdes ikke innenfor lysarkkanten.
- Noen nettsteder nekter å bli bygget inn; da er rammen tom, og lenka
  «Åpne i nettleseren» er veien.

### 6.14 Eieren har prøvd leveranse 2 (22.11.2026)

Ordrett, med to skjermbilder (en høyreklikkmeny i lysarket, og en rund,
grå knapp med pil på svart bunn):

> Testet nå. Mye bra, men frykter at noen vil slite med gui og navn. Vi
> må kalle scene for lysark. Pil og andre former må kunne endre
> tykkelse/størrelse. Videoene er fortsatt spill av fra youtube og ikke
> innbygget. Du kan fint rigge mikrofon i VM selv. thumb.wikimedia.org og
> andre bilder i det offentlige domenet er fair game. Canvas tester jeg
> helt manuelt, ingen KI anvendes der. Lag handoff som jobber videre og
> lager programmet jeg forespør. Vi kan godt holde repoet skjult frem til
> vi har en MVP med både HTML og video. Vi trenger også mer animasjoner
> og lekenhet i utformingen. Ønsker også bedre navigering i HTML med pil
> med stor rund pil til hver side. Vil ikke at å klikke på lysarket skal
> ta en videre da vi skal ha interaktive elementer i lysarket. Pil opp og
> ned på tastaturet må også fungere som navigasjon. USN
> avslutningsanimasjonen fungerer fint, men akkurat den burde vi kunne
> bake inn i programmet som forslag til avslutning og ikke la den spille
> som video, men at den starter elegant automatisk når man går til
> lysbildet.

Før dette hadde eieren svart «Ja, push» (de to commitene for leveranse 2
ble pushet til det private repoet).

#### A. Bestemt av eieren. Bygges uten flere spørsmål

| Nr. | Hva | Merknad |
| --- | --- | --- |
| A1 | **«Scene» heter «lysark»** i alt eieren og studentene leser: programmet, spilleren, dokumentene | Regelen står i AGENTS.md. Kode beholder `scene`. Omtrent 34 tekster i redigeringsprogrammet, pluss README og `docs/`. Programmet heter også Lysark; det er meningen |
| A2 | **Piler og former: tykkelsen skal kunne endres**, og størrelsen på pilspissen med den | I dag er streken fast (temaets, 6 px). Trenger et nytt felt på former i formatet. Gjelder linjer, piler og omriss |
| A3 | **Store, runde piler på hver side av lysarket** i HTML-spilleren | Skjermbilde 2 er trolig forbildet: rund, grå, med vinkelpil. Bekreft utseendet med et skjermbilde til eieren |
| A4 | **Klikk på lysarket går ikke videre** | Lysarket skal ha interaktive elementer. Videre går man med pilene, tastaturet og sveip |
| A5 | **Pil opp og pil ned navigerer** (opp = forrige, ned = neste) | I tillegg til tastene som finnes. Pass på at de fortsatt ruller i et åpent panel når fokus står der |
| A6 | **YouTube er innebygd som spiller i lysarket**, ikke stillbilde med «Spill av fra YouTube» | Opphever to-trinnsvalget (spørsmål 10) for YouTube. Se «Det YouTube-valget fører med seg» under |
| A7 | `thumb.wikimedia.org` på lista | **Gjort** i denne økten |
| A8 | Mikrofon i Windows-VM-en kan rigges av den som bygger | Står i AGENTS.md. Gjelder bare mikrofonen |
| A9 | Canvas prøves av eieren for hånd, uten KI | Sjekklista står i 6.5 |
| A10 | Repoet er privat til det finnes en første brukbar utgave med både HTML og video | Står i AGENTS.md |

**Det YouTube-valget fører med seg** (fakta fra utprøvingen i 6.13; si
det til eieren når det bygges):

- Studentens nettleser henter spilleren fra Google så snart lysarket
  vises, ikke først ved klikk. Bruk fortsatt `youtube-nocookie.com`.
- Åpnes fila rett fra disk, svarer YouTube «Error 153». Der må
  stillbildet med knapp som åpner YouTube, bli stående.
- Redigeringsflaten når ikke nettet, så der vises stillbildet.
  Forhåndsvisningen viser den ekte spilleren.
- I video (leveranse 3) kan bare stillbildet vises.
- Hent rammen først når lysarket vises, og ta den bort når man går
  videre, så ingenting spiller i bakgrunnen.
- Annen innbygging («Innhold fra … – klikk for å laste») er ikke nevnt
  av eieren. Spør om den også skal lastes direkte.

#### B. Må spørres om, samlet, før det bygges

1. **Navn og grensesnitt.** Eieren frykter at noen vil slite. Han har
   bare nevnt «scene». Legg fram en liste over ordene i programmet med
   forslag (for eksempel Element, Steg, Utdyping, Byggestein, Innbygging,
   Manus, Tilpass til rutenett), og spør hva som var vanskelig å finne
   eller forstå. Skjermbilde 1 (høyreklikkmenyen med «Legg til utdyping
   …») er enten et eksempel på et navn han mener er vanskelig, eller på
   den oransje fokusrammen, som er skjev rundt det øverste menyvalget.
   **Spør hvilket.** Fokusrammen bør rettes uansett.
2. **Flere animasjoner og mer lekenhet.** Dette går lenger enn
   spørsmål 14, der anbefalingen var «ingen sprett eller snurr», og som
   eieren da godtok. Avklar hva han ser for seg: overganger mellom
   lysark, måten elementer kommer inn på, respons når man peker og
   trykker, hvordan panelet åpner seg. Rammer som ligger fast:
   designmanualen er bindende (si fra der lekenhet kolliderer med den),
   bevegelser skal kunne slås av for dem som har bedt systemet om lite
   bevegelse, og alt som skal med i video, må være en ren funksjon av
   tiden.
3. **USNs avslutningsanimasjon bakt inn.** Ønsket: et forslag til
   avslutningslysark som starter animasjonen automatisk og elegant når
   man kommer dit, uten videospiller. Det jeg vet:
   - Animasjonen finnes bare som video i eierens PowerPoint-filer (siste
     lysark i hver forelesning; 2,3 MB, 3840 × 2160, 10 s). Den ligger
     **ikke** i logopakka (`merkevare/` har bare Hovedlogo, Symbol og
     vertikal logo).
   - Den er USNs materiale. AGENTS.md sier at slikt aldri legges i git,
     og at logoen aldri tegnes på nytt. Den kan altså verken følge med i
     repoet eller gjenskapes i kode.
   - Forslag å legge fram: programmet tar vare på animasjonsfila slik det
     gjør med logofilene (eieren peker på den én gang, eller den plukkes
     opp ved import; den lagres i innstillingene, aldri i repoet), og
     avslutningslysarket spiller den av seg selv, én gang, uten knapper.
     Spør om lyden, og om avspilling uten lyd er greit der nettleseren
     nekter lyd som starter av seg selv.
4. **Andre kilder til frie bilder.** Eieren sier at bilder i det
   offentlige domenet er «fair game». Spør hvilke kilder han tenker på.
   Hver ny kilde skal på lista i AGENTS.md og i koden, med
   lisensfiltrering og kreditering som for Commons.
5. **Rekkefølgen fram til første brukbare utgave.** Forslag: A1–A6
   først (små og bestemte), så leveranse 3 (lyd og video), og
   animasjoner og lekenhet etterpå, unntatt det som trengs for at
   navigasjonen skal føles god. Spør om han heller vil ha lekenheten før
   video.

### 6.15 Økt 5: A1–A6 er bygget (22.11.2026)

Spørsmålene i 6.14 B ble stilt samlet i chatten, med ett tillegg
(spørsmål 6: skal annen innbygging enn YouTube også lastes direkte?
Anbefaling: nei, behold «klikk for å laste»). Svarene skrives inn her
når de kommer. Ingenting fra B er bygget.

| Nr. | Bygget slik |
| --- | --- |
| A1 | Alle tekster i programmet og spilleren sier «lysark» (fanen heter «Lysark», «Nytt lysark», «Flytt lysarket opp» osv.). README, denne fila og `docs/` er skrevet om. Kode beholder `scene` |
| A2 | Nytt felt `strokeWidth` på former (format 3, se [docs/prosjektformat.md](docs/prosjektformat.md)). Element-fanen har en glidebryter «Tykkelse» (1–60) for linjer, piler og omriss, og «Tilbakestill» gir temaets tykkelse. Pilspissen vokser med tykkelsen. Importen setter ikke tykkelse; importerte piler har temaets, som før |
| A3 | Runde piler (72 px) på hver side av lysarket, ved siden av det og ikke oppå. De små pilene i bunnlinja er borte. På smal skjerm (under 700 px) står mindre piler nede i hjørnene |
| A4 | Klikk på lysarket gjør ingenting. «+»-merker, lenker og knapper virker som før |
| A5 | Pil ned = neste, pil opp = forrige. Med fokus i innholdslista, manuspanelet eller «Lær mer»-panelet ruller de panelet |
| A6 | YouTubes spiller står i lysarket og i «Lær mer»-panelet. Den hentes når lysarket vises eller panelet åpnes, starter ikke av seg selv, og tas bort når man går videre. Fra disk: stillbilde med knapp som åpner YouTube. I redigeringen: stillbildet |

**Prøvd:** automatisk på Linux Mint, 212 tester, også med hele
programmet uten vindu (tykkelse med angre, pilene, klikk som ikke går
videre, pil opp og ned, smal skjerm, og YouTube der testen selv svarer
for nettet og kontrollerer at ingenting hentes før lysarket vises).
Skjermbilder er sett på. **Ikke prøvd:** Windows, Canvas, og andre
nettlesere enn den innebygde.

### 6.16 Økt 5: Windows-utprøving av leveranse 2 og A1–A6, og leveranse 3

**Windows 11 (eierens VM), prøvd for hånd av en hjelpeagent 22.11.2026**
med zip-utgaven bygget etter A1–A6 (uten lyd og video). Alle 16 punkter
besto: start, fanen «Lysark», import av Stål (26 lysark), tykkelse på
pil med «Tilbakestill», høyreklikk og «Legg til utdyping …», byggeren
med overskrift, tekst og bilde, mediedialogen med «I prosjektet», søk i
Wikimedia Commons («bro», ett bilde satt inn med kreditering), «+»-merket,
lagring, forhåndsvisningen med runde piler, klikk som ikke går videre,
pil opp og ned, panelet med «Utvid» og Esc, **YouTubes spiller i
lysarket (lysark 8 i Stål; videoen spilte)**, og eksport til HTML åpnet i
Edge fra disk (stillbilde med «Spill av på YouTube», ingen innebygd
spiller). Ingen SmartScreen-advarsel.

Funn fra Windows, og hva som er gjort:

| Funn | Tiltak |
| --- | --- |
| End hoppet til siste lysark mens «Lær mer»-panelet var åpent og musa hadde klikket i det | Rettet: panelene tar fokus ved klikk, og tastene som ruller (pil opp og ned, Page Up og Down, Home, End) ruller «Lær mer»-panelet og manuspanelet når fokus står der |
| En tynn, syregrønn ramme rundt hele lysarket i Edge etter klikk og tastetrykk | Rettet: lysarkflaten og panelene har ikke fokusramme |
| Piltastene navigerer ikke etter at man har klikket i YouTube-spilleren | Ikke rettet: tastene går da til YouTube. De runde pilene virker. Et klikk utenfor spilleren gir tastene tilbake |
| En tom tekstblokk i byggeren tar ikke imot klikk midt i boksen, bare på første linje | Rettet: hele boksen tar imot klikk (ikke prøvd på Windows etter rettingen) |
| I «Utvid» står overskriften «Lær mer» lenger til venstre enn innholdet | Rettet: overskriften følger innholdets bredde |
| Siste lysark (USNs logoanimasjon) viser et hvitt bilde med avspillingsknapper | Videoen starter fra hvitt. Henger sammen med spørsmål 3 i 6.14 B |
| Eksportmeldingen blir stående til man trykker «Lukk» | Slik er det laget |

Ligger igjen i VM-en: `C:\Users\simen\lysark-test\v2\` (programmet og
`staal2.html`) og `C:\Users\simen\lysark-test\v2-prosjekt\`.
Skjermbildene fra utprøvingen ble ikke tatt vare på i repoet.

**Leveranse 3 (lyd og video)** er bygget i samme økt. Hva som er laget,
hva som avviker og hva som er prøvd, står i
[docs/plan.md](docs/plan.md) under «Status for leveranse 3», og
formatet i [docs/prosjektformat.md](docs/prosjektformat.md) («Format 4»).

## 7. Arbeidsordre for neste økt

Eieren vil at neste økt **bygger**, ikke bare planlegger. Rekkefølge:

1. **Still spørsmålene i 6.14 B samlet med én gang**, hvert med én
   anbefaling, slik at eieren kan svare mens A bygges. Ikke bygg noe fra
   B før han har svart.
2. **Bygg A1–A6**, ett trinn om gangen, med tester, og commit hvert
   trinn når testene består. Vis eieren skjermbilder av de runde pilene
   og av YouTube-spilleren i lysarket. Hold
   [docs/prosjektformat.md](docs/prosjektformat.md) sann når formene får
   tykkelse (A2).
3. **Prøv leveranse 2 og A1–A6 på Windows 11** i eierens VM
   ([tools/windows-vm.py](tools/windows-vm.py)). Ingenting av leveranse 2
   er prøvd der.
4. **Leveranse 3, lyd og video** ([docs/plan.md](docs/plan.md)).
   Spørsmålene er besvart i
   [docs/sporsmal-videre.md](docs/sporsmal-videre.md) (16–23). Rigg
   mikrofon i VM-en selv. Når leveranse 3 er ferdig og prøvd på begge
   systemer, finnes den første brukbare utgaven, og eieren avgjør om
   repoet skal bli offentlig. Minn ham da om de tre punktene i 6.12.
5. **Etter svarene på B:** navn og grensesnitt, lekenhet og animasjoner,
   avslutningsanimasjonen, og flere bildekilder, i den rekkefølgen
   eieren velger.
6. Gi eieren Canvas-sjekklista (6.5) når A1–A6 er bygget, og skriv inn
   det han melder.

Eieren har sagt ja til at `main` pushes til det private repoet
fortløpende, uten å spørre hver gang (22.11.2026). Synligheten rører du
ikke.

Åpent fra før, som eieren ikke har svart på: uttrykket (6.1), importen
(6.2), hvilken fil som ga den svarte videospilleren (6.11), og de tre
punktene om åpen kildekode (6.12). Tabeller i importen (del 5, punkt 5)
venter til han peker på lysark som plager ham.

## 8. Startmelding til neste chat

Eieren kan lime inn dette i en ny chat i mappa
`~/Forelesningsverktoy/lysark`:

```text
Du fortsetter arbeidet med Lysark, et skrivebordsprogram (Electron) som
gjør PowerPoint-forelesningene mine om til interaktiv HTML og
animasjonsvideo med voice-over, i USNs visuelle profil. Prosjektet ligger
i ~/Forelesningsverktoy/lysark, har sitt eget git-repo og ligger privat
på GitHub (SimenKode/lysark). Leveranse 1 (PPTX til HTML) og 2
(«Lær mer»-byggeren) er bygget.

Før du gjør noe annet:
1. Les AGENTS.md. Reglene er bindende.
2. Les HANDOFF.md: «Start her», 6.14 (min tilbakemelding etter at jeg
   prøvde leveranse 2) og del 7 (arbeidsordren).
3. Les docs/plan.md.

Rammer:
- Arbeid bare i ~/Forelesningsverktoy/lysark. Ikke les eller endre noe
  utenfor den mappa.
- Snakk med meg på norsk bokmål. Det jeg og studentene leser, er på
  bokmål; kode, kommentarer og commits på engelsk.
- Commit hvert ferdige, testede trinn, og push main til det private
  repoet fortløpende. Ikke endre synligheten.
- Tester skal aldri vise vindu på skjermen min (LYSARK_HIDDEN=1), og
  aldri kontakte nettet.
- Canvas prøver jeg selv, for hånd. Ingen KI der.

Gjør dette:
1. Still spørsmålene i HANDOFF.md 6.14 B samlet, med én anbefaling per
   spørsmål. Jeg svarer mens du bygger.
2. Bygg A1–A6 i 6.14: «scene» heter «lysark», tykkelse på piler og
   former, store runde piler på hver side i HTML-spilleren, klikk på
   lysarket går ikke videre, pil opp og ned navigerer, og YouTube
   innebygd som spiller i lysarket. Vis meg skjermbilder.
3. Prøv leveranse 2 og det nye på Windows 11 i VM-en min.
4. Bygg leveranse 3, lyd og video, slik at vi får en første brukbar
   utgave med både HTML og video. Rigg mikrofon i VM-en selv.

Hold HANDOFF.md, docs/plan.md, docs/prosjektformat.md og docs/stakk.md
sanne. Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som
ikke er prøvd.
```

Slik sammenlignes importen med PDF-ene: `tests/real-screens.test.ts`
tar bilder av lysarkene (se toppen av fila), og `pdftoppm` gir bilder av
PDF-sidene. Legg dem side om side og se på dem. `pdftotext -bbox` gir
ordposisjonene i PDF-en når noe må måles nøyaktig.
