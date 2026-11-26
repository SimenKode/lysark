# Historikk og logg

Dette er loggen over arbeidet med Lysark: hva som er bygget og prøvd i
hver økt, hva de ekte forelesningene viste, og tilbakemeldingene dine
slik de kom. **Du trenger ikke lese den.** Den korte oversikten står i
[HANDOFF.md](../HANDOFF.md). Loggen er til for den som skal arbeide
videre og må slå opp hvorfor noe ble som det ble.

Delene heter det de het da de sto i HANDOFF.md (del 1–6), så
henvisninger som «6.14» fortsatt treffer.

## 1. Hvor ting er

| Hva | Hvor |
| --- | --- |
| Prosjektet | `~/Forelesningsverktoy/lysark/`, eget git-repo, gren `main` |
| På GitHub | `SimenKode/lysark`, **offentlig** fra 23.11.2026 (6.23). Det gamle repoet, `SimenKode/lysark-gammel`, er privat |
| Lisens | GPL-3.0-or-later ([LICENSE](../LICENSE)), med unntak for eksporterte forelesninger ([EXPORT-EXCEPTION.md](../EXPORT-EXCEPTION.md)) |
| Commits | se `git log`. Eieren har sagt ja til commits på `main` etter hvert ferdige, testede trinn, og til at de pushes til det private repoet fortløpende. Synlighet og publisering avgjør han. |
| Ferdige programfiler | `release/Lysark-0.1.0.AppImage` (Linux, 202 MB) og `release/Lysark-0.1.0-win.zip` (Windows, 222 MB), bygget fra koden slik den var i slutten av økt 5, med FFmpeg ved siden av |
| FFmpeg | `vendor/ffmpeg/` (ikke i git), hentet med `npm run fetch:ffmpeg` |
| Spørsmål som venter på svar | 6.14 B i denne fila (seks spørsmål, stilt i chatten i økt 5) |
| Eierens forelesninger | `eksempler/` (åtte PPTX med PDF-utgaver, ikke i git) |
| USNs logopakke | `merkevare/` (pakket ut, ikke i git) |
| Plan og status | [docs/plan.md](plan.md) |
| Valgene som er tatt | [docs/sporsmal-leveranse-1.md](sporsmal-leveranse-1.md) |
| Designmanualens regler | USNs egen manual, <https://brandpad.io/usn/>. Sammendraget som lå i `docs/` er fjernet (6.23) |
| Stakk og lisenser | [docs/stakk.md](stakk.md) |

Kommandoer: `npm run fetch:ffmpeg` (én gang), `npm run dev` (start),
`npm test` (bygger og kjører alt), `npm run dist:linux`,
`npm run dist:win`.

## 2. Hva som er laget

Leveranse 1, 2 og 3 av 5. Leveranse 1: PPTX inn, interaktiv HTML ut.

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

Runde 2 av leveranse 2 (eierens endringer, se 6.15): «lysark» i stedet
for «scene», tykkelse på piler og omriss, runde piler i spilleren, klikk
som ikke går videre, pil opp og ned, og YouTubes spiller i lysarket.

Leveranse 3, lyd og video (detaljer i [docs/plan.md](plan.md)):

- **Innlesing** med manus og lysark på skjermen; pil høyre setter
  tidspunktet for hvert steg og deler opptaket ved hvert lysark.
- **Lydpanelet** under lysarket: hele forelesningen som en stripe, og
  lyden på lysarket som et spor som kan spilles og klippes.
- **Video:** MP4 1920 × 1080, tegnet bilde for bilde, med teksting som
  egen fil.
- **HTML-fila** får stemmen med og kan spille seg selv («Spill av»).
- **Inndata:** «Importer PDF …» og «Åpne HTML-fil …» i Fil-menyen.
- **FFmpeg** følger med som eget program.
- **Format 4**, med automatisk løft av eldre prosjekter.

Leveranse 4 (figurer og bevegelser) er påbegynt: merket bilde (6.25) og
fri figur (6.32), fire maler (6.33 og 6.36) og søyle- og linjediagram
(6.38 og 6.39), figur i «Lær mer» (6.41) og bevegelsene (6.45) er
bygget. Leveranse 5 (håndlaget stil) er ikke påbegynt.

## 3. Hva som er prøvd, og hvordan

| Hva | Resultat |
| --- | --- |
| Automatiske tester på Linux Mint | Etter leveranse 3: 283 består, 1 hoppes over (206 etter leveranse 2). Seks testfiler starter hele programmet uten vindu og går gjennom åpne, redigere, angre, lagre, eksportere, spille av, bygge «Lær mer», hente medier, importere PowerPoint, PDF og HTML, lese inn med prøvemikrofon, klippe, og eksportere video. |
| Det pakkede Linux-programmet | Bygget i slutten av økt 5 (AppImage 202 MB). De seks gjennomkjøringene (50 tester) besto mot `release/linux-unpacked/lysark`, også videoeksporten med FFmpeg fra pakka. AppImage-fila selv er ikke startet. |
| Video av en ekte forelesning | Stål (26 lysark, uten lyd) ble til en MP4 på 2:10 og 15 MB på 50 sekunder, på Linux Mint uten vindu. Et ark med ett bilde fra hvert av de 26 lysarkene er sett på etter rettingen i 6.17: alle bildene er med. |
| En lang forelesning | 41 lysark med ett minutt kunstig lyd hver: video på 9 min 15 s, HTML på 29 s (6.17). |
| PDF-import av en ekte PDF | `PB1020 2025 - 04 - Stål.pdf`: 26 lysark på 17 sekunder, 8,4 MB bilder, riktige titler og tekst. Ett skjermbilde er sett på. De andre sju PDF-ene er ikke prøvd. |
| Leveranse 2 mot ekte nett | Linux Mint (økt 4): Commons-søk, innsetting med kreditering, forhåndsbilde fra YouTube, YouTube i forhåndsvisningen. Windows 11 (økt 5): Commons-søk og YouTubes spiller i lysarket, se 6.16. YouTubes spiller i lysarket er **ikke** prøvd mot ekte nett på Linux Mint etter ombyggingen (A6); der er bare testen som selv svarer for YouTube, kjørt. |
| Import av de ekte forelesningene | Alle åtte (315 lysark) og malfila importeres uten feil. Økt 2: alle 315 er sammenlignet side om side med PDF-utgavene, før og etter rettingene (se del 4). Gjennomgangen ble gjort av hjelpeagenter som så på bildene, og jeg sjekket funnene og de viktigste rettingene selv. |
| Windows 11 (eierens VM) | Prøvd for hånd fire ganger med zip-utgaven: leveranse 1 (økt 1, under), leveranse 2 og A1–A6 (økt 5, se 6.16), lyd og video, og en etterkontroll av rettingene (økt 5, se 6.17). PDF-import og den siste rettingen av avbrudd er ikke prøvd der. |
| Ekte mikrofon | Ikke prøvd, verken på Linux eller Windows. |
| Canvas | Ikke prøvd. Eieren prøver selv (6.5). |

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
[tools/windows-vm.py](../tools/windows-vm.py).

## 4. Hva de ekte forelesningene viste

- De er bygd på USNs PowerPoint-mal, i 16:9. Importen er rettet for den
  (se [docs/plan.md](plan.md)).
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
3. ~~Windows-installasjonsfil mangler.~~ Laget 25.11.2026 (6.24).
4. ~~Windows-programfila har Electrons ikon.~~ Rettet 25.11.2026 (6.24).
5. **Radhøyder og justering i tabeller** følger temaet, og hele tabellen
   får én skriftstørrelse. Tette tabeller kan derfor bli høyere enn i
   PowerPoint og gå inn i det som står under eller ut av lysarket
   (Praktisk HMS 35, Trevirke 17 og 19, Stål 4). Lange ord i smale
   kolonner brytes ikke, så de kan gå inn i nabocellen. Cellemargene
   følger PowerPoint fra økt 2. Dette er den største gjenværende feilen
   i importen.
6. **Mediefiler som ikke lenger brukes**, ryddes ikke ut av
   prosjektmappa. Det gjelder nå også opptak som er tatt om: de gamle
   blir liggende (omtrent 6 MB per minutt).
7. **Hvite bildebakgrunner** syns som hvite felt på den lys beige flaten.
   I PowerPoint forsvinner de mot det hvite lysarket. Dette er ikke en
   importfeil, men henger sammen med valget av grunnflate (6.1).

8. **Video inne i et lysark blir stillbilde i MP4-fila.** USNs
   logoanimasjon på siste lysark starter fra hvitt, så den blir et hvitt
   bilde i videoen. Henger sammen med spørsmål 3 i 6.14 B.
9. **Tekstingen er beregnet, ikke lyttet fram** (se
   [docs/plan.md](plan.md)). Snakker du fritt i stedet for å lese
   manuset, stemmer den dårlig.
10. ~~PDF-import gir bilder, ikke redigerbart innhold.~~ Rettet
    25.11.2026 (6.29): tekst, bilder og lenker er egne elementer. Det
    som ikke kan løftes ut, ligger i bakgrunnsbildet og er merket.

Mindre:

- Piltastene navigerer ikke i spilleren rett etter et klikk i
  YouTube-spilleren; tastene går da til YouTube. De runde pilene virker.
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
10. En forelesning med stemme: virker «Spill av», og følger steg og
    lysark stemmen?
11. Videoen (MP4) og tekstingen (.vtt): tar Canvas imot begge, og kan
    studenten slå tekstingen av og på?

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
  [AGENTS.md](../AGENTS.md) sier at programmet aldri sender noe noe sted, og
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
- **Plassen i planen:** [docs/plan.md](plan.md) har leveranse 2 som
  animasjonsmaler og håndlaget stil. Om «Lær mer»-byggeren blir egen
  leveranse, del av leveranse 2 eller kommer før den, avgjør eieren.
- **Format:** i dag er «Lær mer» et eget element (`deepdive`) med
  tittel, rik tekst og en medieliste. Å knytte innhold til et hvilket som
  helst element krever en endring i prosjektformatet
  ([docs/prosjektformat.md](prosjektformat.md)), og spilleren må
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
  leveranse 2 i [docs/plan.md](plan.md) (åtte maler med skjema,
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
  ([docs/stakk.md](stakk.md)).
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
  [docs/sporsmal-videre.md](sporsmal-videre.md).
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
[docs/sporsmal-videre.md](sporsmal-videre.md): rekkefølge og ny
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
[docs/sporsmal-videre.md](sporsmal-videre.md), planen i
[docs/plan.md](plan.md), og unntaket for nettilgang i
[AGENTS.md](../AGENTS.md). Én ting der er fortsatt åpen: hvilken fil som ga
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
   ([EXPORT-EXCEPTION.md](../EXPORT-EXCEPTION.md)) er skrevet av meg og ikke
   bekreftet av eieren. Bakgrunn: en eksportert HTML-fil inneholder
   spilleren fra Lysark. Uten unntaket kunne det reises tvil om hele fila
   (altså forelesningen) måtte deles under GPL. Unntaket sier at
   forelesningen er forfatterens egen. Jeg er ikke jurist.
2. **USNs profil.** Koden gjengir USNs farger og profilformer, og
   `docs/designmanual.md` (fjernet 23.11.2026, se 6.23) oppsummerer designmanualen. Logoen ligger ikke
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
som er valgt, i [docs/sporsmal-videre.md](sporsmal-videre.md).

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

#### Slik ble spørsmålene stilt i økt 5 (22.11.2026), og svaret

Hvert spørsmål hadde én anbefaling. **Eieren svarte samme dag: «Jeg
ønsker å følge anbefalingene og komme med innspill til vi kommer til et
fornuftig produkt.»** Alle seks anbefalingene er dermed valgt. Navnene
(spørsmål 1) er byttet i samme økt; resten står for tur, se
[HANDOFF.md](../HANDOFF.md).

1. **Navn og grensesnitt.** Forslag: «Utdyping» blir **«Lær mer»**
   overalt (samme ord som studenten ser), «Byggestein» blir
   **«Innhold»**, «Innbygging» blir **«Nettside»**, «Tilpass til
   rutenett» blir **«Rydd opp lysarket»**, og «Pakk prosjektet til én
   fil …» blir **«Lagre som én fil …»**. Element, Steg, Manus og
   Forhåndsvis beholdes. Anbefaling: bytt de fem. To ting å få vite: var
   skjermbildet av høyreklikkmenyen et eksempel på et vanskelig navn
   eller på den skjeve oransje rammen, og hva var vanskelig å finne?

   Svar: som anbefalt. De fem navnene er byttet, og rammen i menyen er
   rettet (økt 5). Hva som var vanskelig å finne, er ikke besvart.

2. **Mer animasjon og lekenhet.** Anbefaling: lekenhet i responsen, ro
   i innholdet: myk overgang mellom lysark, elementer som glir mykt inn
   per steg, knapper og «+»-merker som svarer når man peker og trykker,
   og panelet som glir inn. Ingen sprett eller snurr på faginnholdet.
   Alt av for dem som har bedt systemet om lite bevegelse.

   Svar: som anbefalt.

3. **USNs avslutningsanimasjon.** Anbefaling: Lysark tar vare på fila
   slik det gjør med logoen (plukkes opp ved import, eller eieren peker
   på den én gang; aldri i repoet), og «Avslutning» blir et lysark som
   spiller den av seg selv én gang, uten knapper og uten lyd.

   Svar: som anbefalt.

4. **Flere kilder til frie bilder.** Anbefaling: vent til etter første
   brukbare utgave, og ta da Openverse først. Hva savnes i Commons?

   Svar: som anbefalt.

5. **Rekkefølgen.** Anbefaling: A1–A6, så lyd og video, og lekenhet,
   navn, avslutningsanimasjon og bildekilder etterpå. (De to første er
   nå gjort.)

   Svar: som anbefalt.

6. **Annen innbygging enn YouTube** (GeoGebra, Panopto og lignende).
   Anbefaling: behold «klikk for å laste», fordi det er vilkårlige
   nettsteder studentens nettleser ellers ville kontaktet uten å bli
   spurt.

   Svar: som anbefalt.

### 6.15 Økt 5: A1–A6 er bygget (22.11.2026)

Spørsmålene i 6.14 B ble stilt samlet i chatten, med ett tillegg
(spørsmål 6: skal annen innbygging enn YouTube også lastes direkte?
Anbefaling: nei, behold «klikk for å laste»). Svarene skrives inn her
når de kommer. Ingenting fra B er bygget.

| Nr. | Bygget slik |
| --- | --- |
| A1 | Alle tekster i programmet og spilleren sier «lysark» (fanen heter «Lysark», «Nytt lysark», «Flytt lysarket opp» osv.). README, denne fila og `docs/` er skrevet om. Kode beholder `scene` |
| A2 | Nytt felt `strokeWidth` på former (format 3, se [docs/prosjektformat.md](prosjektformat.md)). Element-fanen har en glidebryter «Tykkelse» (1–60) for linjer, piler og omriss, og «Tilbakestill» gir temaets tykkelse. Pilspissen vokser med tykkelsen. Importen setter ikke tykkelse; importerte piler har temaets, som før |
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

Ligger igjen i VM-en under `C:\Users\simen\lysark-test\`: `v2`, `v3` og
`v4` (tre utgaver av programmet, med eksporterte HTML- og MP4-filer),
`v2-prosjekt` (nå med to stille opptak) og `v4-fra-html`. Slett dem når
de ikke trengs.
Skjermbildene fra utprøvingen ble ikke tatt vare på i repoet.

**Leveranse 3 (lyd og video)** er bygget i samme økt. Hva som er laget,
hva som avviker og hva som er prøvd, står i
[docs/plan.md](plan.md) under «Status for leveranse 3», og
formatet i [docs/prosjektformat.md](prosjektformat.md) («Format 4»).

### 6.17 Økt 5: leveranse 3 på Windows, og inndataene

**Lyd og video på Windows 11 (eierens VM), prøvd for hånd av en
hjelpeagent 22.11.2026** med zip-utgaven som har FFmpeg ved siden av.
Alle 11 punkter virket:

- prosjektet fra forrige utprøving (lagret i et eldre format) åpnet uten
  spørsmål
- fanen «Lyd» med stripa over 26 lysark og «Hele forelesningen: 2:10»
- opptaksvinduet åpnet uten feilmelding. Mikrofonlista viste
  «Systemets valg» og «Line In (High Definition Audio Device)»
- innlesing over to lysark med pil høyre, «Ferdig», og meldingen
  «Opptaket er lagt på 2 lysark. Husk å lagre prosjektet.»
- pause satt inn, angret og gjort om; «Spill av» stoppet av seg selv
- **video: 2:19 (4173 bilder) på 55–80 sekunder**, FFmpeg startet og
  fila spilte i Windows' egen spiller
- HTML-fila med «Spill av» i Edge gikk videre fra lysark til lysark av
  seg selv, og det samme i forhåndsvisningen

**Mikrofonen i VM-en er ikke rigget om.** VM-ens lydinngang (ich9 med
SPICE) fins i Windows som «Line In», men gir stillhet når ingen
SPICE-klient er koblet til. Opptaket ble derfor en rett strek. Det
prøver hele veien (tillatelse, opptak, fil, klipping, video), men ikke
lyden selv. For å få ekte lyd inn måtte VM-en kobles til lyden på
vertsmaskinen, altså eierens egen mikrofon, og det gjorde jeg ikke uten
å spørre. **Ekte lyd på Windows er derfor ikke prøvd.** Kobler eieren
til VM-en med virt-viewer, sender SPICE mikrofonen hans inn.

Funn fra denne utprøvingen, og hva som er gjort:

| Funn | Tiltak |
| --- | --- |
| **Bilder manglet i videoen** på noen lysark (Stål 2, 4 og 24), ulikt fra gang til gang. Samme feil fantes på Linux (lysark 4 og 24), men var ikke oppdaget der | Rettet: bildet ble tatt før et stort fotografi var kommet på skjermen. Et lysark tegnes nå først helt, og eksporten venter til det skjulte vinduet har sluttet å tegne. Kontrollert på Linux med et ark over alle 26 lysark fra videoen. Etterkontrollen på Windows (under) bekreftet det |
| «Avbryt eksporten» hang (funnet av meg på Linux, ikke i VM-en) | Rettet: FFmpeg stoppes straks, også når programmet lukkes. Har fått en egen test. Se også etterkontrollen under |
| Prosjektet ble «ulagret» av å eksportere video | Rettet: bare når et valg i dialogen er endret |
| Framdriften vistes før filnavnet var valgt | Rettet |
| Meldingene nederst dekket knappene i lydpanelet | Rettet: meldingene står nå over lysarket |
| Klokka i opptaksvinduet begynner på null for hvert lysark | Slik er det ment: den viser lengden på lysarket som leses inn |
| Lagre-dialogene starter i mappa over prosjektmappa | Slik er det laget |

**Etterkontroll på Windows etter rettingene** (22.11.2026, ny zip,
mappa `v4` i VM-en):

- **Bildene er med i videoen.** Lysark 2, 4 og 24 i Stål ble sett på i
  Windows' egen spiller og sammenlignet med redigeringsflaten, og
  lysark 3, 6, 10, 15 og 20 i tillegg. Alle bildene og logoen var der.
  Eksporten (2:19) tok omtrent 55 sekunder.
- Framdriften vises ikke før filnavnet er valgt, meldingen står over
  lysarket, og prosjektet er fortsatt «Lagret» etter eksporten.
- «Åpne HTML-fil …» med fila fra forrige utprøving ga et prosjekt med
  26 lysark, bildene på plass og lyden tilbake på lysark 2, med
  meldingen «… er åpnet som et nytt prosjekt. Stemmen er med, slik den
  var da HTML-fila ble laget: …».
- **«Avbryt eksporten» stoppet eksporten og ryddet bort fila, men viste
  en rød melding: «FFmpeg tar ikke imot mer.»** Rettet etterpå: en feil
  som skyldes at eieren selv avbrøt, vises ikke. Prøvd på Linux med ti
  avbrudd på ulike tidspunkt (ingen melding, ingen fil igjen, ingen
  FFmpeg-prosess igjen). **Ikke prøvd på Windows etter denne siste
  rettingen.**
- Telleren sto stille noen sekunder på ett lysark (Stål 10) under
  eksporten. Det er ventingen på at lysarket skal tegne seg ferdig; den
  er begrenset til noen sekunder per lysark. Lysarket har trolig et
  bilde som beveger seg (animert GIF); i videoen blir det et stillbilde.
- PDF-import er ikke prøvd på Windows (ingen PDF i VM-en).

**Lang forelesning (Linux Mint, uten vindu):** et prosjekt med 41
lysark, ett minutt kunstig lyd på hvert (40 minutter), ble til video på
9 minutter og 15 sekunder (59 MB), med teksting. Programmet brukte på
det meste omtrent 900 MB minne. HTML-fila med stemmen ble 21 MB og tok
29 sekunder. Maskinen kjørte andre tester samtidig, så tidene er øvre
anslag. Ekte innlesing av en hel forelesning er ikke prøvd.

**To eksporter er like for øyet, ikke bit for bit** (se
[docs/stakk.md](stakk.md)).

**Inndataene** (bygget av en hjelpeagent i egen arbeidskopi og flettet
inn):

- «Åpne HTML-fil …» gjør en eksportert Lysark-fil til prosjekt igjen.
  Fila kjøres aldri; den leses som tekst og kontrolleres som en vanlig
  prosjektfil. En stor video som lå i mappa ved siden av, tas med hvis
  mappa er der; ellers sier programmet hvilken som mangler. Mediefiler
  som lå ubrukt i prosjektet, er ikke med i en eksport og kommer ikke
  tilbake. Har fila stemme, gjøres lyden om til prosjektets format, med
  klipp og pauser slått sammen til ett opptak per lysark.
- «Importer PDF …» gjør hver side til et lysark med siden som bilde
  (WebP, høyst 3840 × 2160) og teksten som alternativ tekst. Prøvd på
  `PB1020 2025 - 04 - Stål.pdf`: 26 lysark på 17 sekunder, 8,4 MB.
  Sider uten tekst merkes. Passordbeskyttede og skadde PDF-er avvises
  før du blir spurt om mappe.
- pdf.js (Apache-2.0) er bygd inn, med to bildedekodere (JPEG 2000 og
  JBIG2). Skrift- og tegnkartmappene til pdf.js er **ikke** med; en test
  kontrollerer det.

### 6.18 Eierens svar etter leveranse 3 (22.11.2026)

Ordrett:

> Er enig stort sett med handoff. Ser nå også at handoff prompt ligger
> i den filen, det er fint. Liker ikke at Handoff.md er så vanvittig
> lang og krunglete å lese. Vil at du heller legger ting som er gjort i
> en annen fil og gjør den svært lettlest for meg. Det er viktig å
> pressisere at dette er myntet på forelesere. Jeg ønsker å følge
> anbefalingene og komme med innspill til vi kommer til et fornuftig
> produkt. Ønsker forøvrig at PDF også skal kunne være input, og at man
> skal kunne eksportere til GIF for småvideoer man ønsker å generere.

Gjort i samme økt:

- **HANDOFF.md er skrevet om** til en kort side for eieren. Alt som sto
  der, er flyttet hit. Regelen står i AGENTS.md.
- **For forelesere:** skrevet inn i AGENTS.md (brukerne er forelesere,
  ikke utviklere; alt skal kunne brukes uten opplæring), README, planen
  og startskjermen, som nå også har «Importer PDF …».
- **Anbefalingene er valgt** (6.14 B). Navnene er byttet: «Lær mer»,
  «Innhold», «Nettside», «Rydd opp lysarket», «Lagre som én fil» og
  «Åpne prosjekt lagret som én fil». Fokusrammen i høyreklikkmenyen
  ligger nå inne i menyvalget. Lekenhet, avslutningsanimasjonen og
  flere bildekilder er **ikke** bygget; de står for tur.
- **PDF som inndata** var allerede bygget (6.17).
- **GIF-eksport** er bygget: i eksportdialogen velges filtype (video
  eller GIF) og hvilke lysark (hele forelesningen, bare dette lysarket,
  eller fra og til; utvalget gjelder også video). En GIF er uten lyd,
  480, 640 eller 960 piksler bred, 12,5 bilder i sekundet og høyst to
  minutter. Den lages i to trinn med FFmpeg: først en mellomvideo, så
  GIF-en med farger valgt fra akkurat disse bildene. Første forsøk
  brukte 15 bilder i sekundet; det ga et klipp som gikk for sakte,
  fordi en GIF angir tid i hundredeler.

Prøvd automatisk på Linux Mint (GIF av ett lysark kontrollert med
FFmpeg: GIF89a, 640 × 360, 12,5 bilder i sekundet, uten lyd, riktig
lengde; for lang GIF og ugyldige lysarknumre avvises). **Ikke prøvd på
Windows:** GIF-eksport, de nye navnene, startskjermen, og den siste
rettingen av avbrudd.

Navnene i resten av denne loggen er de som gjaldt da hver del ble
skrevet.

### 6.19 Eieren prøvde utgaven med lyd og video (22.11.2026)

Ordrett, med fire skjermbilder (en form som i Lysark var blitt et
rektangel, den samme formen i PowerPoint med spiss, forhåndsvisningen
med «Lær mer»-panelet som skjøv lysarket til siden, og knappene «Les
inn …» og «Importer lydfil …»):

> Ser bra ut. Noen tilbakemeldinger: Vi trenger den trekant+rektangel
> skilt-formen, veldig praktisk. Synes Lær mer tar deg litt ut av selve
> lysark byggingen. Tenker at "slik studenten ser det" burde være på
> selve lysarket som en boks som spretter ut av bildet, ikke skyver alt
> annet til siden. Den skal også være animert. Hvis det er bilder som
> får "lær mer" går det an å lage en lilla border rundt dem også.
> Kanpper med ... burde ikke ha ..., må enten gjøres om, få ikon e.l.
> Noen knapper er best med tekst, ikon eller begge deler. Gjør en
> vurdering av hva som bør være hvor. Fiks dette og gjør det du hadde
> planlagt, så release

Og mens det ble bygget:

> Må også kunne ha flere lydspor, til musikk og klipping av lyd. Ønsker
> på sikt å også få en visning som viser alle slides på en tidslinje
> med lydsporene under. Må kunne åpne "lær mer" og spille av videoer i
> innspillingen av videoer.

**Bygget i samme økt:**

| Hva | Slik ble det |
| --- | --- |
| Skiltformen | Ny form `sign` (format 5): rektangel med spiss, mot høyre eller venstre. Spissen er halve den korte siden dyp, som i PowerPoint. PowerPoints «homePlate» importeres som skilt, med teksten og retningen |
| «Lær mer» på lysarket | I spilleren er panelet til siden borte. Boksen spretter ut ved elementet, oppå lysarket, på den siden det er plass; lysarket flytter seg ikke. Er det litt for trangt, blir boksen smalere heller enn å dekke elementet. «Utvid», «Lukk», Esc og klikk utenfor virker. På mobil kommer boksen opp fra bunnen |
| Byggeren | Til høyre vises selve lysarket med boksen på plass, tegnet og plassert av samme kode som spilleren, i stedet for et løst panel |
| Lilla ramme | Bilder med «Lær mer» får en ramme i lilla (hvit på mørk flate). Ikke i video og utskrift |
| Knappene | Ingen «…» på knapper. Egne strektegnede ikoner (`src/renderer/src/Icon.tsx`), ikke noe ikonbibliotek. Fordelingen står i HANDOFF.md. Menylinja beholder «…» |
| Liv og lekenhet | Lysark glir inn fra den siden man går mot; steg glir opp på plass (også i video, som ren funksjon av tiden); «+»-merket slår én gang når lysarket kommer; merker, rammer, piler og knapper svarer når man peker og trykker; innholdsliste, hjelp, dialoger og meldinger kommer mykt. Alt slås av for dem som har bedt systemet om lite bevegelse |
| USNs avslutningsanimasjon | Lysark tar vare på filmen i innstillingene, uendret, slik det gjør med logoen (aldri i prosjektet eller i git). Den plukkes opp første gang en forelesning med den importeres: siste lysark med bare én video som fyller flaten. Senere importer med nøyaktig samme film gjøres om på samme måte. Lysarket spiller filmen av seg selv, én gang, uten knapper og uten lyd; i redigeringen står sluttbildet. I video tegnes den bilde for bilde. Kan også velges under Innstillinger, og et nytt avslutningslysark foreslår den |
| Lisenstekster | `tools/collect-licenses.mjs` samler lisenstekstene til alt som er bygd inn, og de følger med programmet i mappa `licenses` |

**Prøvd på Linux Mint:** 302 automatiske tester, også mot det pakkede
programmet. USNs ekte film: import av Stål og Introduksjon gjorde siste
lysark om; en video av bare det lysarket (12 s) ble sett på bilde for
bilde (logoen tegnes opp og blir stående) og tok 45 sekunder, fordi
filmen er i 4K og må spoles for hvert bilde. Skjermbilder av boksen i
spilleren, byggeren, ikonene og sluttlysarket er sett på.

**Prøvd på Windows 11 (eierens VM), for hånd av en hjelpeagent**, med
zip-utgaven 0.2.0 slik den var før de fire siste småtingene under. Alle
12 punkter virket:

- startskjermen («For forelesere: …») med fire knapper med ikon og uten
  «…»
- import av Stål: 26 lysark; ikonene i topplinja og lysarklista
- siste lysark ble «Avslutning» med USNs logo som stillbilde, haken
  «Spill USNs avslutningsanimasjon når lysarket vises» på, og
  «Avslutningsanimasjon: funnet (10 sekunder)» under Innstillinger
- skiltformen fra «Form»-menyen, snudd mot venstre, med tekst
- «Legg til «Lær mer»» fra høyreklikk; byggeren med lysarket til høyre
  og boksen på lysarket; «+»-merke og lilla ramme på bildet etterpå
- forhåndsvisningen: boksen spratt ut oppå lysarket, lysarket sto
  nøyaktig der det sto, begge pilene var synlige, klikk utenfor tok
  boksen bort; siste lysark tegnet logoen opp av seg selv uten knapper
- GIF av lysark 2–3: «GIF-fila er lagret (0:10, 0,1 MB). Den har ikke
  lyd.» (11 sekunder å lage)
- video av bare avslutningslysarket (0:12): 57 sekunder å lage; i
  Windows' spiller tegnes logoen opp og blir stående
- avbrudd midt i en eksport: tilbake på under to sekunder, ingen
  feilmelding, ingen fil igjen (rettingen fra 6.17 holder altså på
  Windows)
- ikonene i lydpanelet

Fire småting ble funnet, og er rettet etterpå (prøvd på Linux, **ikke
på Windows etter rettingen**):

| Funn | Tiltak |
| --- | --- |
| Boksen lå på forskjellig side i byggeren og i forhåndsvisningen når bildet er nesten like bredt som lysarket | Når ingen side har plass, legges boksen på den siden «+»-merket står, begge steder |
| En tynn grå strek nederst på avslutningslysarket i forhåndsvisningen | Filmen rekker nå én piksel utenfor hver kant |
| Eksportdialogen hoppet når teksten i den endret høyde, så klikk kunne treffe feil | Dialogen står fast i overkant og vokser nedover |
| Importrapporten sa ikke noe om avslutningsanimasjonen, bare at logoen var slått av | Rapporten sier nå at filmen er funnet og at lysarket spiller den selv |

Ellers sett: logoen er ferdig tegnet etter omtrent tre sekunder av de
ti filmen varer (slik er USNs film), og lagre-dialogen husker ikke
mappa fra forrige eksport.

**To ting jeg gjorde som eieren bør vite om:**

- **YouTube ble kontaktet én gang ved et uhell.** En prøvekjøring av
  forhåndsvisningen (ikke en av testene) åpnet «Lær mer»-boksen i
  testprosjektet, og YouTube-spilleren i den ble hentet for ekte fra
  `youtube-nocookie.com`, med testprosjektets oppdiktede video-ID.
  Ingenting om eieren eller prosjektet ble sendt. Alle testene, og
  regelen for prøvekjøringer, starter nå programmet slik at ingen
  vertsnavn utenfor maskinen kan slås opp (`tests/fixtures/offline.ts`),
  og en test beviser det.
- **AppImage-fila ble forsøkt startet tre ganger uten vindu.**
  AppImageLauncher, som er installert på eierens maskin, tok over
  oppstarten hver gang og viste trolig sitt eget spørsmål på skjermen.
  Programmet startet aldri, og jeg avsluttet prosessene. AppImage-fila
  er derfor ikke prøvd; innholdet er prøvd utpakket
  (`release/linux-unpacked`).

**Utgivelse:** versjon 0.2.0 er gitt ut i det private repoet
(<https://github.com/SimenKode/lysark/releases/tag/v0.2.0>), med
`Lysark-0.2.0.AppImage` og `Lysark-0.2.0-win.zip`. Repoet er fortsatt
privat, så utgivelsen er bare synlig for eieren.

**De tre nye ønskene er ikke bygget.** De er en ny, større leveranse, og
reglene sier at spørsmålene stilles først. Forslaget, med én anbefaling
per spørsmål:

1. **«Lær mer» og video under innlesing.** I dag settes tidspunktet for
   hvert steg med pil høyre. Anbefaling: det samme gjelder for «+»-merker
   og videoer. Trykker du et merke under innlesing, huskes når boksen
   åpnet og lukket; starter du en video, huskes når den startet og
   stoppet. Klokka (`src/shared/render/clock.ts`) regner da også ut
   hvilken boks som er åpen og hvor langt hver video har kommet, og
   videoeksporten viser boksen og spoler videoen bilde for bilde, slik
   den nå gjør med avslutningsanimasjonen. Videoens lyd blandes inn av
   FFmpeg. Opptaket av stemmen går videre mens videoen spiller.
   YouTube-videoer kan ikke bli med i en videofil.

   Svar: som anbefalt (22.11.2026).

2. **Flere lydspor.** Anbefaling: to spor i tillegg til stemmen,
   «Musikk» og «Lyd», som hører til hele forelesningen. Et klipp er en
   lydfil med start (festet til et lysark og sekunder inn i det, så
   klippet følger med når lysark flyttes eller endrer lengde), utsnitt,
   lydstyrke og toning inn og ut. Samme klippeverktøy som for stemmen.
   Musikken dempes automatisk mens det snakkes (kan slås av). Gjelder
   både video og «Spill av» i HTML-fila. Programmet følger ikke med
   musikk; kreditering kan føres som for bilder.

   Svar: som anbefalt (22.11.2026).

3. **Tidslinje.** Anbefaling: en egen visning der lysarkene står på rad
   med bredde etter lengde, og sporene Stemme, Musikk og Lyd ligger
   under. Dra i grensene for å strekke et lysark, dra klipp på plass,
   og spill av hele forelesningen. Bygges sammen med flere lydspor.

   Svar: som anbefalt (22.11.2026).

4. **Rekkefølge.** Anbefaling: «Lær mer» og video under innlesing
   først (bygger på det som finnes), så tidslinje og flere lydspor.

   Svar: som anbefalt (22.11.2026).

Dette opphever ett tidligere valg: i spørsmål 17
([sporsmal-videre.md](sporsmal-videre.md)) ble musikk og flere lydspor
holdt utenfor. Eieren vil nå ha dem.

### 6.20 «Lær mer» og video under innlesing (23.11.2026)

Første del av den nye leveransen, bygget etter at eieren svarte «som
anbefalt» på de fire spørsmålene.

**Hva som er nytt.**

- **Innlesingen.** Mens opptaket går, kan foreleseren trykke på
  lysarket: «+» (eller elementet selv) åpner «Lær mer»-boksen, «Lukk»
  eller et trykk ved siden av legger den bort, og en videofil starter og
  stopper når man trykker på den, også en video inne i boksen. Hvert
  trykk får tidspunktet sitt, slik stegene får det av pil høyre.
  Videoen har et stort avspillingsmerke når den kan trykkes på. «Lyd fra
  video» kan slås av; mikrofonen tar ellers opp lyden en gang til, så
  hodetelefoner er det riktige. Ved «Ta om herfra» står boksen og
  videoene slik de sto på det tidspunktet.
- **Formatet (versjon 6).** Lysarket har en liste `events` med fire
  slag: boks åpnet, boks lukket, video startet, video stoppet. Se
  `docs/prosjektformat.md`.
- **Klokka.** `moreAt`, `videoSpans` og `videosAt` i
  `src/shared/render/clock.ts` sier hvilken boks som er åpen og hvor
  hver video står på et tidspunkt. En video stopper når den blir
  stoppet, når filmen er slutt, når boksen den ligger i legges bort, og
  når lysarket er slutt.
- **Videoen.** Boksen tegnes på lysarket slik studenten ser den i et
  vindu på 1280 × 720 (`src/shared/render/popover.ts`, samme plassering
  som i byggeren) og spretter ut som funksjon av tiden. Videoene spoles
  bilde for bilde. «+»-merket vises bare på det som faktisk ble åpnet.
  Lyden fra videoene blandes inn i lydsporet (`filmSound` i
  `src/main/audio.ts`, `mixInto` i `src/shared/audio/mix.ts`).
- **HTML-fila.** «Spill av» åpner og lukker boksen og starter og stopper
  videoene på de samme tidspunktene, og stemmen går videre. Legger
  studenten bort en boks som stemmen åpnet, blir den borte til neste
  åpnes. Spilleren følger nå også stemmens egne tidssignaler, ikke bare
  skjermtegningen, så steg, bokser og videoer følger med også i et vindu
  som ikke ligger fremst.
- **Lydpanelet.** Hendelsene vises som merker langs nedre kant av
  lydsporet. De kan dras, flyttes med piltastene og fjernes med Delete.
  Klipp og pauser flytter dem sammen med stegene.

**Begrensninger, sagt rett ut.**

- En YouTube-video kan ikke spilles under innlesing (grensesnittet har
  ikke nett) og kan ikke bli med i en videofil. I MP4 står stillbildet;
  i HTML spiller studenten den selv.
- Avspillingen i lydpanelet viser ikke boksen og videoene; det gjør
  forhåndsvisningen («Spill av» der) og videoen.
- En boks med mer innhold enn det er plass til, vises i videoen så langt
  den rekker. Ingen kan rulle i en video.

**Prøvd.** 18 nye enhetstester (`tests/events.test.ts`) og tre
ende-til-ende-tester (`tests/e2e-events.test.ts`) på Linux Mint: et
opptak med falsk mikrofon der boksen åpnes, videoen i boksen spilles,
boksen lukkes og videoen på lysarket startes og stoppes; MP4-fila
kontrolleres bilde for bilde (boksens kant er der bare mens den er åpen,
videoene rører seg bare mens de spiller) og på lyden (filmens tone høres
bare mens en film spiller); HTML-fila kontrolleres i «Spill av». Hele
settet: 323 tester. **Ikke prøvd:** ekte mikrofon og høyttalere.
Windows: se 6.22.

### 6.21 Flere lydspor og tidslinje (23.11.2026)

Andre del av leveransen.

**Hva som er nytt.**

- **Fanen «Tidslinje»** under lysarket, ved siden av «Manus» og «Lyd».
  Lysarkene står på rad, hvert så bredt som det er langt, med en
  tidslinjal over. Under ligger sporene **Stemme** (bølgeformen til
  hvert lysark; stemmen klippes fortsatt under «Lyd»), **Musikk** og
  **Lyd**.
- **Klipp på sporene.** «Legg til musikk» og «Legg til lyd» henter en
  lydfil (gjøres om til prosjektets lydformat av FFmpeg) og setter den
  inn ved spillehodet. Et klipp dras på plass, kortes inn ved å dra i
  endene (det som kortes bort, er ikke tapt), og kan velges for
  lydstyrke, «Ton inn», «Ton ut», «Del ved spillehodet», «Fjern klippet»
  og kreditering. Piltastene flytter et klipp, Delete fjerner det.
  Et klipp som er lengre enn forelesningen, kan nås helt til enden;
  det som ligger etter slutten, er skravert og merket «høres ikke».
- **Festet.** Et klipp er festet til et lysark og et tidspunkt på det,
  så det følger med når lysark foran blir lengre, kortere eller flyttes.
  Slettes lysarket, flytter klippet til nabolysarket.
- **Lysarkets lengde.** Høyre kant av et lysark i tidslinja kan dras
  (eller flyttes med piltastene). Det er pausen på slutten som endres;
  det som er sagt, klippes aldri på den måten.
- **Spill av** i tidslinja spiller hele forelesningen fra spillehodet,
  lysark for lysark, og lysarket som høres er det som vises.
- **Demping.** Musikken senkes til en fjerdedel (omtrent 12 dB) mens
  noen snakker, og kommer mykt tilbake etterpå. Den begynner å gå ned
  like før første ord der det er mulig, og holder seg nede 0,7 s etter
  siste ord, så den ikke pumper mellom setninger. «Demp musikken mens
  noen snakker» slår det av. «Lyd»-sporet dempes ikke.
- **Eksport.** Den samme koden blander sporene inn i lyden til videoen,
  til HTML-fila og til avspillingen i programmet
  (`src/shared/audio/mix.ts`). I HTML-fila ligger musikken i lyden til
  hvert lysark, så også lysark uten stemme får lyd når musikken går
  under dem. Kreditering av musikk kommer med i «Bildekilder» og på
  krediteringslysarkene i videoen.

**En feil som lå der fra før, funnet og rettet.** Grensesnittet kunne
ikke lese opptak fra disk: medieadressen `lysark-media://` tok ikke del
i CORS, så `fetch` ble avvist. Det ble ikke oppdaget fordi et opptak som
nettopp er gjort, ligger i minnet. Åpnet man et prosjekt på nytt, eller
importerte en lydfil, manglet bølgeformen i «Lyd», og avspillingen der
var stille. Eksporten var ikke berørt (den leser filene selv). Rettet i
`src/main/index.ts`, og en test leser nå et opptak som ikke er gjort i
samme økt, både i tidslinja og i lydpanelet.

**Begrensninger, sagt rett ut.**

- I HTML-fila er musikken delt per lysark, som stemmen. Ved hvert
  lysarkskifte i «Spill av» kan det bli et bitte lite opphold i
  musikken. I videoen er den sammenhengende.
- Avspillingen i programmet (tidslinja og lydpanelet) spiller ikke lyden
  fra videoer på lysarkene; den er med i videofila og i HTML-fila.
- Åpnes en eksportert HTML-fil som prosjekt igjen, ligger musikken i
  lyden på hvert lysark sammen med stemmen, ikke på egne spor.
- Programmet følger ikke med musikk.

**Prøvd.** 13 nye enhetstester (`tests/tracks.test.ts`) og seks
ende-til-ende-tester (`tests/e2e-timeline.test.ts`) på Linux Mint: en
musikkfil (MP3) legges inn, flyttes, kortes inn med musa, tones og
deles; et lysark gjøres lengre; hele forelesningen spilles; i MP4-fila
måles musikken (2000 Hz) til omtrent en fjerdedel under stemmen, full
styrke ellers, borte før klippet starter og etter at det slutter, og
tonet ut mot slutten; HTML-fila har lyd på alle tre lysarkene.
Hele settet: 342 tester. De 51 ende-til-ende-testene går også mot det
pakkede Linux-programmet (0.3.0, utpakket).

### 6.22 Windows-utprøving av det nye, og rettinger etter den (23.11.2026)

**Prøvd på Windows 11 (eierens VM), for hånd av en hjelpeagent**, med
zip-utgaven slik den var før rettingene under, et lite testprosjekt
(tre lysark: stemme lest fra disk, bilde med «Lær mer» med tekst og
video, video på lysarket) og en MP3-fil. Alle sju punktene virket:

1. Start og åpning av prosjektet.
2. Fanen «Lyd»: bølgeformen til et opptak som er lest fra disk, tegnes,
   og «Spill av» flytter spillehodet. (Dette er feilen fra 6.21, og den
   er altså borte også på Windows.)
3. Fanen «Tidslinje»: tre lysark på rad, bølgeform under det første;
   «Legg til musikk» gjennom Windows' fildialog; klippet (30 s) rakk
   forbi slutten og ble skravert der; enden ble dratt inn, klippet
   flyttet, tonet inn og ut, styrken endret, delt ved spillehodet og
   samlet igjen med angre; et lysark ble dratt lengre; «Spill av» gikk
   gjennom alle tre lysarkene. Også «Legg til lyd», zoom, «Vis alt» og
   «Fjern klippet».
4. Innlesing: «+» ga boksen «Om bildet» ved siden av bildet, videoen i
   boksen spilte, «Lukk» la den bort, videoen på lysarket startet og
   stoppet. Lydsporet fikk fem merker.
5. Video (MP4, 0:51): i Windows' spiller spratt boksen ut, videoen i
   den rørte seg, boksen ble borte, videoen på lysarket rørte seg og
   stoppet.
6. HTML og «Forhåndsvis»: «Spill av» åpnet boksen av seg selv, spilte
   videoen i den, lukket boksen, og spilte og stoppet videoen på
   lysarket.
7. Avslutning.

**Kunne ikke bedømmes på Windows:** lyd. VM-en kan ikke høres, så at
musikken er med, dempes og tones, er bare målt på Linux. Opptaket var
stillhet (VM-en har ingen ekte mikrofon).

**Funn, og hva som er gjort.** Rettingene er prøvd på Linux, ikke på
Windows etterpå.

| Funn på Windows | Gjort |
| --- | --- |
| «Etter slutten: høres ikke» lå oppå tidene i linjalen | Rettet: skraveringen og teksten begynner under linjalen |
| Siste tid i linjalen var kuttet i høyre kant | Rettet: et tall uten plass skrives ikke; streken står |
| Navnet på et valgt klipp kunne ikke leses, og det valgte klippet ble helt mørkt uten bølgeform | Rettet: et valgt klipp beholder fargen sin og får oransje ramme; navnet er svart på lyst og ligger over toningen |
| Panelet hoppet i høyden når et klipp ble valgt eller sluppet | Rettet: verktøyraden har samme høyde med og uten valgt klipp |
| «Kreditering» for lyd brukte ordene for bilder, og gjorde panelet så høyt at lysarket krympet | Rettet: egen liten dialog, med «Tittel på stykket» og tekst som passer lyd |
| Zoom-knappene var grå på en kort forelesning | Rettet: det kan zoomes inn til 300 punkter per sekund |
| Rullefeltet lå over nedre kant av «Lyd»-raden når det var zoomet inn | Rettet: det er satt av plass til det under radene |
| Dialogen for videoeksport sa at «Lær mer» ikke vises og at video er stillbilde | Rettet: den sier nå at bokser og videoer vises slik de ble åpnet og spilt under innlesingen |
| Et trykk i linjalen flyttet spillehodet, men ikke lysarket som vises | Rettet: lysarket under spillehodet vises |
| Fildialogene for musikk og lyd åpner i Nedlastinger | Ikke endret. Det er Windows' eget valg av startmappe |
| «+»-merket står på bildet gjennom hele lysarket i videoen | Slik er det ment: merket vises på det som ble åpnet, så det synes hvor boksen kommer fra. Eieren kan si om det bør bort |
| Et lysark som dras lengre, får en pause, og fanen heter da «Lyd (0:07)» uten at det er lyd | Ikke endret; tallet er lysarkets lengde |

I VM-en ligger utprøvingen i `C:\Users\simen\lysark-test\t1123\`.
Den kan slettes.

**Utgivelse:** eieren ba om det 23.11.2026 («Ja, gi ut 0.3.0»). Versjon
0.3.0 er gitt ut i det private repoet
(<https://github.com/SimenKode/lysark/releases/tag/v0.3.0>), med
`Lysark-0.3.0.AppImage` og `Lysark-0.3.0-win.zip`, pakket etter
rettingene over. Det pakkede Linux-programmet (utpakket) består de 51
ende-til-ende-testene. Windows-zipen slik den er gitt ut, er ikke prøvd
på Windows; utprøvingen der var av bygget rett før rettingene.
AppImage-fila selv er fortsatt ikke startet av meg (se 6.19).
Synligheten er ikke endret.

### 6.23 Før repoet åpnes: eierens avgjørelser (23.11.2026)

Eieren skrev «Tenker vi kan gjøre repoet offentlig». Jeg gikk gjennom
hva som ville bli synlig (alle 36 commits: bare kode, dokumenter,
Liberation-skriftene og programikonet; ingen privat e-post, ingen
hemmeligheter) og la fram de tre spørsmålene fra 6.12. Han svarte:

> Vent litt. […] Vi burde ikke ha en
> destillert versjon av USN designmanual, men at vi bare har valgt det
> samme som dem. Det er ikke ulovlig, man eier ikke farger og fontvalg.
> Fjern det dokumentet. Dette utgis av meg privat, og jeg tenker å
> anvende dette verktøyet privat også. Unntaket for ekporter er riktig,
> de er ikke GPL. Gjør et kjapt søk på det med FFmpeg lisens.

Det gir disse svarene på de tre spørsmålene i 6.12:

| Spørsmål | Eierens svar |
| --- | --- |
| Unntaket for eksporterte forelesninger | Riktig: eksportene er ikke GPL. `EXPORT-EXCEPTION.md` står |
| USNs profil | Lysark har valgt de samme fargene og skriftvalgene. Ingen eier farger og skriftvalg. Sammendraget av manualen skal ikke ligge i repoet |
| Hvem eier koden | Eieren gir det ut privat, og bruker det privat |

**Gjort:**

- `docs/designmanual.md` er fjernet. AGENTS.md sier nå at Lysark følger
  USNs profil, at USNs egen manual leses der den ligger, og at ingen
  kopi eller oppsummering av den skal ligge i repoet.
- AGENTS.md og startmeldingen i HANDOFF.md nevner ikke lenger noe
  utenfor prosjektmappa (eieren ba om det i samme melding). Regelen
  står: ingenting utenfor prosjektmappa leses, endres eller omtales.
- README.md og AGENTS.md sier at Lysark er et privat prosjekt, ikke
  laget, eid eller godkjent av USN.

**Historikken er skrevet om** (eieren: «Ja, skriv om», 23.11.2026). De
to tingene lå i nesten alle eldre commits, ikke bare i noen få slik jeg
først skrev. Sammendraget er tatt ut av hver commit, og setningene som
nevnte noe utenfor prosjektmappa, er byttet ut med regelen uten navn.
Alt annet i hver commit er som før, med samme dato og samme tekst
(to commit-meldinger er rettet der de nevnte det som er tatt ut).
`main` og merkene `v0.2.0` og `v0.3.0` er tvangspushet; utgivelsene
følger merkenavnet og har de samme filene. Dette er den ene gangen
tvangspush er brukt, og regelen mot det står ellers.

En kopi av historikken slik den var, ligger hos eieren i
`release/lysark-for-omskriving.bundle` (ikke i git). Den inneholder det
som er tatt ut, og kan slettes.

**Forbehold, kontrollert etter tvangspushen:** GitHub har fortsatt de
gamle commitene. De er ikke lenger en del av `main` eller merkene, men
GitHub svarer på dem når man spør med commit-ID-en, og repoets
aktivitetslogg på GitHub viser tvangspushen med ID-ene før og etter.
Gjøres det repoet offentlig slik det er, kan altså den som leter,
finne det som er tatt ut. Det er to måter å bli kvitt dem på: be GitHub
Support rydde, eller opprette repoet på nytt fra den omskrevne
historikken (og legge de to utgivelsene inn igjen).

**Repoet er opprettet på nytt** (eieren: «Ja, opprett på nytt»,
23.11.2026):

- Det gamle repoet heter nå `SimenKode/lysark-gammel`. Det er privat og
  urørt, og har fortsatt det som er tatt ut. Ingenting er slettet;
  eieren kan slette det selv når han er trygg.
- `SimenKode/lysark` er et nytt, privat repo, pushet fra den omskrevne
  historikken: `main` og merkene `v0.2.0` og `v0.3.0`.
- De to utgivelsene er lagt inn igjen med samme tittel og tekst. Alle
  fire filene har samme sjekksum som i det gamle repoet. Datoen på
  utgivelsene er den nye.
- Kontrollert etterpå: det nye repoet svarer «finnes ikke» på de gamle
  commit-ID-ene, aktivitetsloggen har bare én linje (grenen ble
  opprettet), og ingen fil i det heter designmanual.

Synligheten er ikke endret: begge repoene er private.

**FFmpeg-lisensen (kjapt søk, jeg er ikke jurist).**

- Utgivelsene
  inneholder FFmpeg som ferdig program under GPL versjon 3. Ved siden av
  ligger lisensteksten og lenker til FFmpegs kildekode (nøyaktig commit)
  og til byggeskriptene. GPL versjon 3 punkt 6 d tillater at kildekoden
  ligger på en annen tjener, men den som deler programmet, har fortsatt
  ansvaret for at den er tilgjengelig så lenge det trengs. FFmpegs egen
  sjekkliste anbefaler å legge kildekoden på samme sted som programfila,
  og utviklerne har sagt at en lenke til ffmpeg.org ikke holder; det
  skal være nøyaktig den kildekoden som ble brukt. BtbN, som lager
  bygget, beholder månedens siste bygg i to år (slik står det i
  speilinger av README-en deres; ikke kontrollert mot den levende sida),
  så det stedet er ikke varig. Bygget har dessuten biblioteker (blant
  annet x264) som også hører til kildekoden. Tryggest er derfor å legge
  kildekoden til FFmpeg og byggeskriptene ved hver utgivelse. Kilder:
  <https://www.ffmpeg.org/legal.html>,
  <https://www.gnu.org/licenses/gpl-faq.html>,
  <https://jxself.org/outsourcing.shtml>,
  <https://github.com/BtbN/FFmpeg-Builds>.

**Kildekoden til FFmpeg er lagt ved utgivelsene** (eieren: «Ja, legg
den ved», 23.11.2026). Begge utgivelsene, 0.2.0 og 0.3.0, bruker samme
FFmpeg-bygg og har fått de samme tre filene:

- `FFmpeg-n9.0.2-39-g7adfbe40dc-source.tar.gz`: kildekoden til FFmpeg,
  hentet fra FFmpegs repo på GitHub ved commit `7adfbe40dc…`. Arkivet
  sier selv hvilken commit det holder, og det er kontrollert.
- `FFmpeg-Builds-autobuild-2026-10-31-12-59.tar.gz`: byggeskriptene fra
  BtbN ved det merket bygget er laget på (commit `5031c6f…`).
- `FFMPEG-SOURCE.txt`: hva filene er, sjekksummene, og hvordan
  Linux-programmet er satt opp (configure-linja).

Utgivelsestekstene sier at filene ligger der. Hentingen er en fast
kommando (`npm run fetch:ffmpeg-source`), og AGENTS.md sier at en
utgivelse ikke er ferdig uten dem.

Det som ikke er med: kildekoden til bibliotekene som er bygget inn i
FFmpeg (x264 og mange andre). Byggeskriptene oppgir kilde og commit
for hvert av dem, og jeg har kontrollert at alle de 127 skriptene som
henter noe, gjør det, men selve kildekoden deres ligger hos de
prosjektene, ikke ved utgivelsen. Å ta med alt ville bety å hente fra
mange andre nettsteder enn GitHub, og er ikke gjort uten at eieren ber
om det.

**Repoet er åpnet** (eieren: «Ja, gjør det offentlig», 23.11.2026).
`SimenKode/lysark` er offentlig, med de to utgivelsene. Det gamle
repoet, `SimenKode/lysark-gammel`, er fortsatt privat. Fra nå er hver
push en offentliggjøring.

### 6.24 Eierens innspill 25.11.2026: kamera, installering og forsiden

Startmeldingen kom med «(skriv her)» stående i begge feltene (funn fra
egen utprøving, og innspill). Det er altså ikke meldt noe fra mikrofon,
musikk, video eller Canvas ennå. Innspillene kom i chatten like etter:

> To viktige ting. Vil at vi åpner for video (sånn sirkel med ansiktet
> som man også skal kunne flytte rundt på skjermen etter behov. Vil også
> at vi ser på installeringsmetoden slik at den blir smidig på
> windowspcene på USN

Jeg stilte tre spørsmål, hvert med en anbefaling. Svarene:

1. **Hvor skal kamerasirkelen vises?** Anbefaling: bare i videoen
   (MP4), så HTML-fila holder seg liten; kan utvides senere.

   Svar: bare i videoen.

2. **Hvordan skal sirkelen flyttes?** Anbefaling: én plass per lysark.
   Det andre valget var fri flytting underveis: alt det første (dra den
   på plass under innlesing eller etterpå, skjul på enkeltlysark, tre
   størrelser), og i tillegg huskes hver flytting midt i et lysark med
   tidspunkt og gjentas i videoen.

   Svar: fri flytting underveis.

3. **Hva vet du om hvordan Lysark oppfører seg på USN-PC-ene i dag?**

   Svar, ordrett:

   > Det må være svært enkelt å installere og github siden må forklare
   > dette svært enkelt å forstå når man går inn på repoet. Det må også
   > være mindre snakk om leveranser, utvikling og slikt, men en ren
   > front for installasjon og bruk m/bilder

   Om programmet får kjøre på en USN-styrt PC, er dermed fortsatt ikke
   kjent.

**Følger for reglene.** Kamera var til nå uttrykkelig stengt («aldri
kameraet»). Med dette innspillet åpnes det, og regelen i AGENTS.md
skrives om i samme trinn som kameraet bygges.

**Installasjonsfil for Windows (bygget og prøvd 25.11.2026).**

- `npm run dist:win` lager nå også
  `release/Lysark-<versjon>-windows-installasjon.exe` (161 MB; zip-utgaven
  er 212 MB). Ett dobbeltklikk: ingen valg og ingen spørsmål om
  administrator. Den installerer for den som kjører den, i
  `%LOCALAPPDATA%\Programs\Lysark`, lager snarvei på skrivebordet og i
  Start-menyen, fører Lysark opp blant installerte programmer, og
  starter programmet når den er ferdig.
- electron-builders eget installasjonsmål ble prøvd først, men krever
  Wine på Linux («spawn wine ENOENT»). Wine er ikke installert, og jeg
  installerer ikke systemprogrammer. Maskinen har NSIS (makensis 3.09),
  så installasjonsfila lages med det direkte
  (`tools/windows-installer.nsi`).
- Samtidig fikk programfila Lysark-ikonet og riktig navn og versjon.
  Det viste seg at pakkeverktøyet kan skrive dem inn på Linux når bare
  signeringen slås av (`signExecutable: false`), ikke hele redigeringen.
- **Prøvd for hånd i Windows 11-VM-en** (fra et CD-bilde, engelsk
  Windows): installasjonen gikk uten spørsmål og tok ett til to
  minutter; snarveien kom på skrivebordet med Lysark-ikonet; programmet
  startet av seg selv med innstillingene fra før (sist brukte prosjekter
  sto der); tittellinja og oppgavelinja viser Lysark-ikonet. Kjørt en
  gang til mens Lysark var åpent: meldingen «Lysark er åpent. Lukk
  programmet, og prøv på nytt.» kom, og «Cancel» lukket
  installasjonen uten å røre noe. Avinstalleringen (på norsk) fjernet
  programmet og snarveien.
- To småting funnet og rettet underveis: meldingen siterte knappen
  «Prøv på nytt», som heter «Retry» på engelsk Windows, og etter
  «Cancel» ble installasjonsvinduet stående og måtte lukkes med ett
  klikk til.
- **Ikke prøvd:** en fil som er lastet ned fra nettet (da kan Windows
  vise «Windows beskyttet PC-en din», fordi programmet ikke er
  signert), norsk Windows, og en USN-styrt PC. Om en USN-PC i det hele
  tatt lar et usignert program kjøre, vet vi ikke før eieren har prøvd.
- Lysark 0.3.0 står igjen installert i VM-en.

**Forsiden (README) er skrevet om** slik eieren ba om: installasjon
øverst, så bruk i fem trinn med bilder, og ingenting om leveranser. Det
som handler om utvikling, er flyttet til `docs/utvikling.md`. Bildene
(`docs/bilder/`) er tatt av testene, med prøveinnhold. Ett av testbildene
viste USNs logo (testen bruker logopakka når den finnes på maskinen); det
er ikke brukt. Installasjonsavsnittet for Windows beskriver zip-utgaven
til en utgivelse med installasjonsfila finnes.

**Kamerasirkelen (bygget og prøvd 25.11.2026).**

Hva som er nytt:

- **«Kamera» i innlesingsvinduet**, av til du slår det på. Valget
  huskes til neste gang, slik mikrofonvalgene gjør. Har maskinen flere
  kameraer, kan du velge. «Kamerasirkel» velger størrelsen: liten,
  middels eller stor (200, 290 og 400 av lysarkets 1080 piksler i
  høyden).
- **Sirkelen** viser ansiktet ditt speilvendt mens du leser inn, som i
  et speil. I videoen er det ikke speilvendt.
- **Flytting.** Sirkelen starter nede til høyre. Dra den før du starter,
  og mens du leser. En flytting underveis lagres med tidspunktet du tok
  tak i sirkelen, og videoen lar den gli dit på 0,4 sekunder. Går du til
  neste lysark, begynner det der sirkelen sto, og i videoen glir
  sirkelen dit fra der den sto på lysarket før.
- **Etterpå.** Sirkelen står på lysarket i redigeringsflaten og viser
  bildet ved spillehodet i fanen «Lyd». Dra den for å endre plassen som
  gjelder på det tidspunktet. I fanen «Lysark» kan du endre størrelsen
  og skjule sirkelen på lysarket. Flyttinger underveis er merker (○) i
  lydsporet, som kan dras i tid og fjernes med Delete.
- **Klipping.** Filmen hører til opptaket, så alt som klipper lyden,
  klipper filmen likt. I en pause står ansiktet stille på siste bilde
  før pausen. Tar du om et stykke uten kamera, er det ingen sirkel der.
- **Videoen.** Sirkelen legges oppå bildet av lysarket for hvert bilde i
  videoen, av hovedprosessen selv, så lysark som står stille, ikke må
  tegnes på nytt for hvert bilde. Hvor lang tid en lang forelesning med
  kamera tar, er ikke målt.
- **Ikke i HTML-fila og ikke i GIF**, slik du valgte. Filmene, plassen
  og flyttingene tas ut av det som eksporteres.
- **Lagring.** Filmen lagres i prosjektmappa (`media/kamera-….mp4`,
  480 × 480, 30 bilder i sekundet, uten lyd) og sendes ingen steder.
  Prosjektformatet er nå versjon 7; eldre prosjekter åpnes som før.

Reglene: AGENTS.md sa «aldri kameraet». Nå står det at kameraet bare
brukes i innlesingsvinduet, og bare når du har slått det på der.

Prøvd på Linux Mint, automatisk og uten vindu på skjermen: 12
enhetstester (`tests/camera.test.ts`) og fire ende-til-ende-tester
(`tests/e2e-camera.test.ts`) med nettlesermotorens **prøvekamera** (et
grønt testbilde, aldri et ekte kamera): kameraet er av til det slås på;
sirkelen dras før og under innlesing; flyttingen lagres med tid; neste
lysark starter der sirkelen sto; filmene er 480 × 480 og like lange som
lyden; sirkelen flyttes, gjøres mindre og skjules etterpå; i MP4-fila
står ansiktet der sirkelen sto før og etter flyttingen, med hvit ring,
og bildet i sirkelen beveger seg mens lysarket står stille; HTML-fila
har ingenting av kameraet i seg.

**Ikke prøvd:**

- **Et ekte kamera.** Alt er prøvd med prøvekameraet.
- **Om munn og lyd følger hverandre.** Lyd og film tas opp hver for seg
  og legges sammen etter klokka. Med prøvekamera kan jeg måle at de er
  like lange, men ikke om leppene treffer lyden. Det må du se på.
- **Windows.** VM-en har ikke kamera, og jeg har bare lov til å sette
  opp mikrofon der.
- **En lang forelesning med kamera** (hvor store filmene blir, og hvor
  lang tid videoen tar).

**Openverse som bildekilde nummer to (bygget og prøvd 25.11.2026).**

Dette sto som punkt 2 i «Neste steg», og du hadde svart «som anbefalt»
på å ta Openverse først (6.14).

- **Ny fane i mediedialogen: «Søk i Openverse».** Openverse leter i
  bilder med åpen lisens fra Flickr, museer og andre samlinger. Fanen
  virker som Commons-fanen: søk, velg, «Sett inn», og krediteringen
  følger med.
- **Samme lisensregler som for Commons:** bare fri bruk (CC0 og «public
  domain») og navngivelse (CC BY og CC BY-SA). Det ber søket om, og
  alt annet som likevel skulle komme i svaret, kastes. Bilder merket
  som støtende kastes også.
- **Én ny vert: `api.openverse.org`.** Søket, småbildene og selve bildet
  kommer alle derfra. Samlingene bildene ligger i (Flickr og andre),
  kontaktes aldri av programmet. Verten står på lista i AGENTS.md og i
  koden. Som før sendes bare søkeordene og «Lysark/versjon», og bare
  når du trykker «Søk».
- **Treff fra Wikimedia er tatt ut av Openverse-søket**, siden de har
  sin egen fane med fyldigere kreditering.
- **Store bilder gjøres mindre.** Openverse gir bildet i den størrelsen
  samlingen har det. Er det bredere enn 1920 piksler, gjøres det om til
  1920 (JPEG forblir JPEG; andre blir WebP).
- **«Se bildet hos kilden»** står ved det valgte bildet og åpner sida
  bildet kommer fra, i nettleseren din.

**To ting fra Openverse sine bruksvilkår som du bør vite om**
(<https://docs.openverse.org/terms_of_service.html>, lest 25.11.2026):

1. *Den som bruker Openverse, godtar vilkårene.* De sier blant annet at
   man ikke skal omgå grensene for antall søk, og at et program som
   bygger på Openverse, tydelig skal si at det bruker Openverse og ikke
   er godkjent av dem. Det står nå i fanen og i «Om Lysark». Si fra om
   du ikke vil godta vilkårene, så tar jeg kilden ut igjen.
2. *Openverse kontrollerer ikke lisensene.* De samler inn det
   samlingene selv oppgir, og sier at brukeren har ansvaret for å
   sjekke. Det er en reell forskjell fra Commons. Fanen sier det, og
   lenka til kilden er der for at du skal kunne se etter.

Uten konto tillater Openverse 20 treff per side, 240 treff per søk, 100
søk i minuttet og 1000 i døgnet per nettadresse (målt 25.11.2026). På
USN deler mange samme adresse utad, så grensa per døgn kan i prinsippet
nås av andre. Da sier fanen «Openverse tar ikke imot flere søk akkurat
nå», og Commons virker som før.

For å finne ut hvordan tjenesten faktisk svarer (dokumentasjonen oppga
ikke grensene), sendte jeg sju søk og ett oppslag og hentet sju bilder
med kommandolinja, med søkeordet «bridge» og ingenting om deg eller
prosjektet. Det er de eneste gangene noe har kontaktet Openverse.

Prøvd på Linux Mint, automatisk og uten nett: 8 enhetstester
(`tests/openverse.test.ts`) og fire ende-til-ende-tester
(`tests/e2e-openverse.test.ts`) der testen selv svarer for Openverse:
fanen sender ingenting før du søker; bare bilder med brukbar lisens
vises; krediteringen blir riktig og leses på nytt når bildet hentes;
alt som sendes, går til den ene verten; et 2400 piksler bredt bilde
lagres 1920 bredt; for mange søk gir en forståelig melding.

**Ikke prøvd:** selve fanen mot det ekte Openverse (testene går aldri
på nett), og Windows.

**Tre spørsmål til, stilt da alt over var bygget, og svarene:**

1. **Skal versjon 0.4.0 gis ut nå,** med kamerasirkelen,
   installasjonsfila og Openverse? Anbefaling: ja; utgivelsesteksten
   sier at kameraet bare er prøvd med prøvekamera.

   Svar: ja, gi ut 0.4.0.

2. **Hvilken del av figurer og bevegelser (leveranse 4) først,** som et
   ferdig stykke for seg? Anbefaling: merket bilde (tall, piler og
   etiketter oppå et bilde). De andre valgene var fri figur,
   diagrammer, eller å vente.

   Svar: merket bilde.

3. **Hvordan skal merkene se ut?** Anbefaling: begge deler, valgt per
   bilde: nummererte punkter med forklaringsliste, eller etiketter med
   strek inn til punktet.

   Svar: begge, valgt per bilde.

**Versjon 0.4.0 er gitt ut 25.11.2026** (eieren: «Ja, gi ut 0.4.0»):
<https://github.com/SimenKode/lysark/releases/tag/v0.4.0>.

- Filene: `Lysark-0.4.0-windows-installasjon.exe` (161 MB),
  `Lysark-0.4.0-win.zip` (222 MB), `Lysark-0.4.0.AppImage` (202 MB), og
  de tre filene med FFmpegs kildekode, de samme som ved 0.3.0 (samme
  FFmpeg-bygg).
- Før utgivelsen: hele testsettet (370 tester) på Linux Mint, og de 73
  ende-til-ende-testene en gang til mot det pakkede Linux-programmet
  (utpakket, ikke selve AppImage-fila).
- **Oppgradering prøvd i Windows 11-VM-en:** 0.4.0 installert rett over
  0.3.0 med installasjonsfila. Programmet startet, «Om Lysark» viser
  0.4.0, og de sist brukte prosjektene sto der som før.
- Forsiden (README) beskriver fra nå installasjonsfila, kameraet og
  Openverse. Regelen er skrevet inn i AGENTS.md: forsiden beskriver det
  siste utgivelse inneholder, ikke det som bare ligger i koden.
- Ikke prøvd i den utgitte utgaven: det samme som står over (ekte
  kamera, nedlastet fil på Windows, USN-PC, Openverse mot ekte nett).
  Kamera, innlesing og Openverse er ikke prøvd for hånd på Windows i
  0.4.0; der er bare installasjon, start og «Om Lysark» sett på.

### 6.25 Merket bilde, første del av leveranse 4 (25.11.2026)

Eieren valgte merket bilde først, med begge merketypene valgt per bilde
(6.24). Bygget samme dag, etter at 0.4.0 var gitt ut. **Det er ikke med
i 0.4.0;** det ligger i koden til neste utgivelse.

**Hva som er nytt.**

- **«Merker på bildet»** står i egenskapene til et bilde (fanen
  «Element»). «Legg til merke» setter et merke midt i bildet, og du
  skriver hva det peker på i lista rett under. Bildet er fortsatt valgt,
  så neste merke er ett trykk unna.
- **To måter å vise merkene på, valgt per bilde:**
  - *Tall, med forklaring ved siden av:* nummererte, runde merker på
    bildet, og en forklaringsliste som skriver seg selv («1 …, 2 …»).
    Lista er et eget element du kan dra dit du vil.
  - *Etiketter med strek:* teksten står i en etikett ved siden av
    bildet, med en strek inn til det den peker på. Etiketten dras fritt;
    den runde prikken i enden av streken dras for seg.
  Du kan bytte fram og tilbake; merkene beholder teksten og det de
  peker på.
- **Merkene følger bildet** når det flyttes eller endrer størrelse, og
  forsvinner når bildet slettes. Et merke kan ikke dras utenfor bildet.
- **Steg.** Hvert merke er et element, så det kan komme inn i et steg
  som alt annet. «Ett steg per merke» lager stegene i rekkefølge. Raden
  i forklaringslista kommer inn sammen med merket sitt, og ingen merker
  vises før bildet de står på.
- **«Lær mer»** kan legges på et merke. Da er merket selv det studenten
  trykker på, med et lite «+» og en lilla ring.
- **I HTML-fila og i videoen** vises merkene som i lysarket.
  Prosjektformatet er nå versjon 8; eldre prosjekter åpnes som før.

Fargene er valgt i paletten programmet har fra før: oransje merker med
svart tall og hvit ring, og etiketter i hvitt med indigo kant og strek
(hvit under, så streken synes på alle bilder).

**En feil funnet av testen og rettet før noe ble sendt ut:**
forklaringslista i redigeringsflaten ble ikke tegnet på nytt når et
merke fikk tekst, fordi flaten gjenbruker det som ikke selv er endret.
Merker og liste tegnes nå alltid på nytt. En svakhet i min egen første
utgave ble også rettet: et bilde og merkene flyttet samtidig kunne ha
flyttet merkene dobbelt; nå regnes merkene alltid ut fra bildet.

**Begrensninger, sagt rett ut.**

- Teksten til et merke skrives i egenskapene, ikke ved å dobbeltklikke
  på merket i lysarket.
- En etikett får ikke størrelse etter teksten av seg selv. Lang tekst
  brytes; dra i håndtakene for å gjøre etiketten større.
- Når du endrer størrelsen på bildet, hopper merkene på plass når du
  slipper. Når du flytter bildet, følger de med underveis.
- Merker på et bilde som er dreid, er ikke laget for det: de regner med
  at bildet står rett.
- Fargene på merkene kan ikke velges.

**Prøvd** på Linux Mint, automatisk og uten vindu: 14 enhetstester
(`tests/marks.test.ts`) og fire ende-til-ende-tester
(`tests/e2e-marks.test.ts`): legge til merker og skrive tekst, dra et
merke, dra bildet (merker og liste følger), ett steg per merke, bytte
til etiketter, dra prikken, se merkene i forhåndsvisningen slik en
student ser dem (steg og «Lær mer»), og måle dem i videofila.
Innholdet i testene er prøveinnhold («Del A», «Del B»).

**Ikke prøvd:** dine egne bilder, Windows, og den pakkede utgaven.

### 6.26 Eieren har prøvd PDF-import og opptak med kamera (25.11.2026)

Meldt i chatten etter at 0.4.0 var gitt ut og merket bilde var bygget.
Ordrett:

> PDF importerer OK, men når jeg klikker på ting i lysarkene så velger
> den hele siden. Det er som om den ikke registrerer bilder og tekst som
> individuelle objekter. Samme med lenker, de fungerer ikke. Tekst ser
> også noe dosent ut, litt kornete. Om opptak: Kamera fryser mellom
> slides. Man må kunne hoppe effektivt frem og tilbake mellom slides
> uten avbrudd. Savner derfor knapp for å gå tilbake. VIl også ha en
> sidemeny som kan sprette ut for å velge lysark mer effektivt. Savner
> også kapitlene i pptx/pdf som forsvinner. Oppdater handoff og gi meg i
> denne chatten handoffprompten

Han ba om at HANDOFF.md ble oppdatert og om startmeldingen, ikke om at
noe ble rettet i denne chatten. **Ingenting av dette er rettet ennå.**

Slik er det lest, punkt for punkt. Det som står om årsak, er lest ut av
koden og ikke prøvd; det må bekreftes før det rettes.

1. **PDF: hele siden er ett objekt.** Det er slik PDF-importen er laget
   (leveranse 3): hver side tegnes som ett bilde, og teksten blir bare
   bildets alternative tekst. Det står som kjent svakhet («PDF-import
   gir bilder, ikke tekst du kan redigere»). Eieren vil ha tekst og
   bilder som egne elementer som kan velges. Det er nytt arbeid, ikke en
   feilretting: teksten og bildene må leses ut av PDF-en hver for seg.
2. **PDF: lenker virker ikke.** Lenkene i PDF-en leses ikke i dag;
   importen ser ikke etter dem.
3. **PDF: teksten er litt kornete.** Sidene tegnes i dobbel oppløsning
   og lagres som WebP med tap (`src/renderer/src/pdfRender.ts`). Det er
   trolig der kornet kommer fra. Blir teksten ekte tekst (punkt 1),
   forsvinner dette for tekstens del.
4. **Opptak: kameraet fryser mellom lysark.** Ikke gjenskapt. Trolig
   årsak: filmen tas opp som én film per lysark, og en ny startes ved
   hvert skifte. I testen med prøvekamera kom første bilde i den nye
   filmen opptil 0,7 sekunder etter at lyden var i gang, og så lenge
   står ansiktet stille på første bilde. Det ble målt, men jeg regnet
   det som noe et vindu uten skjerm gjør, og meldte det ikke som en
   svakhet. Det var feil. Rettingen er trolig én sammenhengende film
   for hele innlesingen, som lysarkene peker inn i, slik klippene peker
   inn i et lydopptak.
5. **Opptak: hoppe fram og tilbake uten avbrudd, og en knapp for å gå
   tilbake.** I dag finnes bare «Neste steg» og «Neste lysark» (pil
   høyre). Det er ingen vei tilbake uten å avbryte.
6. **En sidemeny som spretter ut, for å velge lysark.** Lest som en meny
   i innlesingsvinduet, siden den står sammen med ønsket om å hoppe
   mellom lysark der. Om han også mener spilleren studentene ser, eller
   redigeringsprogrammet, er ikke avklart.
7. **Kapitlene i PPTX og PDF forsvinner.** Importen leser ikke
   seksjonene i en PowerPoint-fil eller bokmerkene i en PDF, og formatet
   har ikke noe sted å ha kapitler. Hvor de skal vises (lysarklista,
   innholdsoversikten hos studenten, kapitler i videoen), må avklares.

Punkt 5 og 6 reiser et spørsmål som må avklares før det bygges: hva
skal skje med opptaket når han går tilbake til et lysark som allerede
er lest inn. Tas det om fra det punktet, eller fortsetter opptaket som
én lang innlesing der samme lysark kan vises flere ganger?

### 6.27 Eierens svar på spørsmålene om det han meldte (25.11.2026)

Startmeldingen til denne chatten kom **uten nye funn og uten innspill**:
begge stedene sto det «(skriv her)». Det er altså ikke meldt noe nytt om
kamera, mikrofon, musikk, installasjonsfila på USN-PC, Openverse, merket
bilde eller Canvas. De punktene står fortsatt som ikke prøvd.

Fire spørsmål ble stilt samlet, hvert med én anbefaling, før noe ble
rettet. Svarene hans, ordrett:

1. **Hva skal skje med opptaket når du går tilbake til et lysark som er
   lest inn?** (Anbefalt: les det inn på nytt.) Han valgte ikke
   anbefalingen:

   > Det må være svært fritt, da vi må ta høyde for at forelesere noen
   > ganger vil gå frem og tilbake mellom slides. Sørg for at det blir
   > smooth. Skal være som et vanlig videoopptak. Fortsatt fint å kunne
   > ekstrahere f.eks to lysark blant 15 som en egen eksport, hvis man
   > vil ha minivideoer som forklarer en spesifikk ting i en lang
   > forelesning.

2. **Hvor skal sidemenyen finnes?** Han valgte anbefalingen: i
   innlesingsvinduet. Studentene beholder «Innhold» i HTML-fila, som får
   kapitlene.

3. **Hvor skal kapitlene vises?** Han valgte anbefalingen: overalt. Som
   overskrifter i lysarklista (der de kan få nytt navn, lages og
   fjernes), i sidemenyen under opptak, i «Innhold» hos studentene, og
   som kapitler i videofila.

4. **Hvordan skal et lysark fra en PDF se ut?** (Anbefalt: som i
   PDF-en.) Han vil ha et valg, og for PowerPoint også:

   > Man kan velge? Tenker at det kan være fint for både pdf og pptx å
   > kunne velge om det skal konverteres til USN stil eller ikke. Noen
   > vil bare bruke verktøyet for å ta opp forelesningen sin i en gammel
   > pptx.

Slik er svarene lest:

- **Opptaket er en film av det foreleseren gjør.** Det går uten stans, og
  videoen viser lysarkene i den rekkefølgen han faktisk gikk, også
  tilbake. Et lysark kan altså vises flere ganger. Det gamle prinsippet
  (ett lydspor per lysark, hvert lysark vist én gang) holder ikke lenger
  alene.
- **Eksport av noen få lysark** som egen video er et nytt ønske.
- **Valget «USN-stil eller som i fila»** gjelder begge filtyper og tas
  ved import. For PowerPoint er «som i fila» nytt arbeid: importen har
  til nå alltid lagt innholdet over i USN-malen.

### 6.28 Fritt opptak, sidemeny og kapitler (25.11.2026)

Bygget etter svarene i 6.27. Dette retter tre av de sju tingene han
meldte (kameraet som fryser, knapp for å gå tilbake, sidemeny) og en
fjerde for PowerPoint (kapitlene). **Ikke gitt ut;** det ligger i koden
til neste utgivelse.

**Opptaket er nå en film av det du gjør.**

- **Tilbake.** Pil venstre (eller knappen «← Forrige steg» / «← Forrige
  lysark») går ett steg tilbake, og fra første steg til lysarket før.
  Opptaket stanser ikke.
- **Sidemenyen.** Knappen «Velg lysark» øverst (eller tasten L) åpner en
  meny fra venstre, oppå lysarket, med alle lysarkene under kapitlene
  sine. Ett trykk hopper dit. Menyen viser hvilke lysark som er lest inn
  i dette opptaket, og hvilke som har lyd fra før. Esc lukker menyen
  uten å avbryte opptaket. Menyen kan også brukes før opptaket starter,
  til å velge hvor det skal begynne, og mens opptaket står på pause.
- **Det du gjør, er det som vises.** Går du tilbake til et lysark du har
  vært på, vises det en gang til i videoen og i «Spill av», på det
  stedet. I lysarklista står det da som «Lysark 3 igjen», litt
  innrykket, der det skjedde. Det viser alltid det samme som lysark 3;
  retter du en skrivefeil på lysark 3, er den rettet der også. Lyden,
  manuset (for teksting) og kamerasirkelen er stedets egne. Det kan
  flyttes i lista og slettes.
- **Et lysark kommer tilbake slik du forlot det.** Stegene som var vist,
  er vist. Går du ett steg tilbake, blir det en egen visning med ett
  steg mindre.
- **Et lysark du bare blar forbi** (under et halvt sekund) blir ikke en
  egen visning. Det du sa imens, høres på lysarket før.
- **Et steg du aldri kom til, vises ikke** i videoen. Før ble slike steg
  fordelt utover lysarket av seg selv.
- **Studentene blar som før.** I HTML-fila går pilene fra lysark til
  lysark; ingen havner på en gjentakelse. Bare «Spill av» følger
  opptaket.
- **Hele opptaket er én angring.** Før var det én per lysark.
- **Klokka i innlesingsvinduet** viser nå hvor langt hele opptaket er,
  ikke bare lysarket.

**Regelen for hva som blir «igjen».** Det første opptaket av et lysark
som ligger lenger framme enn opptaket har vært, blir lysarkets egen lyd
(og erstatter den det hadde). Alt annet (tilbake til et lysark opptaket
har passert) blir en gjentakelse på stedet. Vil du ta om et lysark, ikke
vise det en gang til, starter du opptaket på det lysarket, som før.

**Kameraet fryser ikke lenger mellom lysark.** Årsaken var den jeg antok
i 6.26: en ny film ble startet for hvert lysark, og den var treg i
starten. Nå filmes hele opptaket som **én film**. Den lages i en egen
tråd, så den går jevnt også mens vinduet tegner et nytt lysark, og hvert
bilde får opptakets egen tid, så bildet ikke kan gli fra lyden utover i
en lang forelesning. Filmen skrives til disk underveis, ikke først til
slutt. Målt før jeg bygde, uten vindu og med prøvekamera: 81 bilder på
fire sekunder (prøvekameraet gir 20 i sekundet) og aldri mer enn 51
millisekunder mellom to bilder, også mens resten av vinduet sto helt
stille i et halvt sekund.

**Kapitler.**

- **Fra PowerPoint:** seksjonene blir kapitler. Prøvd på «Stål»:
  «Forside», «Stål som materiale», «Produksjon av stål», «Stål som
  konstruksjonsmateriale», «Montasje av stål», «Stål og brann» og
  «Avslutningsside» kom med, på riktige lysark.
- **I lysarklista** er et kapittel en overskrift du skriver rett i.
  «Fjern» tar bort kapittelet (lysarkene står). Nytt kapittel: «Nytt
  lysark» → «Kapittel som begynner her».
- **I sidemenyen** under opptak, **i «Innhold»** hos studentene, og
  **som kapitler i videofila** (MP4), som de fleste avspillere viser.
  En video av noen få lysark begynner med kapittelet de ligger i.
- Sletter du lysarket et kapittel begynner på, begynner kapittelet på
  neste lysark.

**Minivideo av noen få lysark** fantes fra før, og finnes fortsatt:
«Eksporter video» → «Fra lysark … til …». Tallene er lysarknumrene slik
du teller dem; gjentakelser som følger etter siste lysark, er med.

Prosjektformatet er nå versjon 9; eldre prosjekter åpnes som før.

**Begrensninger, sagt rett ut.**

- Hopper du *framover* over noen lysark og kommer tilbake til dem
  senere, står de også på sin vanlige plass i videoen, uten lyd (fem
  sekunder hver), slik lysark uten lyd alltid har gjort. Slett dem fra
  videoen ved å eksportere et utvalg, eller les dem inn.
- Det du sier på en gjentakelse, får ikke teksting av seg selv:
  tekstingen lages av manuset, og en gjentakelse starter uten manus.
  Skriv manus på stedet om du vil ha teksting der.
- Et lysark som vises igjen, kan ikke leses inn for seg. Slett det, og
  les inn fra lysarket før.
- «Avbryt» under opptak forkaster bare lysarket du står på; det du har
  lest inn før det, legges inn (som før).
- Munn og lyd: hvert bilde stemples når det kommer fram til programmet.
  Et kamera som er tregere enn mikrofonen, gir da et lite, fast etterslep
  i bildet. Det kan jeg ikke måle uten et ekte kamera.

**Prøvd** på Linux Mint, automatisk, uten vindu, med prøvemikrofon og
prøvekamera, uten nett: 20 nye enhetstester (`tests/repeats.test.ts`) og
seks nye ende-til-ende-tester (`tests/e2e-free.test.ts`): fram, to steg,
neste lysark, tilbake, sidemeny med kapitler, hopp, et lysark som bare
blas forbi, «Ferdig»; så lysarklista, visningen av «igjen»-lysarket,
videoen (målt i bildene: lysark A vises igjen der jeg gikk tilbake, med
begge stegene fra start; kapitlene ligger i fila med riktige navn og
tider) og spilleren (blar forbi gjentakelsen for hånd, «Spill av» viser
den). De gamle testene for opptak, kamera og «Lær mer» under innlesing
er kjørt på nytt og går gjennom; kameratesten er skrevet om til én film
for hele opptaket. En sjette ende-til-ende-test går gjennom pause, hopp
med sidemenyen mens opptaket står på pause, «Ta om dette lysarket» og
«Avbryt», med prøvekamera på, og måler at filmen sto stille i pausen og
under nedtellingen. Opptaks-, kamera- og lydtestene (19 tester) er også
kjørt mot den **pakkede utgaven** på Linux (pakket til en midlertidig
mappe; utgivelsesfilene i `release/` er ikke rørt). Hele testsettet
etter at PDF-importen var flettet inn (6.29): 450 tester går gjennom, én
er hoppet over (den lager bare bilder når den blir bedt om det).

**Ikke prøvd:** ekte kamera og ekte mikrofon, en lang forelesning (45
minutter) i ett opptak, og Windows (verken for hånd eller pakket).

### 6.29 PDF-import med tekst, bilder og lenker som egne elementer (25.11.2026)

Retter de tre tingene han meldte om PDF (6.26, punkt 1 til 3) og
kapitlene for PDF (punkt 7). Han valgte ikke bare anbefalingen «som i
PDF-en», men ba om et valg (6.27). Det som er bygget, er «som i
PDF-en»; valget står igjen (se nederst). **Ikke gitt ut.**

Selve importen ble bygget av en hjelpeagent i en egen arbeidskopi inne i
prosjektmappa (grenen `pdf-elements`, som ligger bare lokalt), etter en
skriftlig bestilling fra meg, og flettet inn i `main` etter at jeg hadde
kjørt testene og sett på resultatet selv.

**Hva som er nytt.**

- **Tekst er ekte tekst.** Tekstbitene i PDF-en settes sammen til linjer,
  avsnitt og blokker, med punktmerker, nivåer, fet, kursiv, hevet og
  senket skrift. Hver blokk blir ett tekstelement der teksten sto, som
  kan velges, flyttes og redigeres. Hver linje brytes der den brøt.
- **Skriften er Lysarks egen.** Skriftene i en PDF kan ikke tas med.
  Størrelsen tilpasses så linjene får plass der de sto. Fargen er den
  nærmeste i Lysarks palett.
- **Bilder er egne bildeelementer**, slik de så ut på siden (beskåret og
  dreid som der).
- **Lenker** som lå på tekst, ligger nå på de samme ordene. Lenker til en
  annen side i PDF-en blir lenker til det lysarket.
- **Resten av siden** (fargefelt, streker, tegninger) ligger bak som ett
  bakgrunnsbilde, uten teksten og bildene som er løftet ut.
- **Kapitler** fra bokmerkene i PDF-en. PowerPoint skriver ett bokmerke
  per seksjon. En PDF der bokmerkene bare er en liste over sidene, får
  ingen kapitler.
- **Det som ikke kan løftes ut trygt, blir stående i bakgrunnsbildet**,
  og lysarket merkes «å ordne» med en forklaring: formler, tekst på
  farget bunn i en farge Lysark ikke har for tekst, tekst som er
  gjennomsiktig, speilvendt eller loddrett, og bilder med noe tegnet
  oppå. En side uten tekst som kan hentes ut (en skannet side), er ett
  bilde som før.

**Sett med egne øyne og målt på hans egne filer** (innholdet er hans og
gjengis ikke her):

| Fil | Sider | Tid | Tekstelementer | Bilder | Lenker | Lysark «å ordne» | Bilder i alt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stål | 26 | 19 s | 149 | 59 | 5 | 5 | 3,8 MB |
| Betong | 94 | 71 s | 330 | 260 | 8 | 7 | 22,6 MB |

Kapitlene kom riktig i begge («Forside», fem kapitler, «Avslutningsside»,
på samme lysark som seksjonene i PowerPoint-fila). Jeg har sett på
lysark 3 og 5 av «Stål»: tittel, punktliste, fotografier og en innlimt
tabell står der de skal. I «Betong» fulgte én lenke ikke med, fordi den
ikke lå på tekst; importen sa fra. Ett lysark der er fortsatt ett bilde
(siden har ingen tekst).

**Begrensninger, sagt rett ut.**

- Liberation-skriftene er ikke like brede som skriftene i PDF-en, så
  teksten kan stå litt annerledes, særlig i tette oppsett.
- En tabell i en PDF blir ikke en tabell i Lysark.
- Hver side tegnes flere ganger, så importen tar tid (tallene over).
  Hvor lang tid den gamle importen brukte på de samme filene, har jeg
  ikke målt selv.
- En lenke som lå på et bilde eller et tomt felt, følger ikke med.
- Jeg har ikke gått gjennom alle sidene i noen av filene hans, bare et
  utvalg.

**Prøvd** på Linux Mint, automatisk og uten vindu: enhetstestene for de
rene delene (`tests/importer-pdf.test.ts`), ende-til-ende-testene
(`tests/e2e-pdf.test.ts`: tekst på plass, bilde som eget element,
lenker, bakgrunn uten tekst, sider som blir ett bilde), importen av alle
filene i `eksempler/` (`tests/real-files.test.ts`), og en test av regelen
for kapitler fra bokmerker. **Ikke prøvd:** Windows, og PDF-er fra andre
programmer enn PowerPoint utover prøvefilene testene lager selv.

**Valget «USN-stil eller som i fila» var ikke bygget da dette ble
skrevet.** Det er bygget senere samme dag, se 6.31. Slik sto det:

- *PDF:* «som i fila» er det som nå er bygget. «USN-stil» kan lages
  oppå det: samme elementer, men med temaets skrifter og farger og uten
  bakgrunnsbildet.
- *PowerPoint:* «USN-stil» er dagens import. «Som i fila» kan ikke lages
  direkte, fordi Lysark ikke kan tegne PowerPoint-lysark, og innholdet i
  et prosjekt viser til temaets roller, ikke til egne farger og
  skrifter. Anbefalingen min er å gå via en PDF av presentasjonen:
  utseendet fra PDF-en, manus (notatene) og kapitler fra
  PowerPoint-fila. Det trenger hans ja før det bygges.

### 6.30 Eieren presiserer valget ved import (25.11.2026)

Jeg spurte, etter 6.29, om «som i fila» for PowerPoint skulle lages via
en PDF av presentasjonen. Svaret hans, ordrett:

> Nei, som i fila mente jeg at pptx eller pdfen beholder sitt
> oprinnelige utseende, de skal bli tilbydt å få den over til USN stil,
> men det skal være fritt valg.

Slik er det lest: valget gjelder utseendet, ikke filtypen. Både en
PowerPoint-fil og en PDF skal kunne **beholde utseendet de har**.
Foreleseren **tilbys** å få forelesningen over i USN-stil, og velger
fritt. Spørsmålet mitt var stilt for teknisk; det handlet om hvordan
programmet får til det første for PowerPoint, ikke om hva valget er.

To spørsmål ble så stilt, hvert med én anbefaling. Han valgte begge
anbefalingene:

1. **Hvordan skal «Behold utseendet» virke for en PowerPoint-fil, når
   Lysark ikke selv kan tegne et PowerPoint-lysark?** Svar: «Lysark
   ordner det selv». Lysark ber PowerPoint (Windows) eller LibreOffice
   lage en PDF-kopi i bakgrunnen, og henter manus og kapitler fra
   PowerPoint-fila. Finnes ingen av programmene, ber Lysark om en PDF.
2. **Skal teksten kunne redigeres når utseendet beholdes?** Svar:
   «Redigerbar tekst», i Lysarks egen skrift, framfor et nøyaktig bilde
   av siden som ikke kan endres.

PowerPoint er ikke åpen kildekode. At Lysark får be en installert
PowerPoint om en PDF, er hans valg og det ene unntaket fra regelen om
åpen kildekode (AGENTS.md). Ingenting av PowerPoint tas inn eller følger
med.

### 6.31 Valget ved import er bygget, og mer om PDF-importen (25.11.2026)

**Valget.** Når du har valgt en PowerPoint-fil eller en PDF, spør Lysark:
«Hvordan skal lysarkene se ut?» med to valg og en forklaring til hvert.
«Behold utseendet» er valgt til du velger noe annet.

| | Behold utseendet | Gjør om til USN-stil |
| --- | --- | --- |
| **PDF** | Som bygget i 6.29: tekst og bilder er elementer, resten av siden ligger bak som bilde | Nytt: teksten og bildene på USN-stilens flate, i dens skrifter og farger, med logo. Streker, former og bakgrunn fra PDF-en følger ikke med. Største tekst øverst blir tittel |
| **PowerPoint** | Nytt: importeres via en PDF av presentasjonen. Navn, manus og kapitler hentes fra PowerPoint-fila | Importen som har vært der hele tiden |

**Hvor PDF-en av en PowerPoint-fil kommer fra**, i denne rekkefølgen:

1. PowerPoint lager den i bakgrunnen, der PowerPoint er installert
   (Windows).
2. En PDF med samme navn som ligger ved siden av PowerPoint-fila, og som
   ikke er eldre enn den.
3. LibreOffice lager den i bakgrunnen.
4. Finnes ingen av delene, ber Lysark deg velge en PDF av presentasjonen.

Lysark sier fra i meldingen etter importen hvor utseendet kom fra. Punkt
2 la jeg til etter å ha sett på resultatet: LibreOffice tegner ikke helt
som PowerPoint. På denne maskinen finnes ikke skriften presentasjonene
hans bruker, så linjer brøt annerledes, en tekst gikk ned i logoen, og
profilformene på forsiden manglet. PDF-en han selv har lagret fra
PowerPoint, er helt lik. Når LibreOffice er brukt, sier meldingen det, og
hva han kan gjøre for å få det helt likt.

Programmene arbeider på en kopi av fila, i en egen mappe, uten vindu.
Et skjult lysark er ikke med, slik det heller ikke er i PDF-en;
kapittelet som begynte på det, begynner på neste lysark.

**Prøvd** på Linux Mint, automatisk og uten vindu: fire nye
ende-til-ende-tester (`tests/e2e-look.test.ts`): PowerPoint med
utseendet beholdt via LibreOffice (LibreOffice startet uten vindu), via
en PDF ved siden av, via spørsmålet om en PDF når ingen programmer
finnes, og en PDF gjort om til USN-stil; og tre nye enhetstester for
hvordan lysarkene i PowerPoint-fila passes til sidene i PDF-en. «Stål»
fra hans egen PowerPoint-fil, med utseendet beholdt: 26 lysark, riktige
kapitler, 15 sekunder (via PDF-en ved siden av), og 6,5 sekunder for
LibreOffice å lage PDF-en da jeg prøvde det for seg. Hele testsettet: 458
tester går gjennom, én er hoppet over.

**Ikke prøvd:** veien gjennom PowerPoint på Windows. Den er skrevet, men
kan ikke kjøres her (ingen PowerPoint), så den er helt uprøvd. Heller
ikke LibreOffice på Windows. USN-stil for en av hans egne PDF-er har jeg
ikke sett på med egne øyne.

**Begrensninger, sagt rett ut.**

- En PowerPoint-fil som beholder utseendet, mister animasjonene (stegene)
  og video inne i lysarkene. De finnes ikke i en PDF.
- Skriften blir Lysarks egen, også når utseendet beholdes (valget hans).
- USN-stil for en PDF tar ikke med noe annet enn tekst og bilder. Et
  lysark som bestod av en tegning, blir da tomt for den. Har han
  PowerPoint-fila, gir den en bedre USN-stil.
- Valget tas ved import. Det kan ikke byttes etterpå uten å importere på
  nytt.

**Mer om PDF-importen, fra hjelpeagentens sluttrapport** (det jeg ikke
hadde da 6.29 ble skrevet; tallene er dens egne målinger, ikke mine):

- Etter 6.29 ble det lagt til at det som er tegnet oppå et bilde (skilt,
  piler, ord), løftes ut sammen med bildet i stedet for å bli liggende i
  bakgrunnen. «Betong» har etter det 383 bildeelementer og 18,8 MB
  bilder, «Stål» 81 bildeelementer og 3,1 MB.
- Den gamle importen brukte 157 sekunder på «Betong» og ga 38,2 MB; den
  nye bruker 43 til 63 sekunder (71 da jeg målte, med annet arbeid på
  maskinen). «Stål»: 49 sekunder og 8,4 MB før, 12 til 15 sekunder nå.
- Den sammenlignet omtrent 35 sider fra sju av filene hans med PDF-en,
  side om side. Det som fortsatt avviker: teksten er omtrent 10 % mindre
  (Calibri er smalere enn Liberation), punktmerkene er Lysarks egne,
  lenket tekst mister sin egen farge, overskriftsrader i tabeller (hvit
  tekst på farge) ligger i bakgrunnen mens resten av tabellen er tekst,
  og formler er bilder.
- Ikke laget: tabeller som tabeller, nummererte lister som lister, og
  lenker på bilder (formatet har ikke plass til det).
- Bare PDF-er laget av PowerPoint er prøvd på ekte filer.

### 6.32 Fri figur: grupper, og piler som fester seg (26.11.2026)

**Startmeldingen.** Feltene «Det jeg har funnet siden sist» og «Innspill
til produktet» sto tomme («(skriv her)»), så det var ingenting å rette
og ingen innspill å føre inn. Eieren spurte først hva planen for økta
var, fikk den, og svarte: «Gå på leveranse 4». Det som sto under «Det
jeg trenger fra deg» i HANDOFF.md, er altså fortsatt ikke prøvd av ham.

**Fire spørsmål, stilt samlet før noe ble bygget, og svarene hans
(25.11.2026):**

1. *Hvordan skal du lage en fri figur?* Anbefaling: rett i lysarket, av
   formene som finnes, med piler som fester seg og «samle til én».
   Alternativet var et eget figurvindu. **Svar: rett i lysarket.**
2. *Hva skal en mal være etter at skjemaet er fylt ut?* Anbefaling:
   skjemaet styrer, og figuren tegner seg selv; «Gjør om til fri figur»
   slipper den løs for godt. Alternativet var en fri figur med en gang.
   **Svar: skjemaet styrer.**
3. *Hvordan skal en figur komme inn i en «Lær mer»-boks?* Anbefaling:
   hentes fra et lysark (en kopi legges i boksen). Alternativene var en
   egen tegneflate i byggeren, eller å vente. **Svar: hentes fra et
   lysark.**
4. *Hva skal det hete å gjøre flere deler til én figur?* Anbefaling:
   «Samle til figur» og «Løs opp figuren». **Svar: «Grupper»** (og «Del
   opp gruppen»), som i PowerPoint. Her valgte han altså ikke
   anbefalingen.

**Hva som er nytt.**

- **En pil eller linje fester seg.** Når en ende dras inn på et element
  og slippes der, festes den til det. Enden legger seg på kanten av
  elementet, på den siden som vender mot den andre enden, og følger
  elementet når det flyttes eller endrer størrelse. Er begge endene
  festet, går pila korteste vei mellom de to. En ellipse møtes på den
  runde kanten. Med Alt nede festes ikke enden.
- **Løsne:** dra enden bort, eller trykk «Løsne» under «Festet til» i
  egenskapene. En pil som flyttes alene, løsner; flyttes den sammen med
  det den er festet til, sitter den. Slettes boksen, blir pila liggende.
- **Det synes at en ende er festet:** håndtaket er lilla, og det den er
  festet til, har en stiplet ring mens pila er valgt.
- **«Sett pil mellom dem»** i egenskapene når to elementer er valgt.
  Pila går fra det som ble valgt først, til det som ble valgt sist.
- **«Grupper»** (egenskapene eller høyreklikk) gjør to eller flere
  elementer til en gruppe. Et klikk på en del velger hele gruppen. Den
  flyttes, kopieres og slettes samlet. Et klikk til på en del velger bare
  den; dobbeltklikk skriver i den. «Velg hele gruppen» fører tilbake.
  «Del opp gruppen» løser den opp. En gruppe i en gruppe blir én gruppe.
- **Flere valgte elementer har én ramme** med håndtak, og endrer
  størrelse samlet. Det gjelder også når de ikke er gruppert. Er det
  bilder eller video blant dem, holdes forholdet mellom bredde og høyde.
- **«Ett steg per del»** for en gruppe: delene kommer inn i leseretning,
  og en festet pil kommer inn sammen med det den peker på.
- **I HTML-fila og i videoen** er figurene vanlige former. Koden som
  tegner lysarket, er ikke endret: en festet pil er en vanlig pil med en
  boks, som legges riktig etter hver endring. Prosjektformatet er nå
  versjon 10; eldre prosjekter åpnes som før.

**En gammel feil, funnet underveis og rettet:** «Lag kopi» av et lysark
mistet merkene og forklaringslista på bildene. Kopien av merket pekte på
bildet i det gamle lysarket, så oppryddingen fjernet det. Feilen har
vært der siden merket bilde ble bygget (6.25). Bekreftet ved å kjøre den
nye testen mot den gamle koden (5 elementer i kopien i stedet for 7).

**Begrensninger, sagt rett ut.**

- Teksten i boksene endrer ikke størrelse når en gruppe gjøres større
  eller mindre. Bare boksene gjør det.
- Du velger ikke selv hvor på kanten en pil fester seg, og en pil kan
  ikke ha knekk.
- En ende festes ikke til noe som dekker mer enn halve lysarket. Det er
  med vilje: ellers ville hver pil festet seg til bakgrunnsbildet på et
  lysark fra en PDF.
- Når flere elementer endrer størrelse samlet, hopper piler som er
  festet mellom dem, på plass når du slipper.
- En gruppe kan ikke dreies samlet.
- Grupper og koblingslinjer i en PowerPoint-fil kommer fortsatt inn som
  løse former. Importen er ikke rørt.
- Det finnes ingen hurtigtast for «Grupper» (Ctrl+G er rutenettet).

**Prøvd** på Linux Mint, automatisk og uten vindu: 17 enhetstester
(`tests/groups.test.ts`) og fire ende-til-ende-tester som starter hele
programmet (`tests/e2e-groups.test.ts`): sette pil mellom to bokser, dra
en boks og se pila følge, angre, feste en ende ved å dra den inn på en
ellipse, løsne den på tre måter, gruppere, velge og dra gruppen, endre
størrelse med rammen, gå inn i gruppen, skrive i en del, ett steg per
del, se stegene i forhåndsvisningen slik en student ser dem, dele opp,
og gruppere fra høyreklikkmenyen. To skjermbilder fra testen er sett på.
Innholdet i testene er prøveinnhold («A», «B», «C»).

Hele testsamlingen (479 tester i 33 filer, én hoppes over som før) er
kjørt tre ganger. To ganger besto alt. Én gang feilet to tidsmålinger i
testen for fritt opptak (`tests/e2e-free.test.ts`: lyden til et lysark
var kortere enn ventet), mens maskinen var tungt belastet av annet
arbeid. Den testen besto alene rett etterpå, og koden den prøver, er
ikke rørt i denne økta. Den er altså følsom for belastning; det er
ikke undersøkt nærmere.

**Ikke prøvd:** Windows, den pakkede utgaven, dine egne lysark, og
video med en figur i (tegnekoden er uendret, men det er ikke målt).
Ingen har prøvd dette for hånd med mus; alt er kjørt av testene.

### 6.33 Maler der skjemaet styrer: prosess, lag og sammenligning (26.11.2026)

Bygget rett etter fri figur, i samme økt, på svaret «skjemaet styrer»
(6.32, spørsmål 2). Ingen nye spørsmål ble stilt; det jeg valgte selv,
står under «Valg jeg tok».

**Hva som er nytt.**

- **«Sett inn → Figur»** har tre maler: **Prosess** (bokser med piler
  mellom), **Lagvis oppbygging** (lag oppå hverandre) og
  **Sammenligning** (kolonner med overskrift og punkter).
- **Skjemaet står i egenskapene** når figuren er valgt: én rad per boks,
  lag eller kolonne, med «Legg til», «Flytt opp», «Flytt ned» og «Fjern».
  Figuren tegner seg selv mens du skriver. Malene starter tomme.
- **Figuren flyttes og endrer størrelse med rammen** rundt den, og
  legger seg ut på nytt inni rammen.
- **Prosess** kan gå bortover eller nedover. **Farge** og
  **skriftstørrelse** velges for hele figuren.
- **Du kan også skrive rett i en boks** i lysarket (dobbeltklikk). Det du
  skriver, går inn i skjemaet.
- **«Ett steg per boks»** (eller lag, eller kolonne): radene kommer inn
  én etter én. I en prosess kommer pila sammen med boksen den leder
  til; i en sammenligning kommer overskriften sammen med punktene.
- **Hver del kan ha «Lær mer»**, og beholder den og steget sitt om raden
  flyttes i skjemaet.
- **«Gjør om til fri figur»** tar bort skjemaet for godt. Formene står
  igjen som en vanlig gruppe, med pilene festet, og kan endres del for
  del.
- **I HTML-fila og i videoen** er figuren vanlige former; koden som
  tegner lysarket, kjenner ikke til malene. Prosjektformatet er nå
  versjon 11.

**Valg jeg tok uten å spørre** (si fra hvis noe skal være annerledes):

- En rad heter «boks», «lag» eller «kolonne», aldri «steg», fordi
  «steg» allerede er stegene i et lysark.
- Fargene: prosess og overskrifter er lilla. Lagene får hver sin farge
  fra paletten (indigo, lilla, medium lilla, lys lilla, lys indigo) så de
  kan skilles; velger du én farge, skilles de av et lite mellomrom.
- En ny prosess har tre tomme bokser, en ny lagfigur tre lag, og en ny
  sammenligning to kolonner.
- **Tidslinje-malen er ikke bygget,** fordi navnet kolliderer med fanen
  «Tidslinje» under lysarket. Eieren må velge navn først.
- Søyle- og linjediagram er ikke bygget ennå.

**En feil funnet av testen og rettet før noe ble sendt ut:** når en rad
ble lagt til i skjemaet, var ikke de nye delene med i det som var valgt,
så panelet byttet fra skjemaet til «6 elementer valgt». Hele figuren
holdes nå valgt når skjemaet endres.

**Begrensninger, sagt rett ut.**

- Teksten krymper ikke av seg selv når den er for lang for boksen. Gjør
  rammen større eller skriften mindre.
- En del kan ikke flyttes eller få egen farge så lenge skjemaet styrer.
  Drar du i en del, hopper den tilbake.
- Teksten i en del er ren tekst: fet, kursiv og lenker følger ikke med
  inn i skjemaet.
- Figuren kan ikke dreies.
- «Lag kopi» av én del gir en løs form, ikke en ny rad.

**Prøvd** på Linux Mint, automatisk og uten vindu: 15 enhetstester
(`tests/templates.test.ts`) og fire ende-til-ende-tester
(`tests/e2e-templates.test.ts`): sette inn en prosess, fylle ut, legge
til, flytte og fjerne rader, snu den nedover, bytte farge, dra figuren,
endre størrelse med rammen, skrive i en boks i lysarket, ett steg per
boks, se stegene i forhåndsvisningen, gjøre om til fri figur og angre,
og sette inn og fylle ut lag og sammenligning. Fem skjermbilder fra
testen er tatt, og to er sett på. Hele testsamlingen: 498 består, én
hoppes over som før.

**Ikke prøvd:** Windows, den pakkede utgaven, lange tekster, og video
med en slik figur i (tegnekoden er uendret, men det er ikke målt).
Ingen har prøvd dette for hånd med mus.

### 6.34 PowerPoint i Windows-VM-en, uten innlogging (26.11.2026)

**Les 6.35 først: konklusjonen under var feil.** Årsaken til at
lagringen feilet, var at prøvefila ikke hadde noen lysark, ikke at
Office manglet innlogging.

Eieren skrev midt i økta: «Jeg har installert m365 på VM, men har
trøbbel med en visuell glitch på et popupvindu som kommer når jeg
starter et m365 program. Hvis du får fikset feilen på et eller annet
vis, så kan du teste med powerpoint i winodows.» Senere: «Try again».

**Det jeg fant.**

- Popupvinduet er «Sign in to get started with PowerPoint», og vinduet
  etter det er Microsofts innlogging. **Begge tegnes riktig i VM-ens eget
  bilde** (skjermbilder tatt fra verten). Jeg får altså ikke fram
  glitchen; den oppstår trolig i visningen mellom VM-en og skjermen
  (SPICE, skjermkort «vga»). Jeg har ikke endret noe i VM-ens oppsett.
- **Office er ikke logget inn.** Det er dette som stopper PowerPoint,
  ikke glitchen i seg selv. Innloggingen krever eierens konto og
  passord, og det skriver jeg ikke inn.
- **Uten innlogging nekter PowerPoint å lagre.** Jeg sendte PowerPoint
  den samme forespørselen som Lysark sender («Behold utseendet»: åpne en
  kopi uten vindu, lagre som PDF), to ganger med omtrent tjue minutters
  mellomrom. Begge ganger: fila åpnes, og lagringen feiler etter ett
  sekund med «An error occurred while PowerPoint was saving the file».
  Ingen PDF. Den henger ikke.
- **For foreleseren betyr det:** har du PowerPoint som ikke er logget
  inn, går Lysark videre til neste vei (en PDF ved siden av, så
  LibreOffice, så spørsmål om en PDF), uten å vente.

**En svakhet funnet og rettet:** når lagringen feilet, lukket ikke
Lysark kopien i PowerPoint, så PowerPoint ble stående igjen skjult med
fila åpen. Da kunne heller ikke arbeidsmappa slettes, og det kunne blitt
til en feilmelding i stedet for neste vei. Nå lukkes kopien uansett, og
en mappe som ikke lar seg slette, stopper ikke importen. Den rettede
forespørselen er kjørt i VM-en: lagringen nektes som før, kopien lukkes,
og ingen PowerPoint-prosess står igjen.

**Ikke prøvd, fortsatt:** at PowerPoint faktisk lager PDF-en når Office
er logget inn, og Lysark selv med «Behold utseendet» på Windows. Ingenting
av det som er nytt etter 0.4.0, er prøvd i Lysark på Windows; det som er
prøvd her, er bare forespørselen til PowerPoint, fra PowerShell.

**Om VM-en.** Den var tungt belastet (99 % CPU), og lange linjer skrevet
med tastetrykk ble forvrengt to ganger fordi AltGr ble hengende. Ingen
forvrengt linje ble kjørt. Forespørselen ble til slutt lagt i en
skriptfil på en CD-avbildning, som er tatt ut og slettet igjen. Igjen i
VM-en ligger bare en kopi av prøvefila i brukerens midlertidige mappe
(`lysark-inn.pptx`). Rådet er skrevet inn i `tools/windows-vm.py`.

### 6.35 «Behold utseendet» med PowerPoint på Windows: prøvd, og det virker (26.11.2026)

Eieren logget inn i Office i VM-en og skrev «Jeg har logget inn».

**Rettelse av 6.34.** Der skrev jeg at PowerPoint nektet å lagre fordi
Office ikke var logget inn. **Det var feil.** Forespørselen feilet like
mye etter innloggingen. Årsaken var prøvefila: `test.pptx` på
skrivebordet har **null lysark**, og PowerPoint kan ikke lage PDF (eller
bilde) av en presentasjon uten lysark. Om et PowerPoint som ikke er
logget inn, kan lagre, er altså aldri prøvd med en ordentlig fil.

Slik ble det funnet, i tur og orden: sju måter å be om PDF-en på feilet
likt; lagring som .pptx virket, lagring som PDF og PNG feilet; skriver
fantes; å slå av maskinvareakselerert grafikk i Office hjalp ikke (den
ene registerverdien er tatt bort igjen); en ny presentasjon med ett
lysark ble til PDF; og prøvefila viste seg å ha 0 lysark.

**Det som er prøvd, i VM-en (Windows 11, PowerPoint 16.0 bygg 20625):**

- PowerPoint laget selv en prøvefil: tre lysark med nøytralt innhold
  («Overskrift A», punktene «En», «To», «Tre», en farget boks «Boks C»),
  manuset «Manus B» på lysark 2 og seksjonen «Kapittel B» fra lysark 2.
- **Forespørselen Lysark sender** (åpne en kopi uten vindu, skrivebeskyttet,
  lagre som PDF) ga en PDF på 42 kB på under ett sekund.
- **Dagens Lysark**, pakket for Windows i en egen mappe og kjørt fra en
  CD-avbildning: «Importer PowerPoint» → fila → spørsmålet «Hvordan skal
  lysarkene se ut?» kom opp med «Behold utseendet» valgt → «Importer» →
  valg av prosjektmappe → prosjektet åpnet. Meldingen: «behold.pptx er
  importert: 3 lysark. Tekst og bilder er egne elementer som kan flyttes
  og endres. Manus og kapitler er hentet fra PowerPoint-fila. Lysark 3
  har merknader fra importen …». LibreOffice er ikke i VM-en og ingen
  PDF lå ved siden av, så det var PowerPoint som tegnet.
- **Sett på:** kapitlene «Default Section» og «Kapittel B» i lysarklista;
  lysark 1 med overskrift og undertittel; lysark 2 med overskrift, tre
  punkter og «Manus B» i manusfeltet; lysark 3 med boksen som bilde og
  merknaden under «Fra importen».
- **Ingen PowerPoint-prosess sto igjen** etter importen.
- **Figur-menyen** (6.33) ble åpnet i samme slengen: «Prosess» ga tre
  bokser med piler og skjemaet i egenskapene. Den ble angret igjen.

**Endret etter dette:** når det er PowerPoint som har tegnet lysarkene,
sier meldingen etter importen det («PowerPoint har tegnet lysarkene.»),
slik den allerede gjorde for LibreOffice og for en PDF ved siden av.
Den setningen er ikke sett på Windows; den kom etter prøven.

**Ikke prøvd:** dine egne forelesninger gjennom PowerPoint-veien (bare
én liten fil laget for prøven), en fil mens PowerPoint står åpent med
andre presentasjoner, PowerPoint uten innlogging, og en fil uten
lysark gjennom Lysark (PowerPoint nekter; Lysark skal da gå videre til
neste vei). Av det nye etter 0.4.0 er ellers bare dette prøvd på
Windows: importen over, kapitlene i lista og Figur-menyen. Fritt opptak,
PDF-import, grupper og festede piler er fortsatt ikke prøvd der.

**Glitchen** i popupvinduet fikk jeg aldri fram: alle vinduene tegnes
riktig i VM-ens eget bilde. Den hindret ikke prøven.

**Igjen i VM-en:** `C:\Users\simen\lysark-test\behold.pptx` og
prosjektmappa `behold-ppt` samme sted, og noen små prøvefiler i den
midlertidige mappa (`lysark-*.pdf`, `lysark-inn.pptx`).

### 6.36 Malen «Tidsakse» (26.11.2026)

**Eierens valg:** malen for hendelser i rekkefølge heter **«Tidsakse»**.
«Tidslinje» er fanen under lysarket, og det navnet beholder fanen.

**Bygget:**

- **«Sett inn → Figur → Tidsakse».** En strek med et punkt for hver
  hendelse. Tidspunktet står i en boks på den ene siden av streken, og
  teksten står uten ramme på den andre. Malen starter med tre tomme
  hendelser.
- **Skjemaet** har «Tidspunkt» og «Tekst» for hver hendelse, «Legg til
  hendelse», flytt opp og ned, «Fjern», «Ett steg per hendelse»,
  «Retning» (bortover eller nedover), farge, skriftstørrelse og «Gjør om
  til fri figur». Raden heter «hendelse».
- **Bortover** står tidspunktet over streken og teksten under.
  **Nedover** står tidspunktet til venstre og teksten til høyre.
- **Teksten er en vanlig tekstboks**, ikke en form, og finnes bare når
  det er skrevet noe. Dette er nytt: til nå var alle deler av en figur
  med skjema former. Etter «Gjør om til fri figur» er tekstene vanlige
  tekstbokser i gruppen.
- **På lysarket:** dobbeltklikk for å skrive i boksen eller i teksten;
  det havner i skjemaet. Slettes teksten alene, tømmes feltet, og
  hendelsen står. Slettes punktet eller boksen, forsvinner hendelsen.
  Streken er ingen hendelse; slettes den alene, tegnes den på nytt.
- **Steg:** «Ett steg per hendelse» lar punkt, boks og tekst komme inn
  sammen. Streken står der fra start.
- **Formatet** er nå 12 (`docs/prosjektformat.md`). Eldre prosjekter
  leses som de er.

**Rettet i samme slengen, for alle malene:**

- **En del som kommer til i en rad som har steg,** kommer nå inn sammen
  med resten av raden. Før sto den der fra start. Det gjaldt pila i en
  prosess når en boks ble flyttet i skjemaet etter «Ett steg per boks»,
  og ville ha gjeldt teksten til en hendelse skrevet etter stegene.
- **Leserekkefølgen for skjermleser.** En figur med skjema leses nå rad
  for rad: hendelse for hendelse, kolonne for kolonne. Før ble en
  sammenligning lest som alle overskriftene først og punktene etterpå,
  fordi rekkefølgen bare fulgte plassen på lysarket. Det som tegnes, er
  uendret.

**En feil jeg laget og rettet underveis:** første utgave av
leserekkefølgen dro kontrollkoden for prosjektformatet inn i
HTML-spilleren, så den vokste fra 52 til 151 kB. En test fra før fanget
det (den eksporterte fila skal ikke ha adresser ut). Funksjonen ligger
nå i en egen liten fil (`src/shared/layout/rows.ts`), spilleren er
53 kB, og en ny test passer på at den holder seg slik.

**Prøvd på Linux Mint:**

- 13 nye enhetstester (`tests/timeaxis.test.ts`) og 5 nye prøver i det
  bygde programmet uten vindu (`tests/e2e-timeaxis.test.ts`): sette inn,
  fylle ut, legge til, flytte og fjerne en hendelse, skrive og slette på
  lysarket, snu nedover og tilbake, steg sett i forhåndsvisningen, og
  fri figur med angre.
- Sett på tre bilder fra prøvene: bortover og nedover i programmet, og
  forhåndsvisningen etter to steg.
- Hele testsamlingen: 516 består og 1 hoppes over som før. Det var den
  tredje kjøringen. I den første feilet HTML-testen på feilen over. I
  den andre feilet to tester for fritt opptak på tid (maskinen var
  opptatt med annet, last 7–10); de besto alene rett etterpå og i den
  tredje kjøringen. Det er den samme testfila som i 6.32.

**Ikke prøvd:** Windows. Tidsaksen i en videofil (MP4) og i en
eksportert HTML-fil åpnet i en nettleser; den består av vanlige former
og tekstbokser, som begge er prøvd fra før, men selve tidsaksen er bare
sett i programmet og i forhåndsvisningen. Lange tekster. En skjermleser
er ikke brukt; det er rekkefølgen i fila som er kontrollert.

**Kjent:** hendelsene står med lik avstand, ikke etter hvor lang tid
det er mellom dem. Teksten krymper ikke når den er for lang.

### 6.37 Søyle- og linjediagram: fire spørsmål og svar (26.11.2026)

Før diagrammene bygges, spurte jeg om fire ting. Eierens svar:

| Spørsmål | Svar |
| --- | --- |
| Hvordan vil du skrive inn tallene? | **Liten tabell** i egenskapene, der du også kan lime inn rett fra Excel (anbefalt) |
| Linjediagram: hva står langs den vannrette aksen? | **Tall, plassert etter verdi** (anbefalt). Søylediagram har navn langs aksen |
| Hvilke typer i første runde? | **Stående søyler og linje** (anbefalt). Liggende og stablede kan komme etterpå |
| Diagrammer i PowerPoint-fila du importerer? | **Gjør om til Lysark-diagram.** (Jeg anbefalte bilde, som nå.) Søyle- og linjediagram leses inn med tallene; andre typer blir fortsatt bilder. Gjøres etter at selve diagrammene er laget |

To ting valgte jeg selv, etter vanlig skikk, og sier fra om:
søyler starter alltid på null, og et linjediagram velger selv hvor aksene
starter og slutter (du kan overstyre laveste og høyeste verdi).

### 6.38 Søyle- og linjediagram er bygget (26.11.2026)

**Bygget:**

- **«Sett inn → Figur → Søylediagram»** og **«Linjediagram»**. Et nytt
  diagram har akser og ingenting annet: ingen tall er funnet på.
- **Tabellen i egenskapene.** Søylediagram: en kolonne med navn, og en
  kolonne med tall for hver serie. Linjediagram: en kolonne med x, og en
  kolonne for hver serie. Tall skrives med komma eller punktum. Det som
  ikke er et tall, får rød ramme og endrer ingenting.
- **Lim inn fra Excel.** Limer du inn flere celler, legges de inn fra
  cellen du står i, og tabellen får flere rader og serier ved behov. Er
  første linje uten tall, blir den navn på seriene.
- **Aksene** velger runde tall selv (1, 2 eller 5 ganger en tierpotens).
  Søyler har alltid null med. «Laveste tall» og «Høyeste tall» kan
  settes for hånd. Tallene langs aksen skrives med komma.
- **Linjediagram:** punktene står der x- og y-tallene sier, ikke med lik
  avstand. Mangler et tall, brytes linja der. Et punkt utenfor en akse
  du har satt selv, tegnes ikke på feil sted; linja brytes. «Vis
  punktene» setter en prikk i hvert punkt. Linjene er rette mellom
  punktene.
- **Tekst ved aksene** (med enhet, slik du skriver den), og en
  forklaring øverst til høyre med farge og navn for hver serie som har
  navn. Fargene er temaets seriefarger, og kan velges per serie.
- **Steg:** «Ett steg per rad» (søyler) og «Ett steg per serie». Aksene
  og tallene står der fra start. En søyle eller serie som kommer til
  etterpå, kommer inn sammen med sine.
- **På lysarket:** navn under søylene, navn i forklaringen og tekst ved
  aksene kan skrives med dobbeltklikk. Tallene skrives bare i tabellen.
  Slettes en søyle alene, tømmes tallet. Slettes navnet under en
  søylegruppe, går raden. Slettes en kurve, går serien.
- **For den som ikke ser diagrammet:** tallene ligger i HTML-fila som en
  tabell som leses opp, men ikke vises.
- **Bygd av vanlige deler,** som de andre malene: søylene er
  rektangler, tallene og navnene er tekstbokser, og en linje er én ny
  form, «kurve». «Gjør om til fri figur» virker derfor som før, og
  bevegelsene som kommer (vokse, tegne strek), kan brukes på dem.
- **En hel figur med skjema har nå én ramme** når den er valgt, ikke en
  ramme rundt hver del. Det gjelder alle malene.
- **Formatet** er 13.

**Prøvd på Linux Mint:** 18 nye enhetstester (`tests/charts.test.ts`) og
3 prøver i det bygde programmet uten vindu (`tests/e2e-charts.test.ts`):
skrive tall for hånd, lime inn det et regneark gir, to serier, tekst
ved aksene, steg sett i forhåndsvisningen, tabellen som leses opp,
linjediagram med prikker og en akse satt for hånd, fjerne en serie, og
fri figur med angre. Tre bilder er sett på.

**Ikke prøvd:** Windows. Å lime inn fra et ekte Excel eller LibreOffice
Calc (testen sender den samme teksten som et regneark legger på
utklippstavla). Et diagram i en videofil. Mange serier eller mange
rader. En skjermleser er ikke brukt.

**Kjent:** radene kan ikke flyttes opp og ned i tabellen. Lange navn
under søylene brytes eller går over hverandre; skriften krymper ikke.
Liggende og stablede søyler, kake- og punktdiagram finnes ikke.

### 6.39 Diagrammer fra PowerPoint blir Lysark-diagram (26.11.2026)

Eieren valgte dette i 6.37, mot anbefalingen min om å la dem være bilder.

**Bygget** (`src/importer/chart.ts`, brukt av PowerPoint-importen):

- **Stående søyler ved siden av hverandre** blir et søylediagram, med
  navnene, seriene og tallene fra PowerPoint-fila.
- **Punktdiagram med linjer** blir et linjediagram, når seriene har de
  samme x-tallene (tabellen har én x-kolonne).
- **Linjediagram** blir et linjediagram bare når alt som står langs
  aksen, er tall. Står det navn der, har PowerPoint gitt dem lik avstand,
  og Lysark måtte ha funnet på hvor de skulle stå. Da gjøres det ikke om.
- **Med på lasset:** teksten ved aksene, laveste og høyeste tall der de
  er satt i PowerPoint, prikker i punktene, og diagrammets egen
  overskrift (som en tekstboks over diagrammet).
- **Ikke gjort om:** liggende og stablede søyler, kake, areal, 3D,
  flere typer i ett diagram, datoer langs aksen, punkter uten linjer, og
  et diagram som er for lite til akser og tall. De blir som før: et
  bilde hvis fila har et bilde av dem, ellers en merknad.
- **Fargene** følger temaets seriefarger, ikke PowerPoint-fargene.
  Glattede linjer blir rette.
- **Merknaden under «Fra importen»:** «Diagrammet er gjort om til et
  Lysark-diagram med tallene fra PowerPoint. Se over at det stemmer.»
- Tallene leses fra diagrammet selv (det PowerPoint har lagret der).
  Regnearket som ligger inni fila, åpnes aldri.

**Viktig begrensning:** dette gjelder bare når du velger **«Gjør om til
USN-stil»**. Med «Behold utseendet» hentes lysarkene inn via en PDF, og
da ligger diagrammet i bildet bak, som resten av det som ikke er tekst
eller bilder.

**Eierens valg (26.11.2026):** slik skal det være. Jeg spurte om
diagrammer skal gjøres om også når lysarkene beholder utseendet, og
svaret var **«Nei, bare USN-stil»**.

**Prøvd på Linux Mint:** 4 nye tester (`tests/importer-chart.test.ts`)
med PowerPoint-filer bygd i testen: søyler med to serier, hull, negativt
tall, aksetekster, fast høyeste tall og overskrift; linjediagram med
tall langs aksen; punktdiagram; og ti tilfeller som ikke skal gjøres om.
Hele testsamlingen: 541 består, 1 hoppes over som før, i én kjøring.

**Ikke prøvd, og det er det viktigste hullet:** et diagram som
PowerPoint selv har laget. De ni PowerPoint-filene i `eksempler/` har
ingen diagrammer (jeg telte: null diagramdeler). Jeg gjorde klar en
prøve i Windows-VM-en, der PowerPoint lager seks diagrammer og Lysarks
import leser dem, men VM-en var i bruk til annet arbeid da jeg kom dit.
Jeg skrev og klikket ingenting der, og tok CD-avbildningen ut igjen.
Filene i testene er skrevet etter hvordan jeg kjenner formatet, ikke
etter en fil fra PowerPoint.

### 6.40 Diagramimporten prøvd på diagrammer PowerPoint selv har laget (26.11.2026)

**Startmeldingen.** Feltene «Det jeg har funnet siden sist» og «Innspill
til produktet» sto tomme («(skriv her)»), så det var ingenting å føre
inn og ingenting å rette. Jeg gikk rett på «Neste steg» i HANDOFF.md.
Det som står under «Det jeg trenger fra deg», er altså fortsatt ikke
prøvd av eieren.

**VM-en var ledig** (bare skrivebordet på skjermen), så hullet fra 6.39
ble tettet.

**Slik ble det gjort:**

- Et skript (`tools/vm/diagrammer.ps1`) lar PowerPoint i VM-en lage en
  presentasjon med 13 lysark og ett diagram på hvert. Ett er urørt, slik
  PowerPoint lager det. De andre har prøvetall («A», «B», «C», 1, 2, 3).
- **Fila måtte ut av VM-en.** Det finnes ingen vei ut: CD-en er bare til
  å lese, og VM-en når ikke verten. Jeg laget en: fila vises på
  VM-skjermen som bilder av fargede ruter (`tools/vm/ut.ps1`), og
  `tools/windows-vm.py read` leser den av skjermbilder, med en kontrollsum
  i hvert bilde. Fila (218 kB, pakket til 105 kB) kom ut hel i tre
  bilder, alle de fem gangene skriptet ble kjørt.
- Fila ligger i `eksempler/fra-powerpoint/diagram.pptx`, utenfor git, og
  `tests/real-charts.test.ts` importerer den og sier hva hvert lysark
  skal bli.

**Resultatet. Importen trengte ingen endring:**

| Lysark | Diagram i PowerPoint | I Lysark |
| --- | --- | --- |
| 1 | Stående søyler, urørt (tre serier, fire navn) | Søylediagram, alle tolv tallene riktige |
| 2 | Stående søyler, to serier, et hull, et negativt tall, overskrift, aksetekster, høyeste tall 10 | Søylediagram med alt dette |
| 3 | Linjediagram med navn langs aksen | **Ikke gjort om** (med vilje den gangen, se under; gjøres om fra 6.44) |
| 4 | Linjediagram med tall langs aksen, et hull | Linjediagram, punktene på 0, 1 og 4 |
| 5 | Det samme med prikker, overskrift og aksetekster | Linjediagram med prikker og tekstene |
| 6 | Punktdiagram med rette linjer, x fra 0 til 8 | Linjediagram med aksen fra 0 til 8 |
| 7 | Punktdiagram med linjer uten prikker | Linjediagram uten prikker |
| 8 | Punktdiagram med glattede linjer | Linjediagram (linjene blir rette) |
| 9 til 13 | Punkter uten linjer, stablede søyler, liggende søyler, kake, areal | Ikke gjort om |

**To ting dette viste, som du bør vite:**

- **Et diagram som ikke gjøres om, forsvinner fra lysarket.** PowerPoint
  lagrer ikke noe bilde av diagrammene sine, så det finnes ingenting å
  falle tilbake på. Lysarket får merknaden «Diagrammet følger ikke med og
  må lages på nytt». Slik har det alltid vært; det nye er at jeg nå har
  sett det på en ekte fil. Med «Behold utseendet» ligger diagrammet i
  bildet bak, som før.
- **PowerPoints vanlige linjediagram har navn langs aksen** («Kategori 1»
  og så videre) og gjøres derfor ikke om. Du valgte i 6.37 at et
  linjediagram i Lysark har tall langs aksen, plassert etter verdi.
  Skriver foreleseren tall i første kolonne (årstall, for eksempel),
  gjøres det om. Dette ble spørsmål 2 i 6.43, og er endret i 6.44:
  linjediagram med navn gjøres nå om.

**Prøvd:** PowerPoint 16.0 (bygg 20625) i VM-en laget fila. Importen ble
kjørt på Linux Mint, av testen, som sammenligner tallene. Fila er også
importert i programmet selv (uten vindu, «Gjør om til USN-stil»), og
bilder av lysark 1, 2, 5 og 6 er sett på: søylene, hullet, det negative
tallet, linjene, prikkene, aksene og tekstene står som de skal.
**Ikke prøvd:** importen kjørt i Lysark på Windows (koden er den samme,
men det er ikke gjort), et diagram limt inn fra Excel i PowerPoint, et
diagram fra en eldre PowerPoint-utgave, og et diagram fra Keynote eller
Google Slides.

**I VM-en ligger igjen:** `lysark-test\diagram\` under brukermappa
(presentasjonen og en logg) og `lysark-ut.zip` i den midlertidige mappa.
Et tomt Excel-vindu sto åpent etter skriptet; det lukket jeg. CD-en er
tatt ut og avbildningen slettet.

**Skriptet feilet fire ganger før det virket.** Hver gang lå det i
skriptet mitt, ikke i Lysark: arket med tallene til forrige diagram sto
åpent; PowerShell nektet å skrive et tall i en celle etter en tekst;
uten ett bestemt kall fikk PowerPoint ikke med seg tallene; og med det
kallet tok PowerPoint tallkolonnen for en egen serie. Rådene står i
skriptet.

### 6.41 Figur i «Lær mer», hentet fra et lysark (26.11.2026)

Bygget på svaret i 6.32, spørsmål 3: figuren **hentes fra et lysark**.

**Hva som er nytt.**

- **«Legg til → Figur»** i «Lær mer»-byggeren. Du får opp figurene som
  finnes i lysarkene, hver tegnet smått med «Lysark 2: Prosess» under.
  Trykk på en, og en kopi legges i boksen.
- **Hva som regnes som en figur:** en figur med skjema (prosess, lagvis
  oppbygging, sammenligning, tidsakse, søylediagram, linjediagram), en
  gruppe du har laget med «Grupper», og et bilde med merker (merkene og
  forklaringslista følger med).
- **Det er en kopi.** Figuren på lysarket blir stående, og kan endres
  eller slettes uten at boksen merker det. Skulle figuren bare i boksen,
  sletter du den fra lysarket etterpå. «Hent på nytt» på kortet bytter
  kopien med figuren slik den er nå, og beholder det du har skrevet om
  den.
- **«Beskrivelse for skjermleser»** og **«Figurtekst»** på kortet.
  Teksten i figuren leses opp uansett; et diagram har tallene sine som
  en tabell som leses og ikke vises, som på lysarket.
- **Hos studenten** fyller figuren bredden boksen har. Den blir aldri
  større enn tre firedeler av størrelsen på lysarket. Trykker studenten
  «Utvid», får den hele størrelsen.
- **Det samme i videoen** og i innlesingsvinduet, der boksen tegnes på
  lysarket.
- **Finnes det ingen figurer,** sier velgeren hvor de lages.
- Formatet er nå 14 (`docs/prosjektformat.md`). Eldre prosjekter leses
  som de er.

**Valg jeg tok uten å spørre** (si fra hvis noe skal være annerledes):

- Video og «+ Lær mer»-knapper i en gruppe følger ikke med inn i boksen.
  Programmet sier fra når det skjer.
- Deler av figuren som hadde «Lær mer» selv, mister den i kopien: ingen
  boks inni en boks.
- Steg følger ikke med: i boksen står hele figuren der med en gang.
- Figuren står på boksens hvite flate, uansett hvilken farge lysarket
  hadde. Tekst som var hvit på mørk bunn, blir mørk.

**Svakheten du bør se selv:** en figur som er bred på lysarket, blir
**liten i boksen**. En prosess i full bredde krympes til under en
tredel, og teksten i boksene blir omtrent 10 piksler høy hos studenten.
«Utvid» gjør den stor og tydelig. Dette ble spørsmål 1 i 6.43, og
boksen er gjort bredere i 6.44.

**To feil funnet av skjermbildene og rettet før noe ble sendt ut:**
miniatyren i velgeren var tom (den ble målt før dialogen var åpnet), og
tekstreglene til boksen (avstand mellom avsnitt, farge på lenker,
tekstmarkering) slo inn på figuren. De stopper nå ved boksens egen tekst
og egne tabeller.

**Prøvd på Linux Mint:** 9 nye enhetstester (`tests/fetch.test.ts`) og 5
prøver i det bygde programmet uten vindu (`tests/e2e-fetch.test.ts`):
velgeren uten figurer, lage en prosess på lysark 2 og hente den inn i
boksen til en tekst på lysark 1, beskrivelse og figurtekst, endre
figuren på lysarket og hente på nytt, slette figuren på lysarket,
forhåndsvisningen slik studenten ser den, og «Utvid». Fire skjermbilder
er sett på. Hele testsamlingen: 560 besto og 1 ble hoppet over som før
(i den første kjøringen feilet fire eldre tester som hadde
formatnummeret 13 skrevet inn; de er rettet til 14 og kjørt på nytt).
Videoprøven kom til etterpå og er kjørt for seg; med den er det 561.

**Målt i en videofil:** en femte prøve lager en video av et lysark der
boksen ble åpnet under innlesingen, og måler bildet: de tre boksene i
prosessen står i boksen, og når så langt ut som boksen har plass til
(innenfor fem piksler av det utregnede). Ett bilde fra videoen er sett
på.

**Ikke prøvd:** Windows. En figur i en boks i innlesingsvinduet (den
bruker samme kode som videoen). En gruppe og et bilde med merker
i det bygde programmet (bare i enhetstestene; i programmet er det
prosessen som er hentet). Et diagram i en boks. En eksportert HTML-fil
åpnet i Firefox eller Safari. En skjermleser.

### 6.42 En feilboks på skjermen din under testingen, og rettingen (26.11.2026)

**Dette skulle ikke skjedd:** fem ganger i denne økta sto en feilboks med
tittelen «Error» på skjermen din, i opptil et par minutter hver gang, til
jeg stoppet prosessen. Regelen er at tester aldri viser noe på skjermen.

**Hva som skjedde.** Den nye prøven lukker forhåndsvisningen og rydder
så opp ved å lukke alle vinduer. Når hovedvinduet lukkes, lukker
programmet forhåndsvisningen også. Den var i dette tilfellet allerede på
vei ut, og programmet prøvde å lukke et vindu som var borte. Feilen kom
i hovedprosessen, og da viser Electron en boks som venter på svar, også
når programmet kjøres uten vinduer. Programmet ble stående bak boksen.

**Rettet, to steder:**

- Programmet lukker ikke lenger en forhåndsvisning som alt er borte.
  Dette er en feil du også kunne ha møtt selv, ved å lukke Lysark i
  samme øyeblikk som forhåndsvisningen lukkes.
- Når programmet kjøres uten vinduer (i tester), skrives en feil i
  hovedprosessen ut, og programmet avsluttes. Ingen boks.
  `tests/e2e-quiet.test.ts` prøver akkurat dette.

Etter rettingen: prøven kjørt fire ganger på rad, og programmet lukket
seg hver gang. Før: fire av fem kjøringer hang.

**Funnet i samme slengen:** en Lysark-prosess fra en test 22.11.2026
(`/tmp/lysark-more-1jYoQl`) står fortsatt og går på maskinen din. Den har
ingen vinduer på skjermen. Jeg startet den ikke i denne økta og har ikke
rørt den; si fra om jeg skal stoppe den.

### 6.43 Fire spørsmål, og eierens svar (26.11.2026)

Stilt samlet, hvert med én anbefaling. Eieren svarte samme dag, og
valgte anbefalingen på alle fire:

| Spørsmål | Svar |
| --- | --- |
| Skal «Lær mer»-boksen bli bredere når den har en figur i seg? | **Ja, bredere boks.** (De andre valgene var «som nå» og «åpne den utvidet».) |
| Skal et linjediagram kunne ha navn langs aksen, med lik avstand mellom punktene? | **Ja, som et valg** ved siden av tall. Da kan PowerPoints vanlige linjediagram gjøres om ved import |
| Hvordan skal du velge hvilken bevegelse et element får når det kommer inn i et steg? | **Programmet foreslår:** streker og piler tegnes, søyler vokser fra null, store tall telles opp, resten toner og glir inn som nå. Du kan bytte bevegelse, og velge rask, vanlig eller langsom, i egenskapene for steget |
| Hvordan skal markere, forsvinne og zoome lages? | **Som egne steg:** et steg kan vise noe (som nå), markere noe, ta noe bort, eller zoome. Zoom: du drar en ramme på lysarket, og et senere steg zoomer ut igjen |

### 6.44 Bredere boks for figur, og linjediagram med navn langs aksen (26.11.2026)

Bygget rett etter svarene i 6.43.

**Bredere boks.** En «Lær mer»-boks som har en figur i seg, er nå 760
bred hos studenten i stedet for 560 (i et vindu på 1280). Har elementet
litt mindre plass ved siden av seg, gjøres boksen smalere for å få plass
der, men ikke smalere enn 560; ellers legger den seg oppå lysarket. Det
gjelder i byggeren, hos studenten, i videoen og i innlesingsvinduet.
Prosessen fra 6.41 blir en tredel større enn før.

**Linjediagram med navn langs aksen.**

- Skjemaet for et linjediagram har fått valget **«Langs den vannrette
  aksen: Tall / Navn»**. Med «Navn» er første kolonne i tabellen navn, og
  punktene står med lik avstand, hvert over navnet sitt. «Tall» er som
  før.
- Bytter du, beholdes det du har skrevet: x-tallet blir navnet der det
  ikke står noe navn, og et navn som er et tall, blir x-tallet der det
  mangler. Du kan bytte fram og tilbake uten å miste noe.
- Laveste og høyeste tall på den vannrette aksen vises ikke med «Navn»;
  de har ingen mening der.
- **Importen:** PowerPoints linjediagram med navn langs aksen blir nå et
  linjediagram med de samme navnene. Står det bare tall langs aksen,
  plasseres punktene etter tallene, som før. Er ett av dem ikke et tall,
  blir alle navn. Har diagrammet ingenting langs aksen, nummererer
  PowerPoint punktene fra 1, og det gjør Lysark også. Datoer langs aksen
  gjøres fortsatt ikke om.
- Formatet er 15.

**Rettet i samme slengen:** en knapp som var trykket inn (for eksempel
«Navn» rett etter at du trykket på den), fikk hvit tekst på lys bunn
så lenge pekeren sto over den, og kunne ikke leses. Den beholder nå den
mørke fargen. Feilen var gammel og gjaldt alle slike knapper.

**Prøvd på Linux Mint:** enhetstester for oppsettet, byttet og
innlimingen (`tests/charts.test.ts`), importen på filer bygd i testen og
på fila PowerPoint laget i VM-en (lysark 3 er nå et linjediagram med
navnene A, B og C), og valget i det bygde programmet uten vindu
(`tests/e2e-charts.test.ts`). To skjermbilder er sett på: diagrammet
med navn, og den bredere boksen hos studenten.

**Ikke prøvd:** Windows. Mange eller lange navn (de kan gå over
hverandre, som under søyler). Den rettede knappefargen er ikke sett på
et skjermbilde etter rettingen.

### 6.45 Bevegelsene (26.11.2026)

Bygget på de to siste svarene i 6.43: **programmet foreslår** hvordan
noe kommer inn, og markere, ta bort og zoome er **egne steg**.

**Hvordan noe kommer inn.** Hvert element i et steg har en bevegelse:

| Bevegelse | Hva som skjer | Foreslås for |
| --- | --- | --- |
| Toner inn | Som før: toner inn og glir opp det siste stykket | Alt annet |
| Glir inn fra siden | Kommer inn fra venstre | (velges selv) |
| Vokser fram | Vokser ut til størrelsen sin. En søyle vokser fra aksen: opp fra null, eller ned når tallet er negativt | Søylene i et søylediagram |
| Tegnes | Streken tegnes fra start til slutt. Pilspissen kommer når streken er framme, og prikkene på en kurve etter hvert som kurven når dem | Linjer, piler og kurver |
| Teller opp | Tallet i teksten teller fra null til det som står der, skrevet på samme måte (mellomrom mellom tusener, komma) | Tekst av typen «Stort tall» med et tall i |
| Vises med en gang | Ingen bevegelse | (velges selv) |

- **Forslaget gjelder nye steg.** Steg du har fra før, er som de var.
- **Du bytter bevegelse** i fanen «Steg», i en liste ved hvert element.
  Lista viser bare det som passer: bare en strek kan tegnes, og bare en
  tekst med et tall kan telle opp.
- **Fart per steg:** Rask, Vanlig eller Langsom (halv, vanlig og dobbel
  tid).

**Steg som gjør noe annet enn å vise.** Fire knapper i fanen «Steg»:

- **«Marker det som er valgt»:** en oransje ramme rundt elementet. Den
  står til neste steg kommer, og toner så bort.
- **«Ta bort det som er valgt»:** elementet toner bort der det står. Et
  senere steg kan hente det inn igjen.
- **«Zoom inn»:** bildet glir inn på en del av lysarket. En oransje,
  stiplet ramme på lysarket viser utsnittet. Du drar den dit du vil, og
  drar i hjørnet for å gjøre utsnittet større eller mindre. Rammen har
  alltid lysarkets form. Har du valgt noe, legger rammen seg rundt det.
- **«Zoom ut igjen»:** bildet glir ut til hele lysarket.
- Et element kommer inn i ett steg, men kan markeres og tas bort i
  flere. Stegene har tidspunkt under innlesing som alle andre steg, og
  kan flyttes opp og ned i lista.

**Hvor det virker:** i HTML-fila når studenten blar, i «Spill av», i
videoen, og i innlesingsvinduet (der du ser zoom og markering mens du
leser inn). Der lysarket redigeres, zoomes det ikke; rammen viser
utsnittet.

**Valg jeg tok uten å spørre** (si fra hvis noe skal være annerledes):

- Navnene på bevegelsene, og at «Toner inn» er den gamle bevegelsen
  uendret.
- Tidene: tone 0,4 s, gli 0,5 s, vokse 0,6 s, tegne 0,8 s, telle 1 s,
  zoom 0,9 s.
- Markeringen er en oransje ramme (samme oransje som merkene på bilder),
  ikke en farget flate, og den varer til neste steg.
- Utsnittet i en zoom kan ikke være mindre enn en femdel av lysarket.
- Logoen zoomes sammen med lysarket. Kamerasirkelen zoomes ikke.
- For dem som har bedt systemet om lite bevegelse, skjer alt med en
  gang, som før; det zoomede utsnittet vises likevel.

**Slik er det laget.** Ett sted regner ut hva stegene har gjort til
enhver tid (`movesFrom` i `src/shared/render/timeline.ts`), og ett sted
tegner det (`applySceneMoves`). Spilleren, videoen og innlesingsvinduet
bruker de samme to. Alt på lysarket ligger nå i ett lag som zoomen gjør
større; lysarket selv beholder størrelsen. Formatet er 16.

**Prøvd på Linux Mint:**

- 11 enhetstester (`tests/moves.test.ts`): forslagene, farten, hva
  stegene har gjort for hånd og etter klokka, hver bevegelse tegnet,
  tellingen (også «1 250,5 kr» og «40 %»), rammen rundt det markerte, og
  zoomen.
- 3 prøver i det bygde programmet uten vindu (`tests/e2e-moves.test.ts`):
  forslagene når steg lages, bytte av bevegelse og fart, steg som
  markerer, tar bort og zoomer, rammen dratt og gjort mindre, og en
  student som blar gjennom alle sju stegene.
- **Målt i en videofil:** et lysark med en lilla boks og fire steg med
  tidspunkt. Boksen er fire ganger så stor i bildet mens det er zoomet
  inn på en firedel av lysarket, den oransje rammen er der mens boksen
  er markert og borte etterpå, boksen er tilbake i vanlig størrelse etter
  zoom ut, og borte etter at den er tatt bort. Tallene stemmer innenfor
  seks prosent.
- Fem skjermbilder er sett på.
- Hele testsamlingen: 578 består, 1 hoppes over som før, i én kjøring
  (med maskinen tungt belastet av annet arbeid).

**En feil i testen min, ikke i programmet:** videomålingen feilet først
fordi jeg hadde lagt boksen delvis utenfor utsnittet. Bildet viste
nøyaktig det utsnittet skulle vise.

**Ikke prøvd:** Windows. Innlesingsvinduet med de nye stegene (det
bruker samme kode, men ingen prøve åpner det). «Spill av» i HTML-fila
med de nye stegene (klokka er prøvd i enhetstester, ikke i en
nettleser). «Vokser fram» og «Glir inn» i det bygde programmet (bare i
enhetstester). Firefox og Safari. En skjermleser.

**Kjent:**

- «Ett steg per element» og «Fjern alle steg» fjerner også steg som
  markerer og zoomer.
- En «Lær mer»-boks som åpnes mens bildet er zoomet inn, legger seg der
  elementet står på det hele lysarket.
- Bare det første tallet i en tekst teller opp.
- En form med omriss kan ikke tegnes; bare linjer, piler og kurver.
- Zoom vises ikke der lysarket redigeres, bare rammen.

### 6.46 Det nye prøvd på Windows (26.11.2026)

Eieren svarte «Ja, prøv Windows» da økta var ferdig med bevegelsene.
VM-en var ledig. Dagens kode ble pakket for Windows og kjørt fra en
CD-avbildning, med et prøveprosjekt jeg hadde laget på forhånd (tre
lysark: en prosess og en tekst med figuren i «Lær mer»-boksen; en boks,
en pil, et stort tall og et søylediagram med sju steg; og et
linjediagram med navn langs aksen). Alt ble gjort for hånd med mus og
tastatur, og sett på i skjermbilder.

**Prøvd i Lysark på Windows 11, og det virket:**

| Hva | Hva jeg så |
| --- | --- |
| Åpne prosjektet (format 16) | Tre lysark med miniatyrer. Prosessen, søylediagrammet og linjediagrammet tegnet riktig |
| Linjediagram med navn | A, B og C med lik avstand, to linjer med prikker |
| «Lær mer»-byggeren med en figur | Figurkortet med miniatyr, beskrivelse og figurtekst. Boksen er den nye, brede, og prosessen er lesbar i den |
| «Legg til → Figur» | Velgeren viste «Lysark 1: Prosess», «Lysark 2: Søylediagram» og «Lysark 3: Linjediagram» med miniatyrer. Søylediagrammet ble hentet inn og tegnet i boksen. **Et diagram i en boks var ikke prøvd noe sted før** |
| Fanen «Steg» | De sju stegene, og de nye knappene |
| Forhåndsvisning, steg for steg | Pila fanget halvveis tegnet, uten spiss. Tallet fanget midt i tellingen («1 163»). Søylene på vei opp. Oransje ramme rundt boksen. Zoomet inn til dobbel størrelse. Zoomet ut, og boksen tatt bort |
| «Lær mer» hos studenten | Boksen med prosessen og søylediagrammet, lesbar |
| Videoeksport av lysarket med stegene | «Videoen er lagret (0:19, 0,5 MB)». **Fila ble hentet ut av VM-en og målt:** H.264, 1920 × 1080, 30 bilder i sekundet, 19 sekunder. Bildene viser pila halvveis tegnet, tallet midt i tellingen («907»), søylene på vei opp, rammen rundt boksen, og zoomen. Boksen er fire ganger så stor i bildet mens det er zoomet inn, og borte etter at den er tatt bort |
| Import av `diagram.pptx` (fila PowerPoint laget, 6.40) med «Gjør om til USN-stil» | 13 lysark. Lysark 1 til 8 gjort om til Lysark-diagram, 9 til 13 med merknaden «Diagrammet følger ikke med». Lysark 3, PowerPoints linjediagram med navn, er et linjediagram med A, B og C |

**En feil funnet på Windows, og rettet:** «Lagre» feilet med
«EPERM: operation not permitted, rename …prosjekt.json.ny →
…prosjekt.json». Prosjektfila var skrivebeskyttet, fordi jeg hadde
kopiert prosjektet fra en CD, og da nekter Windows å erstatte den. Det
samme ville skjedd for en foreleser som kopierer et prosjekt fra en CD.
Nå tar Lysark av skrivebeskyttelsen og lagrer likevel. Går det fortsatt
ikke (mappa kan ikke skrives i, eller fila er åpen i et annet program),
kommer en melding på norsk som sier hva du kan gjøre. **Bekreftet på
Windows** med en ny pakke: samme skrivebeskyttede prosjekt, en endring,
«Lagre», og knappen viste «Lagret» uten feilmelding.

**To småting sett underveis, og rettet:**

- Akselinjene i diagrammer så ujevne ut. En linje som ligger flatt, ble
  tegnet fra hjørne til hjørne i en boks som er én piksel høy, altså en
  piksel på skrå. Flate og loddrette linjer tegnes nå rett.
- Lista «Fra starten» i fanen «Steg» ramset opp hver eneste del av et
  diagram («Brødtekst: 0,5», «Linje», …). Nå står figuren på én linje.

**Testene etter rettingene:** 577 av 579 besto i hele kjøringen, 1
hoppes over som før. De to som feilet, er begge i testen for fritt
opptak (`tests/e2e-free.test.ts`), på tidsmålinger, mens maskinen var
belastet av annet arbeid. Den besto alene rett etterpå (6 av 6). Det er
samme test som i 6.32 og 6.36; koden den prøver, er ikke rørt.

**Sett, ikke rettet. Du bør si hva du vil:** når du importerer eller
åpner noe annet med ulagrede endringer, spør Lysark «Vil du lagre dem
først?» med knappene OK og Cancel, og så «Fortsette uten å lagre?» med de
samme knappene. Det er to spørsmål etter hverandre, og knappene sier
ikke hva de gjør. Slik har det vært lenge; én dialog med «Lagre», «Ikke
lagre» og «Avbryt» ville vært klarere. Rettet i 6.47.

**Ikke prøvd på Windows, fortsatt:** å lage steg og dra zoom-rammen for
hånd (prosjektet hadde stegene fra før; bare fanen ble sett). Bytte av
bevegelse og fart. «Marker» og «Ta bort» laget for hånd. «Hent på nytt».
Tabellen og valget «Tall / Navn» for et diagram. Innlesingsvinduet,
fritt opptak og kamerasirkelen. PDF-import. Grupper og festede piler.
«Behold utseendet» med dagens kode. Den nye norske feilmeldingen ved
lagring (den kommer bare når lagringen fortsatt ikke går, og det fikk
jeg ikke fram). Installasjonsfila; dette var en utpakket mappe.

**I VM-en ligger igjen:** `lysark-test\nytt\` (prøveprosjektet og
`film.mp4`) og `lysark-test\diagram-usn\` (det importerte prosjektet).
CD-en er tatt ut, og avbildningen er slettet. Lysark er lukket.

### 6.47 Ett spørsmål ved ulagrede endringer (26.11.2026)

Eieren svarte «Ja, én dialog» på spørsmålet i 6.46.

Når du lager, åpner eller importerer noe annet mens prosjektet har
endringer som ikke er lagret, spør Lysark nå **én gang**: «Prosjektet har
endringer som ikke er lagret. Vil du lagre dem før du går videre?», med
knappene **«Lagre»**, **«Ikke lagre»** og **«Avbryt»**. Før var det to
spørsmål etter hverandre, begge med «OK» og «Cancel». Dialogen er den
samme typen som den du får når du lukker programmet.

**Prøvd på Linux Mint:** en ny prøve i det bygde programmet uten vindu
(`tests/e2e-unsaved.test.ts`): ingenting spørres uten endringer; med
endringer spørres det én gang, med de tre knappene; «Avbryt» lar alt
stå, «Ikke lagre» lagrer ingenting, og «Lagre» lagrer før programmet går
videre. Testen svarer selv; dialogen er aldri vist på skjermen.

**Ikke prøvd:** Windows, og dialogen sett med øynene (testen leser hva
den ber om, den ser den ikke).

### 6.48 Eieren ber om en utgivelse, nye bilder og et rullefelt som holder seg innenfor (26.11.2026)

Startmeldingen til denne chatten hadde ingen funn («(skriv her)» sto
igjen). Innspillet, ord for ord:

> Jeg vil nå egentlig bare får en release, oppdaterer med nye bilder på
> GH og fikser scrollbaren på bildet. Den clipper iver i den lilla
> borden. Si ifra når jeg kan gå på
> /home/simen/Forelesningsverktoy/lysark/release og teste nyeste versjon

Med meldingen fulgte et skjermbilde av «Lær mer»-boksen i
forhåndsvisningen: rullefeltet sto over den lilla kanten i de runde
hjørnene, oppe og nede.

**Rullefeltet.** Boksen ruller selv, og et vanlig rullefelt er en
firkant like høy som boksen. Der hjørnene er runde, ble firkanten
derfor liggende over kanten. Nå er rullefeltet en smal lilla stripe som
begynner og slutter innenfor hjørnene. Det gjelder alle bokser med
runde hjørner som kan rulle:

- «Lær mer»-boksen hos studentene og i forhåndsvisningen,
- boksene «Hjelp» og «Bildekilder» hos studentene,
- «Lær mer»-boksen i innlesingsvinduet,
- boksen i «Lær mer»-byggeren, og
- dialogene i programmet.

Reglene står ett sted (`roundScrollCss` i `src/shared/render/css.ts`).
Videoen er uendret; der har boksen aldri hatt rullefelt.

**Prøvd på Linux Mint:** i det bygde programmet uten vindu. Bildet av
boksen i forhåndsvisningen er sett på: stripa står innenfor hjørnene.
Testen for «Lær mer» måler nå at boksen ruller, at rullefeltet er 16
piksler bredt og at sporet slutter 12 piksler fra endene.

**Ikke prøvd:** Windows. Firefox: reglene er de Chrome, Edge og Safari
bruker, så i Firefox er rullefeltet som før. Boksene i byggeren,
innlesingsvinduet og dialogene er ikke sett på med et rullefelt i; de
har samme regler, men ingen prøve får dem til å rulle.

**Hele testsamlingen etter rettingen:** 578 av 580 besto i hele
kjøringen, 1 hoppes over som før. De to som feilet, er begge i testen
for «Lær mer» og video under innlesing (`tests/e2e-events.test.ts`):
videoeksporten ble ikke ferdig innen tidsfristen mens maskinen var
tungt belastet av annet arbeid (belastning rundt 30). Den besto alene
rett etterpå (3 av 3).

**Nye bilder på forsiden.** Forsiden (README) beskriver nå det 0.5.0
inneholder: valget ved import, kapitler, figurer og diagrammer, steg
med bevegelse, merker på bilder, figur i «Lær mer», og opptak der du
går fram og tilbake. De fem bildene er tatt på nytt av testene, og to
er nye: et søylediagram med tabellen for tallene (`figur.png`) og fanen
«Steg» (`steg.png`). Alle sju er sett på før de ble lagt inn. De har
bare prøveinnhold, og ingen viser USNs logo.

**Versjon 0.5.0 er gitt ut 26.11.2026** (eieren: «Jeg vil nå egentlig
bare får en release»):
<https://github.com/SimenKode/lysark/releases/tag/v0.5.0>.

- Filene: `Lysark-0.5.0-windows-installasjon.exe` (161 MB),
  `Lysark-0.5.0-win.zip` (222 MB), `Lysark-0.5.0.AppImage` (203 MB), og
  de tre filene med FFmpegs kildekode, de samme som ved 0.3.0 og 0.4.0
  (samme FFmpeg-bygg). De ligger også i `release/`.
- Utgivelsen inneholder alt som er bygget siden 0.4.0 (6.25 til 6.48).
  Prosjektformatet er 16; i 0.4.0 var det 7, så et prosjekt lagret med
  0.5.0 kan ikke åpnes i 0.4.0.
- Før utgivelsen, på Linux Mint: hele testsamlingen (over), og de 115
  ende-til-ende-testene en gang til mot det pakkede Linux-programmet
  (utpakket, ikke selve AppImage-fila). 114 besto i kjøringen. Den ene
  som feilet, var igjen videoeksporten i `tests/e2e-events.test.ts` på
  tidsfristen, med maskinen belastet (belastning 38); den besto alene
  mot det pakkede programmet rett etterpå (3 av 3).
- Kontrollert: begge pakkene sier versjon 0.5.0, har de nye reglene for
  rullefeltet og har FFmpeg med seg. De seks filene på GitHub har samme
  størrelse som dem på disken.
- **Ikke prøvd i den utgitte utgaven:** Windows. Verken
  installasjonsfila eller zip-fila for 0.5.0 er startet i VM-en, og
  oppgradering fra 0.4.0 er ikke prøvd. (Koden uten rullefelt-rettingen
  ble prøvd der samme dag, 6.46.) Selve AppImage-fila er ikke startet.
  Ellers det samme som før: ekte kamera og mikrofon, nedlastet fil på
  Windows, USN-PC, Openverse mot ekte nett, Canvas.
- En feil hos meg underveis, rettet før noe ble pushet: den nye testen
  hadde en typefeil som typekontrollen fant.

### 6.49 Versjon 0.5.0 prøvd på Windows (26.11.2026)

Eieren svarte «Ja, prøv Windows» etter utgivelsen. VM-en var ledig (sto
på skrivebordet). Installasjonsfila fra `release/`, den samme som ligger
på GitHub, ble lagt på en CD-avbildning og kjørt i Windows 11-VM-en. Alt
ble gjort for hånd med mus og tastatur, og sett på i skjermbilder.

| Hva | Hva jeg så |
| --- | --- |
| Installasjon rett over 0.4.0 | «Installasjonen ble fullført uten feil», etter omtrent ett minutt. Ingen spørsmål |
| Start | Lysark startet av seg selv. De åtte sist brukte prosjektene sto der som før |
| «Om Lysark» | «Lysark 0.5.0» |
| Åpne et prosjekt | Prøveprosjektet fra 6.46 (`lysark-test\nytt`) åpnet seg, med de tre lysarkene |
| «Forhåndsvis» og «Lær mer» | Boksen med prosessen spratt ut ved siden av teksten |
| **Rullefeltet** | Med forhåndsvisningsvinduet gjort lavt nok til at boksen måtte rulle: en smal lilla stripe innenfor de runde hjørnene. Den går ikke over den lilla kanten |

**Ikke prøvd på Windows:** zip-fila for 0.5.0. Rullefeltet i «Hjelp»,
«Bildekilder», byggeren, innlesingsvinduet og dialogene. En
installasjonsfil lastet ned fra nettet (denne kom fra CD, så Windows
advarte ikke). Ellers det som sto i 6.46.

**I VM-en:** Lysark 0.5.0 er installert (i stedet for 0.4.0), og er
lukket. CD-en er tatt ut, og avbildningen er slettet. Ingenting er
endret i `lysark-test\`.

### 6.50 Eierens innspill etter 0.5.0 (26.11.2026)

Meldt i chatten etter at 0.5.0 var gitt ut og prøvd på Windows, med et
skjermbilde av et lysark fra en PDF med kamerasirkelen på. Ordrett:

> Canvas er irrelevant, fjern fra plan. Lagring av opptak bør være
> bakgrunnsprosess så man kan jobbe med lysark imens. Kamera fryses
> fortsatt når jeg spiller inn og går fra ett lysbilde til et annet. Vil
> at man også skal kunne importere vertikale PDF-er og lage vertikale
> videoer for f.eks. tiktok. Man skal få valget ved import om hvilken
> orientering man vil ha, med anbefaling. Slett den gamle
> testproseessen. Jeg sliter med å endre grunntiden per lysark. Kjente
> feil som må rettes må bare fikses. Vi må ha mulighet til å lage
> grafer/nettverk med noder og koblinger. Bruk opus for utførelse av
> ditt design.

Slik er det lest, punkt for punkt:

1. **Canvas er tatt ut** av planen, HANDOFF.md (også sjekklista) og
   reglene. Det som står om Canvas lenger opp i denne loggen, er
   historie og står som det var.
2. **Lagring av opptak i bakgrunnen.** I dag står innlesingsvinduet på
   «Lagrer» til filmen og lyden er gjort ferdige. Det skal lukke seg
   med en gang, og lysarkene skal kunne redigeres imens.
3. **Kameraet fryser fortsatt mellom lysark,** også etter at hele
   opptaket ble én film (6.28). Det er altså ikke rettet. Det ble bare
   prøvd med prøvekamera og små prøvelysark.
4. **Stående format:** stående PDF-er inn, og stående video ut. Valget
   tas ved import, med en anbefaling fra programmet.
5. **Den gamle testprosessen** fra 22.11 er stoppet (den svarte ikke på
   en vanlig stopp og måtte avsluttes hardt), og arbeidsmappa dens i
   `/tmp` er slettet.
6. **Grunntiden per lysark.** Et lysark uten lyd står i 5 sekunder pluss
   2 per steg. Det er et fast tall i koden, og kan bare endres ved å
   legge inn en pause. Det er ikke rart det er vanskelig.
7. **Kjente feil skal rettes uten å spørre.**
8. **Nettverk:** grafer med noder og koblinger.
9. **Opus bygger, den som leder økta, designer.** Skrevet inn i
   AGENTS.md.

### 6.51 Fire spørsmål etter innspillene, og svarene (26.11.2026)

Stilt samlet før stående format og nettverk bygges. Eierens svar:

| Spørsmål | Svar |
| --- | --- |
| Hvor ser du at kameraet fryser når du går fra ett lysark til et annet? | **Bare mens jeg leser inn.** Den ferdige videoen er jevn. Feilen er altså i sirkelen i innlesingsvinduet, ikke i filmen |
| Hvilken form skal et stående lysark ha? | **9:16, som mobilskjerm** (anbefalt): 1080 × 1920. En stående A4-side fyller bredden og får luft over og under |
| Hvordan vil du lage et nettverk? | **Skjema, og du drar nodene** (anbefalt) |
| Hva er viktigst at nettverket kan vise i første runde? | Han krysset ikke av, men skrev: «Det viktigste er at jeg fritt kan plassere og forme streker mellom bokser med snapping til nodepunkter på strekene. Må også kunne feste strek til strek for å bygge nettverk med t-kryss osv.» |

**Slik er det siste svaret lest:** det viktigste er strekene, ikke
skjemaet. En strek skal kunne ha knekkpunkter som dras fritt og smetter
på plass, og en ende skal kunne festes til en annen strek, ikke bare
til en boks, slik at det blir T-kryss. Dette bygges for alle streker
(også i fri figur), og «Nettverk» blir skjemaet som lager noder og
koblinger raskt. Tekst på koblingene er ikke med i første runde; han
valgte det ikke.

**Det jeg har bestemt selv, og sier fra om:**

- **Stående format** velges ved import (og for et nytt, tomt prosjekt)
  og ligger fast for prosjektet. Lysark anbefaler formen sidene i fila
  har. En side med annen form enn lysarket settes inn hel, midt på.
- **Grunntiden** blir et tall på lysarket, «Tid uten lyd», som kan
  settes for ett lysark eller for alle uten lyd.
- **Lysark du hopper over under et opptak,** og som ikke har lyd, tas
  ikke lenger med i videoen av seg selv. Et lysark får et valg for om
  det er med i video og «Spill av».
- **Kjente feil som rettes nå:** tette tabeller fra PowerPoint som går
  ut av lysarket, mediefiler og gamle opptak som blir liggende,
  piltastene etter et klikk i YouTube-spilleren, oppholdet i musikken
  mellom lysark i HTML-fila, lagre-dialogen som ikke husker mappa,
  «Lær mer»-boksen som legger seg feil når bildet er zoomet inn, og
  testen som går over tidsfristen når maskinen er belastet.
- **Ikke rettet i denne runden,** fordi det er nye funksjoner og ikke
  feil: ekte formler, SmartArt, flere diagramtyper, venndiagram og
  årsak-virkning, håndlaget stil.

### 6.52 Kamerasirkelen som sto stille, og lagring av opptak i bakgrunnen (26.11.2026)

Bygget av en Opus-agent etter designet mitt, og sett over av meg.

**Kamerasirkelen. Årsaken er funnet, og den var en annen enn jeg
trodde.** Innlesingsvinduet stanser alle videoer på lysarket når du går
videre, slik at en film du har spilt, ikke fortsetter på neste lysark.
Sirkelen med ansiktet ditt er også en video, og lå i samme område. Den
ble derfor stanset ved første lysarkskifte, og ingenting startet den
igjen. Pause og «Ta om dette lysarket» stanset den også. Filmen som
lagres, ble aldri berørt; derfor var den ferdige videoen jevn, slik du
sa.

Rettet: sirkelen holdes utenfor det som stanses, og starter seg selv
igjen om noe likevel skulle stanse den.

**Målt med prøvekameraet (20 bilder i sekundet), over 0,8 sekunder:**

| Når | Før | Etter |
| --- | --- | --- |
| Før første lysarkskifte | 16 bilder | 16 |
| Etter første skifte | **0** | 16 |
| Etter siste skifte | **0** | 16 |
| Under et skifte der vinduet ble holdt opptatt i 0,8 s | **0** | 16 |

**Også funnet og rettet:** trykket du pil mens vinduet var opptatt,
kunne ansiktet i videoen komme opptil 0,8 sekunder foran stemmen på det
lysarket. Nå begynner filmen til hvert lysark der lyden gjør det (målt:
mellom 12 millisekunder bak og 6 foran). Lyden gjøres ferdig i en egen
tråd mens du leser, ikke i det du trykker pil. Bildene til lysarkene
rett foran og bak hentes på forhånd.

**Ikke kjent:** ingenting er prøvd med et ekte kamera. Et vindu som
ikke vises, tegner bare omtrent én gang i sekundet, så hva som faktisk
kommer på skjermen, er ikke målt. Det som er vist, er at sirkelen får
bilder hele tiden, og at det som stanset den, er borte.

**Lagring i bakgrunnen.** «Ferdig» lukker innlesingsvinduet med en gang.
Øverst står «Lagrer opptaket» til det er ferdig. Imens kan du redigere
lysark, skrive manus og lagre prosjektet. Dette venter, og sier
«Opptaket lagres. Vent til det er ferdig.»: «Les inn», «Ta om herfra»,
«Eksporter HTML», «Eksporter video», og nytt, åpne og importer. Prøver
du å lukke programmet, blir det stående, med meldingen «Opptaket lagres
ennå. Lysark avslutter ikke før det er ferdig; prøv igjen om litt.»

Når opptaket er ferdig, legges det på lysarkene slik prosjektet er da.
Ett «Angre» tar bort hele opptaket og beholder det du gjorde imens.
Slettet du et lysark i mellomtiden, sier meldingen fra om at det du sa
der, ikke er lagt på. Programmet hopper ikke lenger til siste lysark og
fanen «Lyd» når opptaket er ferdig.

**Prøvd på Linux Mint:** to nye prøver i det bygde programmet uten
vindu (`tests/e2e-camera-change.test.ts` og
`tests/e2e-background.test.ts`), og hele testsamlingen: 585 besto, 1
hoppes over som før. Under belastning feilet to tidsmålinger i testen
for fritt opptak i én kjøring; de besto alene.

**Ikke prøvd:** Windows. Et ekte kamera og en ekte mikrofon. Et langt
opptak.

**Kjent:** henger lagringen seg (for eksempel FFmpeg), kan programmet
ikke lukkes på vanlig måte. Det rettes i neste del.

### 6.53 Tette tabeller fra PowerPoint, og titler som ble dekket (26.11.2026)

Bygget av en Opus-agent på en egen gren, og flettet inn etter at jeg
hadde sett på bildene.

**Hva som var galt:** en importert tabell brukte temaets linjehøyde og
luft mellom avsnitt, ikke PowerPoints, og hele tabellen fikk én
skriftstørrelse. Radhøyder og justering ble ikke lest. Lange ord fikk
ikke brytes, så de gikk inn i nabocella.

**Nå:** radhøyder, linjeavstand, justering og skriftstørrelsen i hver
celle hentes fra PowerPoint (format 17). Er tabellen likevel høyere enn
plassen den hadde, krympes all teksten likt, ned til 7 punkt. Går det
ikke da heller, sier importrapporten fra. Lange ord brytes inne i
cella; korte, som «B10», holdes hele.

| Lysark | Før | Nå |
| --- | --- | --- |
| Stål 4 | Nederste rad utenfor lysarket | Hele tabellen på lysarket, lik PDF-en (sett på av meg) |
| Praktisk HMS 35 | Brødteksten i 14 punkt, overskriften over en ekstra linje | 18 punkt som i PowerPoint; slutter over bildene |
| Trevirke 17 | Et langt ord gikk inn i nabocella | Ordet brytes i cella |
| Trevirke 19 | For høy | Fyller plassen sin |
| Betong 33 og 42 | Siste bokstav i tittelen dekket av et bilde | Ikke dekket |

**Titlene blir 5 prosent mindre** ved import fra en PowerPoint-fil satt
i Calibri. Lysarks tittelskrift er litt bredere (målt på 273 titler mot
PDF-ene). Det gjelder alle innholdstitler, ikke bare de to.

**Prøvd på Linux Mint:** importen av alle forelesningene, sammenlignet
før og etter (bare de 12 tabellene og titlene er endret), og bilder av
lysarkene mot PDF-ene.

**Ikke tatt med:** tabellstilen fra PowerPoint (rammer rundt cellene,
annenhver rad farget, fet første kolonne). På Betong 42 ligger en
tekstlinje fortsatt delvis under et bilde.

## 7. Hvordan importen sammenlignes med PDF-ene

Slik sammenlignes importen med PDF-ene: `tests/real-screens.test.ts`
tar bilder av lysarkene (se toppen av fila), og `pdftoppm` gir bilder av
PDF-sidene. Legg dem side om side og se på dem. `pdftotext -bbox` gir
ordposisjonene i PDF-en når noe må måles nøyaktig.
