# Handoff: Lysark etter leveranse 1

Skrevet 22.11.2026 for neste chat, og oppdatert samme dag etter økt 2 og
økt 3. Eieren fyller inn tilbakemeldingene sine i
[del 6](#6-tilbakemeldinger-fra-eieren), og starter så en ny chat i mappa
`~/Forelesningsverktoy/lysark`.

**Økt 3 i korte trekk:** feilen i scenelista er rettet, YouTube-saken er
undersøkt og to feil rundt videolenker er rettet (se
[6.11](#611-økt-3-det-som-ble-rettet-og-det-som-venter-på-svar)), og
designspørsmålene for alt som gjenstår, er stilt samlet i
[docs/sporsmal-videre.md](docs/sporsmal-videre.md) med forslag til ny
inndeling av planen. Eieren svarte **«Alt som anbefalt»**, så planen er skrevet om til fem
leveranser og leveranse 2 er startet (se
[6.12](#612-eierens-svar-og-åpen-kildekode-22112026)). Samme dag bestemte
eieren at prosjektet skal bli åpen kildekode på GitHub, med lisensen
GPL-3.0.

**Økt 2 i korte trekk:** del 6 var ikke fylt ut, så ingenting i
uttrykket (6.1) er endret, og leveranse 2 er ikke påbegynt. Økten
sammenlignet i stedet alle 315 lysark med PDF-utgavene og rettet
importen der den bommet (se [del 4](#4-hva-de-ekte-forelesningene-viste)).
Valgene som ble tatt underveis, står i [6.8](#68-valg-tatt-i-økt-2).
Etter økten ga eieren tilbakemelding i chat, med retning for neste økt:
se [6.9](#69-eierens-tilbakemelding-i-chat-etter-økt-2-22112026) («Lær
mer»-byggeren) og [6.10](#610-mer-fra-eieren-samme-dag-figurer-animasjon-og-video)
(figurer, animasjon og video).

**Til neste økt:** les [AGENTS.md](AGENTS.md) først (reglene er bindende),
så denne fila. Begynn med del 6. Ikke rør noe utenfor denne mappa.

## 1. Hvor ting er

| Hva | Hvor |
| --- | --- |
| Prosjektet | `~/Forelesningsverktoy/lysark/`, eget git-repo, gren `main` |
| På GitHub | `SimenKode/lysark`, **privat** til eieren selv gjør det offentlig eller ber om det |
| Lisens | GPL-3.0-or-later ([LICENSE](LICENSE)), med unntak for eksporterte forelesninger ([EXPORT-EXCEPTION.md](EXPORT-EXCEPTION.md)) |
| Commits | se `git log`. Eieren har sagt ja til commits på `main` etter hvert ferdige, testede trinn. Push og publisering krever fortsatt at han ber om det. |
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

Leveranse 1 av 3: PPTX inn, interaktiv HTML ut.

- **Import** av PPTX til en prosjektmappe, med rapport over det som må
  lages på nytt.
- **Tema** «ren»: USNs palett, kontrasttabellen som data, 8 kolonner,
  profilformer på tittelscener, logo hentet uendret fra logopakka.
- **Redigering:** scener, flytte og endre størrelse med feste til
  rutenett, tekst rett i scenen, tabeller, video, «Lær mer»-bokser, steg,
  manus, angre.
- **Eksport** til én HTML-fil uten nettkall, og forhåndsvisning av
  nøyaktig det samme.
- **Spilleren:** piltaster, klikk, sveip, innhold, manus, «Lær mer»-panel,
  hjelp, fullskjerm, utskrift.
- **Lagring** som mappe, pluss pakking til én fil og tilbake.

Ikke påbegynt: leveranse 2 (animasjonsmaler og håndlaget stil) og
leveranse 3 (innspilling og MP4).

## 3. Hva som er prøvd, og hvordan

| Hva | Resultat |
| --- | --- |
| Automatiske tester på Linux Mint | Økt 3: 161 består (157 etter økt 2, 129 etter økt 1). To av dem starter hele programmet uten vindu og går gjennom åpne, redigere, angre, lagre, eksportere og spille av. |
| Det pakkede Linux-programmet | Bygget på nytt i økt 3 (AppImage og Windows-zip, 22.11.2026). De to gjennomkjøringene (14 tester) besto mot `release/linux-unpacked/lysark`. AppImage-fila selv er ikke startet. |
| Rettingene i økt 3, sett på skjermbilder | Programmet ble kjørt uten vindu på Linux Mint med Stål importert: scenelista, lenkekortet med stillbilde og meldingene for video som ikke kan vises. Ikke prøvd på Windows. |
| Import av de ekte forelesningene | Alle åtte (315 lysark) og malfila importeres uten feil. Økt 2: alle 315 er sammenlignet side om side med PDF-utgavene, før og etter rettingene (se del 4). Gjennomgangen ble gjort av hjelpeagenter som så på bildene, og jeg sjekket funnene og de viktigste rettingene selv. |
| Windows 11 (eierens VM) | Prøvd for hånd 22.11.2026 med zip-utgaven (økt 1), se under. Endringene fra økt 2 og økt 3 er ikke prøvd på Windows. |
| Canvas | Ikke prøvd. |

### Windows 11, det som ble prøvd i VM-en

Zip-utgaven ble pakket ut og startet. Alt dette virket:

- programmet starter (første start tok omtrent et halvt minutt), norsk
  meny, riktige skrifter
- import av `PB1020 2025 - 04 - Stål.pptx` gjennom Windows' egne
  fildialoger: 26 lysark og importrapport
- logopakka valgt under Innstillinger: norsk og engelsk logo funnet
- tekst redigert rett i scenen, lagret med Ctrl+S
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
| Logoen dekkes av bilder og bildetekster | Betong 25, 61, 65, 69, 70, 72, 73; HMS 39 | Logoen slås av på scenen, med merknad |
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
   PowerPoint og gå inn i det som står under eller ut av scenen
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
- I «Lær mer» kan en video bare være en fil. En YouTube-lenke kan bare
  legges inn som vanlig lenke (inngår i spørsmålene om byggeren).
- Edge tilbyr å oversette siden fordi den er merket som norsk.
- Formelbildene har PowerPoints skrift og størrelse, så de ser større ut
  enn teksten ved siden av.
- Tittelskriften er litt bredere enn Calibri, så en tittel som går helt
  inntil et bilde, kan få siste bokstav dekket (Betong 33 og 42).

Rettet i økt 3: miniatyrene i scenelista holder seg i boksen sin,
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

- **Lys beige grunnflate** på innholdsscener (malen har hvit). Merk
  (økt 2): mange av bildene dine har hvit bakgrunn, og den syns som hvite
  felt på beige. På hvit grunnflate ville de gått i ett med scenen, slik
  som i PowerPoint.

  Svar:

- **Tittelscenen:** lilla flate, hvit tekst, to profilformer til høyre.

  Svar:

- **Logoen** nede til venstre på alle scener.

  Svar:

- **Tekststørrelsen** (en tidel mindre enn i PowerPoint, for å få samme
  linjeskift).

  Svar:

- **Punktmerker** (små firkanter), tabeller (lilla overskriftsrad),
  «Lær mer»-knappen.

  Svar:

### 6.2 Importen

- Stemmer scenene med PowerPoint der du har sett? Noter lysark som
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

Jeg spurte om læringsplattformen fordi det avgjør om fila virker der
studentene åpner den. Dette må prøves i Canvas, og er ikke gjort:

- Kjører Canvas skriptet i en HTML-fil som er lastet opp under Filer,
  eller viser den bare en tom side eller kildekoden?
- Virker fila når den bygges inn i en Canvas-side, eller bare når den
  åpnes for seg selv?
- Hvor stor fil godtar emnet ditt?
- Virker fullskjerm og lenker ut derfra?

Prøv gjerne selv med `staal.html` fra en eksport, eller si fra i neste
chat at jeg skal gjøre det mens du er innlogget.

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

- **Logoen slås av ved import** på scener der et bilde, en form eller en
  bildetekst ligger der logoen skal stå, i stedet for at innholdet
  dekker halve logoen. Scenen får en merknad, og «Vis USNs logo» slår den
  på igjen. I de åtte forelesningene gjelder det 42 av 315 scener: de 8
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
- **Feil i scenelista:** miniatyren til den valgte scenen stikker ut av
  den lilla boksen (skjermbilde fra eieren, scene 70 i Betong). Trolig
  årsak, ikke undersøkt: miniatyren er fast 192 px bred
  (`THUMB_SCALE = 0.1` i `src/renderer/src/SceneList.tsx`), mens spalten
  er 252 px (`styles.css`, `.workspace`). Etter marger, nummerspalte og
  rullefelt er det for lite plass.
- **Et av tre store ønsker** (de to andre står i 6.10): en rik bygger
  for «Lær mer». Knappen «+ Lær
  mer» beholdes som den enkle veien inn, men læreren skal også kunne
  klikke på et hvilket som helst element i scenen (bilde, overskrift,
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
  strekke ut scener og lignende. Leveranse 3 i planen dekker innspilling
  per scene, klipping av start og slutt, tidspunkt for steg og MP4 bilde
  for bilde. Nytt er ønsket om enkel redigering på en tidslinje
  (klipping inne i lyden, lengden på scenene) og at det skal være dypt
  integrert.
- **Inndata for video:** prosjektfiler, HTML og PPTX eller PDF.
  - Prosjektfiler: finnes.
  - HTML: den eksporterte fila inneholder hele prosjektet
    (`<script type="application/json" id="lysark-data">` og mediene i
    base64), så den kan åpnes igjen. Det er ikke bygget.
  - PPTX: importen finnes.
  - PDF: helt nytt. Sidene må tegnes som bilder per scene. Det krever en
    PDF-leser med fri lisens: pdf.js (Apache-2.0) kan bygges inn, mens
    Poppler (GPL) bare kan brukes som eget program. Tekst fra PDF blir
    bilder, ikke redigerbar tekst, med mindre noe mer avansert bygges.

Dette må avklares før noe bygges:

- **Rekkefølgen:** tre store ønsker konkurrerer om neste plass:
  «Lær mer»-byggeren (6.9), figurer og animasjoner (leveranse 2) og
  dyp videointegrasjon (leveranse 3). Planen må skrives om etter eierens
  svar. Hver leveranse skal fortsatt være ferdig og brukbar alene.
- **Videoredigering:** hvor mye som trengs (klipp, flytt, strekk, pauser,
  musikk?), og om redigeringen skjer per scene eller på én samlet
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

**Scenelista (rettet).** Årsaken var som antatt: miniatyren var fast
192 px bred, men etter marger, nummerspalte og rullefelt var det bare
omtrent 180 px igjen. Feilen gjaldt alle scener, men syntes bare på den
valgte, fordi den har farget bakgrunn. Miniatyrene måler nå plassen de
har, og fyller den (også når rullefeltet kommer og går, og på Windows
der rullefeltet har en annen bredde). I samme slengen: når musa sto over
den valgte scenen, ble bakgrunnen lys med hvit tittel oppå, altså
uleselig. Den valgte scenen beholder nå den lilla fargen. Prøvd med
skjermbilde av programmet uten vindu, og med en ny test som også tvinger
fram rullefeltet.

**YouTube i forhåndsvisningen (undersøkt).** Prøvd uten vindu med Stål
importert, og med en «Lær mer»-boks som hadde en videofil og en
YouTube-lenke:

- En YouTube-lenke blir aldri en spiller. Den blir et kort som åpner
  nettleseren, både i scenen og i panelet. Det er et valg fra
  leveranse 1, ikke en feil, og innbygging står som spørsmål 10 i
  [docs/sporsmal-videre.md](docs/sporsmal-videre.md).
- **Feil, rettet:** kortet viste aldri stillbildet PowerPoint hadde
  lagret for videoen, enda importen tok det med. En importert
  YouTube-video var derfor bare en stor mørk flate. Nå fyller
  stillbildet kortet, med avspillingsmerke, tittel og «Åpnes i
  nettleseren (krever nett)» i et felt under. Bildet er en fil i
  prosjektet; ingenting hentes fra nettet.
- **Feil, rettet:** i «Lær mer»-panelet hadde lenkekortet lilla tekst på
  mørk indigo (uleselig), og var like stort som i en scene. Nå er
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
[AGENTS.md](AGENTS.md). Tre ting der er fortsatt åpne: Canvas-prøven
sammen med eieren, om Windows-VM-en kan få mikrofon, og hvilken fil som
ga den svarte videospilleren.

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

## 7. Det neste økt bør gjøre først

1. Les [docs/plan.md](docs/plan.md), leveranse 2, og se i `git log` hvor
   langt byggingen er kommet. Bygg videre trinn for trinn, med tester, og
   commit hvert ferdige trinn.
2. Prøv HTML-fila i Canvas sammen med eieren tidlig; det avgjør
   YouTube-innbyggingen (spørsmål 10 i
   [docs/sporsmal-videre.md](docs/sporsmal-videre.md)).
3. Minn eieren på de tre punktene i 6.12 før repoet gjøres offentlig.
   Ikke push og ikke endre synligheten uten at han ber om det.
4. Hold [docs/prosjektformat.md](docs/prosjektformat.md) og
   [docs/stakk.md](docs/stakk.md) sanne når formatet og avhengighetene
   endres.
5. Senere: tabeller i importen (del 5, punkt 5) og endringene fra økt 2
   og 3 i Windows-VM-en.

Slik sammenlignes importen med PDF-ene: `tests/real-screens.test.ts`
tar bilder av scenene (se toppen av fila), og `pdftoppm` gir bilder av
PDF-sidene. Legg dem side om side og se på dem. `pdftotext -bbox` gir
ordposisjonene i PDF-en når noe må måles nøyaktig.
