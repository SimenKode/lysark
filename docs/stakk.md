# Stakk og lisenser

Lisensene under er kontrollert 22.11.2026 mot npm-registeret og
prosjektenes egne lisensfiler. Versjonene er de nyeste den dagen; at de
virker sammen, bekreftes når prosjektet settes opp, og tabellen rettes
hvis en versjon må byttes.

Lysark selv har lisensen GPL-3.0-or-later (valgt 22.11.2026), med et
unntak som holder eksporterte forelesninger utenfor GPL
([EXPORT-EXCEPTION.md](../EXPORT-EXCEPTION.md)). Alle avhengighetene
under har lisenser som er forenlige med den.

Regelen (se [AGENTS.md](../AGENTS.md)): kode som bygges inn i programmet,
har tillatende fri lisens. GPL-programvare brukes bare som eget program
som startes utenfra (FFmpeg).

## Hovedvalgene, med begrunnelse

**Electron** (låst valg). Samme nettlesermotor (Chromium) på Windows og
Linux. Det betyr at redigering, HTML-forhåndsvisning og videobilder
tegnes av nøyaktig samme motor.

**Lysarket tegnes som HTML og SVG, ikke på lerret (canvas).** Tekst blir
ekte tekst: den brytes riktig, kan markeres, leses av skjermleser og
inneholde lenker. Former og diagrammer er SVG, som er skarpe i alle
størrelser. Samme tegnekode brukes tre steder: i redigeringsflaten, i
den eksporterte HTML-fila og i videoeksporten.

**Tegnekoden og spilleren har ingen rammeverk-avhengighet.** De er ren
TypeScript. Da blir HTML-fila liten og uten tredjepartskode som kan
slutte å virke, og tegningen kan være en ren funksjon av (prosjekt, tema,
tid).

**Egen, liten tidslinjemotor i stedet for animasjonsbibliotek.**
Videoeksporten krever at et bilde kan tegnes for et hvilket som helst
tidspunkt uten å spille seg fram dit. Bibliotekene er bygd rundt
veggklokka. Utvalget av bevegelser er dessuten avgrenset (tone inn, gli,
tegne strek, vokse, markere, telle), så en egen motor er lite kode. GSAP
er avvist uansett: gratis, men ikke fri lisens.

**React til redigeringsprogrammet.** Paneler, skjemaer og lister er det
React er godt på. Rammeverket brukes bare i programmet, aldri i den
eksporterte fila.

**Egen PPTX-import.** En PPTX er en zip med XML. Importen pakker ut med
fflate og leser XML med fast-xml-parser. Egen kode gir kontroll over det
som betyr noe her: plassholdere som arver plassering fra mal og layout,
notater, alternativ tekst, lenker, og en rapport over det som ikke kan
importeres (SmartArt, diagrammer, animasjoner). Biblioteket pptxtojson
(MIT) er vurdert; det gir tekst som ferdig HTML i sitt eget format og er
vanskelig å styre mot temaroller. Valget prøves mot eierens ekte filer
tidlig i leveranse 1.

**Video: bilde for bilde, ikke skjermopptak.** Et skjult vindu tegner
lysarket for tidspunkt t, bildet hentes ut som rå piksler og sendes rett
til FFmpeg, så t + 1/30 s, og så videre. Lyden legges på av FFmpeg.
Resultatet er likt hver gang og uavhengig av hvor rask maskinen er.

**FFmpeg som eget program.** Ferdigbygde, statiske FFmpeg-filer for
Windows og Linux hentes av et skript og legges ved programmet. De ligger
ikke i git. Npm-pakken `ffmpeg-static` er avvist fordi den selv er GPL
og ville blitt bygd inn i programmet.

## Avhengigheter

### Inn i programmet

| Pakke | Versjon | Lisens | Brukes til |
| --- | --- | --- | --- |
| electron | 45.4.1 | MIT | Skrivebordsskallet |
| react, react-dom | 19.3.1 | MIT | Redigeringsprogrammets grensesnitt |
| zustand | 5.1.0 | MIT | Programtilstand |
| immer | 11.2.10 | MIT | Uforanderlige endringer, angre og gjør om |
| zod | 4.6.7 | MIT | Kontroll av prosjektfila ved åpning og import |
| fflate | 0.8.3 | MIT | Pakke ut PPTX, pakke prosjekt |
| fast-xml-parser | 5.12.1 | MIT | Lese XML i PPTX |
| prosemirror-model, -state, -view, -commands, -history, -keymap | 1.x | MIT | Redigering av formatert tekst (fet, kursiv, markering, lenker, lister) |

### Leveranse 4 og 5 (tas inn da)

| Pakke | Versjon | Lisens | Brukes til |
| --- | --- | --- | --- |
| roughjs | 4.6.6 | MIT | Håndskisset strek med fast frø, så hvert bilde blir likt |
| perfect-freehand | 1.2.3 | MIT | Strek med varierende tykkelse (kullpreg) |
| d3-scale, d3-shape, d3-array | 4.0.3, 3.2.1, 3.2.5 | ISC | Akser, skalaer og linjer i søyle- og linjediagram |

### Leveranse 3 (tas inn da)

| Program | Lisens | Brukes til |
| --- | --- | --- |
| FFmpeg, statisk bygg fra BtbN/FFmpeg-Builds | GPL (med libx264) | Koding til MP4, lydbehandling. Eget program, ikke bygd inn. GPL-bygget er valgt (22.11.2026): en fast, navngitt utgave, hentet med kontroll av sjekksum og lagt ved programmet med lisenstekst og lenke til kildekoden |
| pdfjs-dist (pdf.js) | Apache-2.0 | Lese PDF som inndata. Bygges inn. Skriftdataene pakken har med seg, kontrolleres før den tas inn |

Lydopptak bruker nettlesermotorens egne funksjoner (mikrofon og
lydbehandling), uten bibliotek.

### Bare under utvikling og bygging

| Pakke | Versjon | Lisens | Brukes til |
| --- | --- | --- | --- |
| typescript | 6.0.3 | Apache-2.0 | Språk og typekontroll |
| vite | 8.3.8 | MIT | Bygging |
| electron-vite | 6.0.0 | MIT | Vite-oppsett for Electron |
| @vitejs/plugin-react | 6.3.0 | MIT | React i Vite |
| electron-builder | 26.18.0 | MIT | Installasjonsfiler for Windows og Linux |
| vitest | 5.1.1 | MIT | Tester |
| happy-dom | 21.0.4 | MIT | Nettleser-etterligning for tester av tegnekoden |
| @playwright/test | 1.65.1 | Apache-2.0 | Tester som starter hele programmet |
| @types/node, @types/react, @types/react-dom | 22.x, 19.x | MIT | Typebeskrivelser |
| prettier | 3.10.1 | MIT | Formatering |

### Skrifter

| Skrift | Versjon | Lisens | Merknad |
| --- | --- | --- | --- |
| Liberation Serif, Liberation Sans | 2.1.5 | SIL OFL 1.1 | Hentet fra den offisielle utgivelsen og lagt ved helt uendret (TTF), med lisensfil. De er verken komprimert om eller klippet ned til færre tegn, så det er ingen tvil om at navnet Liberation kan beholdes. Prisen er at hver HTML-fil blir omtrent 1,6 MB større |

## Vurdert og avvist

| Kandidat | Lisens | Hvorfor ikke |
| --- | --- | --- |
| GSAP | «Standard no charge license» | Gratis, men ikke fri lisens |
| Remotion | Egen lisens | Ikke fri programvare |
| ffmpeg-static | GPL-3.0-or-later | GPL-kode som ville blitt bygd inn |
| anime.js, Motion | MIT | Fri lisens, men bygd rundt veggklokka; egen motor er enklere og eksakt |
| pptxtojson | MIT | Fri lisens; for lite kontroll over plassholdere og roller. Kan revurderes |
| Tiptap | MIT (kjernen) | Har betalte tillegg; ProseMirror, som Tiptap bygger på, er helt fri |
| DOMPurify | MPL-2.0 eller Apache-2.0 | Trengs ikke: tegnekoden bygger aldri innhold fra HTML-tekst, så det er ingenting å rense |
| ESLint | MIT | Utsatt: streng typekontroll og tester dekker behovet nå |
| Clearface, Maison Neue | Kommersiell | Lisensierte skrifter |

## Pakking og installasjon

- Linux: AppImage (én fil som kjøres direkte).
- Windows: en zip som pakkes ut, og der `Lysark.exe` kjøres uten
  installasjon. Den kan lages på Linux. Installasjonsfila
  (`npm run dist:win-installer`) må lages på en Windows-maskin, eller på
  Linux med Wine installert; det er ikke gjort ennå.
- Programmet signeres ikke. Sertifikat for signering koster penger, og
  det er utelukket. Windows vil derfor vise en advarsel første gang.
- Windows-utgaven bygges på Linux. Da kan ikke ikonet skrives inn i
  selve programfila, så den viser Electrons standardikon i Windows
  (snarveien og installasjonsfila får Lysark-ikonet). Bygges programmet
  på en Windows-maskin, blir ikonet riktig overalt.
- Ingen automatisk oppdatering; det ville krevd en server.

## Sikkerhet og personvern

- Programmet samler ingenting.
- **Nett bare når du ber om det** (valgt 22.11.2026, se
  [AGENTS.md](../AGENTS.md)): et søk du sender til Wikimedia Commons,
  nedlasting av bildet du velger, og forhåndsbildet til en YouTube-lenke
  når du trykker «Hent forhåndsbilde». Vertene er
  `commons.wikimedia.org`, `upload.wikimedia.org`, `thumb.wikimedia.org`
  og `i.ytimg.com`.
- **Slik håndheves det** (`src/main/web.ts`, `src/main/commons.ts`):
  - Grensesnittet når ikke nettet i det hele tatt. Alt det ber om over
    http(s), avvises i hovedprosessen.
  - Hovedprosessen bruker én egen økt til nettkallene. Hver forespørsel i
    den økten, også omdirigeringer, sjekkes mot lista; alt annet stoppes
    før det forlater maskinen.
  - Økta lever bare i minnet (ingen informasjonskapsler lagres), og
    oppgir bare «Lysark/versjon» og et fast språk. Søkeordene er det
    eneste som sendes med.
  - Galleribildene vises i grensesnittet gjennom hovedprosessen
    (`lysark-web:`), ikke ved at grensesnittet henter dem selv.
- **Forhåndsvisningen** vises fra en adresse på din egen maskin
  (`http://127.0.0.1:<port>/<hemmelig sti>/`), fordi YouTube nekter å
  spille i en side som er åpnet rett fra disk. Tjeneren svarer bare
  denne maskinen, bare på forespørsler med den hemmelige stien, og bare
  med forhåndsvisningen og mediene i det åpne prosjektet. Vinduet har sin
  egen økt i minnet. Det er det eneste stedet innhold du har bygget inn
  fra nettet, kan hentes, og bare når du trykker på avspillingsknappen.
- Grensesnittet kjører isolert fra filsystemet; all filtilgang går gjennom
  et smalt, navngitt sett med kall.
- Eksportert HTML gjør ingen nettkall av seg selv. Innhold du har lagt
  inn fra nettet (lenker, YouTube, innbygging), hentes først når seeren
  trykker. Fila tillater rammer bare over https, og ingen skript utenfra.
- Testene kontakter aldri nettet. Wikimedia besvares av testen selv.

Leveranse 2 («Lær mer»-byggeren) tok ikke inn noen nye avhengigheter.

## Kjente vanskelige punkter

- **Småbildene fra Wikimedia** leveres fra `thumb.wikimedia.org`. Den
  verten kom på lista 22.11.2026 etter eierens ja. Sporingsparametrene
  Wikimedia legger på bildeadressene, sendes ikke med.
- **YouTube fra disk:** åpnes den eksporterte fila rett fra disk, svarer
  YouTube «Error 153» i rammen. Der åpner avspillingsknappen derfor
  YouTube i nettleseren i stedet. Fra en http(s)-adresse spiller videoen
  i siden (prøvd fra forhåndsvisningen; Canvas er ikke prøvd).

- **EMF- og WMF-bilder** i eldre PPTX-filer kan ikke vises av
  nettlesermotoren. Importen melder dem i rapporten, så de kan byttes ut.
- **Video inne i et lysark ved MP4-eksport** må hentes bilde for bilde.
  Det løses i leveranse 3.
- **Windows-bygg laget på Linux** må prøves på en ekte Windows 11-maskin
  før en leveranse kalles ferdig.
