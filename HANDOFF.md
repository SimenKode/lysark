# Handoff: Lysark etter leveranse 1

Skrevet 22.11.2026 for neste chat. Eieren fyller inn tilbakemeldingene
sine i [del 6](#6-tilbakemeldinger-fra-eieren), og starter så en ny chat
i mappa `~/Forelesningsverktoy/lysark`.

**Til neste økt:** les [AGENTS.md](AGENTS.md) først (reglene er bindende),
så denne fila. Begynn med del 6. Ikke rør noe utenfor denne mappa.

## 1. Hvor ting er

| Hva | Hvor |
| --- | --- |
| Prosjektet | `~/Forelesningsverktoy/lysark/`, eget git-repo, gren `main`, ikke pushet |
| Siste commit | se `git log`; leveranse 1 er `af815cc`, ekte filer og logo `c576ad6` |
| Ferdige programfiler | `release/Lysark-0.1.0.AppImage` (Linux) og `release/Lysark-0.1.0-win.zip` (Windows) |
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
| Automatiske tester på Linux Mint | 129 består. To av dem starter hele programmet uten vindu og går gjennom åpne, redigere, angre, lagre, eksportere og spille av. |
| Det pakkede Linux-programmet | De samme gjennomkjøringene består mot `release/linux-unpacked/lysark`. AppImage-fila selv er ikke startet. |
| Import av de ekte forelesningene | Alle åtte (315 lysark) og malfila importeres uten feil. 30 lysark er sammenlignet side om side med PDF-utgavene; de øvrige 285 er ikke sett på. |
| Windows 11 (eierens VM) | Prøvd for hånd 22.11.2026 med zip-utgaven, se under. |
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
  det. Derfor importeres løpende tekst en tidel mindre.

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
5. **Avstand mellom avsnitt, radhøyder og justering i tabeller** følger
   temaet, ikke PowerPoint.
6. **Mediefiler som ikke lenger brukes**, ryddes ikke ut av
   prosjektmappa.
7. **Siste lysark** (USNs logoanimasjon) får også temaets logo oppå seg.

Mindre:

- Forhåndsvisningsvinduet heter bare forelesningens tittel, ikke
  «Forhåndsvisning».
- Den valgte scenen i scenelista er litt smalere enn de andre.
- Importerte prosjekter får filnavnet som tittel når PowerPoint-fila
  ikke har egen tittel («staal»).
- Edge tilbyr å oversette siden fordi den er merket som norsk.
- Formelbildene har PowerPoints skrift og størrelse, så de ser større ut
  enn teksten ved siden av.

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

- **Lys beige grunnflate** på innholdsscener (malen har hvit).

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

## 7. Det neste økt bør gjøre først

1. Les del 6 og rett det eieren har pekt på.
2. Se gjennom flere lysark side om side med PDF-ene
   (`tests/real-screens.test.ts`), særlig Trevirke og HMS-forelesningene,
   som ikke er sett på.
3. Prøv HTML-fila i Canvas sammen med eieren.
4. Still designspørsmålene for leveranse 2 samlet, med en anbefaling per
   spørsmål, før noe bygges.
