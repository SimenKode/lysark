# Lysark: status og veien videre

Sist oppdatert 26.11.2026. Denne fila er kort med vilje. Alt som er
gjort og prøvd i detalj, står i [docs/historikk.md](docs/historikk.md).

## Hva Lysark er

Et program **for forelesere**. Du tar en forelesning du allerede har, i
PowerPoint eller PDF, og får

- en **interaktiv HTML-fil** studentene åpner i nettleseren, og
- en **video** med stemmen din og teksting,

begge i USNs visuelle profil. Programmet skal kunne brukes av en
foreleser uten opplæring. Det styrer ordvalg og knapper.

## Versjon 0.5.0 er gitt ut (26.11.2026)

Du ba om en utgivelse, nye bilder på GitHub og et rullefelt som ikke
stikker ut over den lilla kanten. Alt tre er gjort (historikken, 6.48).

- **Utgivelsen:** <https://github.com/SimenKode/lysark/releases/tag/v0.5.0>
- **Du kan prøve den nå.** Filene ligger i `release/`:
  `Lysark-0.5.0.AppImage` (Linux), og
  `Lysark-0.5.0-windows-installasjon.exe` og `Lysark-0.5.0-win.zip`
  (Windows).
- **Rullefeltet** i «Lær mer»-boksen er nå en smal lilla stripe som
  holder seg innenfor de runde hjørnene. Det samme gjelder «Hjelp»,
  «Bildekilder», boksen i byggeren og dialogene.
- **Forsiden på GitHub** beskriver det 0.5.0 kan, med sju nye bilder
  (to av dem er nye: et diagram og fanen «Steg»).

**Dette er nytt i 0.5.0, siden 0.4.0:**

- **Valg ved import:** «Behold utseendet» eller «Gjør om til USN-stil»,
  for både PowerPoint og PDF.
- **PDF-import** der tekst, bilder og lenker er egne elementer.
- **Kapitler** fra seksjoner og bokmerker.
- **Figurer:** prosess, lagvis oppbygging, sammenligning, tidsakse,
  søylediagram og linjediagram fra et skjema, og fri figur med piler
  som fester seg til bokser.
- **Diagrammer fra PowerPoint** blir Lysark-diagram med USN-stil.
- **Steg med bevegelse:** ting tegnes, vokser, teller opp eller toner
  inn. Et steg kan også markere, ta bort og zoome.
- **Fritt opptak:** pil venstre, «Velg lysark», og et lysark kan vises
  igjen. Hele opptaket er én film.
- **Merket bilde** og **figur i «Lær mer»**.

Detaljene står i historikken, 6.25 til 6.48.

## Dette kan du gjøre nå

1. **Hente inn** en forelesning: PowerPoint, PDF, eller en HTML-fil du
   har eksportert fra Lysark før. Du velger om lysarkene skal beholde
   utseendet eller gjøres om til USN-stil. Kapitlene følger med.
2. **Rette opp** lysarkene: flytte, skrive, og dele inn i kapitler.
3. **Lage figurer:** fra en mal med skjema, søyle- og linjediagram fra
   en tabell med tall, eller fritt av bokser og piler som henger sammen.
4. **Lage steg med bevegelse:** ting kommer inn, markeres, tas bort,
   eller bildet zoomer inn på et utsnitt.
5. **Legge til «Lær mer»** på hva som helst, med bilder fra Wikimedia
   Commons og Openverse, figurer hentet fra et lysark, og **merker på
   et bilde**.
6. **Lese inn stemmen** og ansiktet ditt i en sirkel. Gå fram og tilbake
   som du vil; opptaket går hele tiden.
7. **Rette på lyden:** klippe, legge inn pauser, flytte steg, ta om.
8. **Legge musikk og lyd under forelesningen** i fanen «Tidslinje».
9. **Avslutte med USNs logoanimasjon.**
10. **Eksportere** HTML-fil, video (MP4) med teksting og kapitler, og
    GIF. Også en video av bare noen få lysark.

## Slik virker det nye opptaket

- **Pil høyre** går videre, **pil venstre** går tilbake, og **«Velg
  lysark»** (L) hopper hvor som helst. Du kan også hoppe mens opptaket
  står på pause.
- **Det du gjør, er det som vises.** Et lysark du kommer tilbake til,
  vises igjen i videoen, slik du forlot det.
- **Vil du ta om et lysark** i stedet for å vise det en gang til, starter
  du opptaket på det lysarket, som før.
- **Studentene blar som før** i HTML-fila, fra lysark til lysark. Bare
  «Spill av» følger opptaket ditt.
- Et «igjen»-lysark kan flyttes og slettes i lista. Innholdet endrer du
  på lysarket selv; da endres det begge steder.

## Slik virker valget ved import

- **Behold utseendet:** lysarkene ser ut som i fila. Tekst og bilder kan
  flyttes og endres; skriften blir Lysarks egen.
- **Gjør om til USN-stil:** for PowerPoint er det importen du kjenner.
  For en PDF settes tekst og bilder på USN-stilens flate; streker,
  former og bakgrunn følger ikke med.
- **En PowerPoint-fil som beholder utseendet,** hentes inn via en PDF av
  den. Lysark ordner det selv: PowerPoint lager den (Windows), eller
  Lysark bruker en PDF med samme navn som ligger ved siden av, eller
  LibreOffice lager den. Meldingen etter importen sier hvilken. Manus og
  kapitler hentes fra PowerPoint-fila. Animasjoner og video i lysarkene
  følger ikke med.
- **Vil du ha det helt likt PowerPoint på Linux:** lagre presentasjonen
  som PDF i PowerPoint, og legg PDF-en ved siden av med samme navn.
  LibreOffice tegner ikke helt som PowerPoint.

## Det jeg trenger fra deg

Du har ikke meldt funn ennå, så lista fra sist står.

**Først: prøv 0.5.0 fra `release/`.** Åpne «Lær mer» på noe med mye
innhold i «Forhåndsvis», og se om rullefeltet er slik du vil ha det.

1. **Prøv bevegelsene.** Lag noen steg på et lysark med en pil, et
   diagram og et stort tall, og se dem i «Forhåndsvis». Prøv «Marker»,
   «Ta bort» og «Zoom inn». Er bevegelsene rolige nok? Er farten
   riktig? Er den oransje rammen rundt det markerte slik du vil ha den?
2. **Prøv figur i «Lær mer».** Lag en figur på et lysark, åpne «Lær mer»
   på noe annet, og velg «Legg til → Figur». Er figuren stor nok i
   boksen nå?
3. **Prøv figurene** på et av dine egne lysark: en prosess, en tidsakse,
   et diagram med tall limt inn fra Excel, og en fri figur.
4. **Importer en av dine egne PowerPoint-filer med diagram**, med «Gjør
   om til USN-stil». Det er prøvd på diagrammer PowerPoint laget i
   VM-en, men ikke på et du har laget selv.
5. **Prøv «Behold utseendet» på Windows** med en av dine egne
   forelesninger. Det er bare prøvd med én liten prøvefil.
6. **Prøv et opptak med ekte kamera**, og gå fram og tilbake underveis.
   Fryser bildet mellom lysark? Følger munn og lyd hverandre? Er det
   riktig at et lysark du bare blar forbi (under et halvt sekund), ikke
   vises?
7. **Prøv PDF-importen på nytt.** Står teksten der den sto?
8. **Det som sto fra før:** installasjonsfila på en USN-PC, vilkårene
   til Openverse (historikken, 6.24), egen mikrofon, musikk, merket
   bilde på dine egne bilder, og Canvas (bare du, ingen KI). Sjekklista
   står nederst.
9. **En gammel testprosess** fra 22.11 står og går på maskinen din
   (historikken, 6.42). Si fra om jeg skal stoppe den.

## Neste steg, i rekkefølge

1. **Det du melder** etter å ha prøvd.
2. **Resten av Windows:** det meste av det nye er prøvd der nå
   (historikken, 6.46). Gjenstår: å lage steg og dra zoom-rammen for
   hånd, innlesing, fritt opptak, PDF-import og grupper.
3. **Håndlaget stil** (leveranse 5). Venter på USNs svar om indigo
   tavle, og på spørsmål til deg før den bygges.
4. **Ny utgivelse** når du ber om det.

## Hva som er prøvd

| Hva | Linux Mint | Windows 11 (VM) |
| --- | --- | --- |
| Automatiske tester (581) | Ja | – |
| **Den pakkede utgaven 0.5.0** | Ja: 115 tester mot det pakkede programmet (utpakket, ikke selve AppImage-fila) | **Nei.** Installasjonsfila og zip-fila for 0.5.0 er ikke startet der |
| Import, redigering, HTML, «Lær mer» | Ja | Ja, for hånd (0.4.0) |
| Innlesing | Med prøvemikrofon | Med stille inndata (0.4.0) |
| Video (MP4), GIF, «Spill av» i HTML | Ja | Ja (0.4.0) |
| Tidslinje og musikk | Ja, også målt i videoen | Ja, for hånd (0.4.0) |
| Kamerasirkelen | Ja, med prøvekamera, også målt i videoen | **Nei.** VM-en har ikke kamera |
| **Fritt opptak, sidemeny, «igjen»-lysark** | Ja, også målt i videoen, og i den pakkede utgaven | **Nei** |
| **Kapitler** | Ja, også i videofila og i spilleren | Bare sett i lysarklista etter import (26.11) |
| **PDF-import med egne elementer** | Ja, også på to av dine egne PDF-er (26 og 94 sider) | **Nei** |
| **Valget av utseende ved import** | Ja: PDF begge veier, PowerPoint via LibreOffice og via PDF ved siden av | **Ja, 26.11:** «Behold utseendet» gjennom PowerPoint, én prøvefil med tre lysark, manus og kapittel. USN-stil og PDF er ikke prøvd der |
| Installasjonsfila | – | Ja, for hånd (0.4.0) |
| Openverse | Ja, der testen svarer for Openverse | Nei |
| Merket bilde | Ja, også målt i videoen | Nei |
| **Fri figur: grupper og festede piler** | Ja, i programmet og i forhåndsvisningen. Ikke målt i videoen | **Nei** |
| **Maler med skjema** (også tidsaksen) | Ja, i programmet og i forhåndsvisningen. Ikke målt i videoen | Bare at «Prosess» settes inn og skjemaet vises (26.11) |
| **Søyle- og linjediagram** | Ja, i programmet og i forhåndsvisningen. Ikke limt inn fra et ekte regneark, ikke målt i videoen | **Nei** |
| **Diagram fra PowerPoint** | Ja, på 13 diagrammer PowerPoint laget i VM-en (tallene kontrollert av en test, og fire av bildene sett på) | **Ja, 26.11:** PowerPoint laget fila der, og Lysark importerte den der. Lysark 3 sett på |
| **Figur i «Lær mer»** | Ja, i programmet, i forhåndsvisningen og målt i en videofil: en prosess. Gruppe og bilde med merker bare i enhetstester | **Ja, 26.11:** byggeren, velgeren, et søylediagram hentet inn, og boksen hos studenten |
| **Linjediagram med navn langs aksen** | Ja, i programmet, og importen på fila fra PowerPoint | **Ja, 26.11:** sett i programmet og etter import. Valget «Tall / Navn» er ikke prøvd der |
| **Bevegelser, og steg som markerer, tar bort og zoomer** | Ja, i programmet, hos studenten, og målt i en videofil. Ikke i innlesingsvinduet, ikke «Spill av» i en nettleser | **Ja, 26.11:** sett steg for steg i forhåndsvisningen, og målt i en videofil laget der. Stegene var laget på forhånd, ikke for hånd der |

**Ikke prøvd noe sted:** et ekte kamera, en ekte mikrofon, et langt
opptak (45 minutter) i ett strekk, selve Openverse-fanen mot det ekte
nettstedet, en installasjonsfil lastet ned fra nettet (da kan Windows
advare), en USN-styrt PC, og Canvas. **Av det som er nytt i 0.5.0, er dette prøvd på Windows:** «Behold
utseendet» gjennom PowerPoint, kapitlene i lysarklista, og det som står
med «Ja, 26.11» i tabellen. Fritt opptak, PDF-import, grupper og
festede piler er ikke prøvd der.

## Kjente svakheter

- **Maler med skjema:** teksten krymper ikke av seg selv når den er for
  lang for boksen. En del kan ikke flyttes eller få egen farge før du
  gjør figuren om til fri figur. På tidsaksen står hendelsene med lik
  avstand, ikke etter hvor lang tid det er mellom dem.
- **Diagrammer:** bare stående søyler og linjer. Linjene er rette
  mellom punktene. Radene kan ikke flyttes i tabellen. Lange navn langs
  aksen kan gå over hverandre.
- **Diagrammer fra PowerPoint** gjøres bare om med «Gjør om til
  USN-stil», og bare stående søyler og linjer. Fargene blir temaets.
  **Et diagram som ikke gjøres om** (liggende og stablede søyler, kake,
  areal, punkter uten linjer, datoer langs aksen) **forsvinner fra
  lysarket** med en merknad; PowerPoint lagrer ikke noe bilde av det.
- **Figur i «Lær mer»:** steg, video og «Lær mer» inni figuren følger
  ikke med. Figuren kan ikke endres i boksen; endre den på lysarket og
  hent på nytt.
- **Bevegelser:** «Ett steg per element» og «Fjern alle steg» fjerner
  også steg som markerer og zoomer. Bare det første tallet i en tekst
  teller opp. Bare linjer, piler og kurver kan tegnes. Zoom vises ikke
  der du redigerer lysarket, bare rammen. En «Lær mer»-boks som åpnes
  mens bildet er zoomet inn, legger seg der elementet står på det hele
  lysarket.
- **Fri figur:** teksten i boksene endrer ikke størrelse når du gjør en
  gruppe større eller mindre. En pil går alltid korteste vei mellom to
  bokser; du velger ikke selv hvor på kanten den fester seg, og den kan
  ikke ha knekk. Grupper og koblingslinjer fra PowerPoint kommer inn som
  løse former. Det finnes ingen hurtigtast for «Grupper».
- **Hopper du framover over lysark** og kommer tilbake til dem senere,
  står de også på sin vanlige plass i videoen, uten lyd (fem sekunder
  hver).
- **Det du sier på et «igjen»-lysark, får ikke teksting** av seg selv.
  Skriv manus på stedet om du vil ha teksting der.
- **Munn og lyd** i videoen er ikke kontrollert med ekte kamera.
- **«Behold utseendet» for PowerPoint på Windows** er prøvd med én liten
  prøvefil, ikke med dine egne forelesninger. En PowerPoint-fil uten
  lysark kan PowerPoint ikke lage PDF av. På Linux
  uten en PDF ved siden av tegner LibreOffice lysarkene, og det blir
  ikke helt likt PowerPoint.
- **USN-stil for en PDF** tar bare med tekst og bilder. Har du
  PowerPoint-fila, gir den en bedre USN-stil.
- **Valget av utseende** kan ikke byttes etter importen; importer på
  nytt.
- **PDF-import:** skriften blir Lysarks egen, så linjer kan stå litt
  annerledes enn i PDF-en, og teksten er litt mindre. Formler og tekst
  på farget bunn i farger Lysark ikke har, blir bilder. Tabeller blir
  ikke tabeller. En lenke som ikke lå på tekst, følger ikke med
  (importen sier fra). En skannet side er fortsatt ett bilde. 94 sider
  tar omtrent ett minutt å importere.
- **Rullefeltet** som holder seg innenfor hjørnene, virker i Chrome,
  Edge og Safari. I Firefox er rullefeltet som før. Ikke sett på
  Windows.
- **Kamerasirkelen er ikke i HTML-fila** (ditt valg; kan bygges senere).
- **Windows kan advare** første gang en nedlastet installasjonsfil
  kjøres, fordi programmet ikke er signert.
- **En video på et lysark står stille i videofila** hvis du ikke
  spilte den under innlesingen. En YouTube-video står alltid stille der.
- **Musikk i HTML-fila** kan få et bitte lite opphold når «Spill av»
  går til neste lysark. I videoen er den sammenhengende.
- **Tekstingen er beregnet** ut fra manusets lengde, ikke lyttet fram.
- **Tabeller, formler, SmartArt og diagrammer** fra PowerPoint kommer
  ikke alltid med slik de var.
- **Opptak du har tatt om, blir liggende** i prosjektmappa, også
  filmene.

Hele lista står i [docs/historikk.md](docs/historikk.md), del 5.

## Hvor ting er

| Hva | Hvor |
| --- | --- |
| Utgivelsen, gitt ut 26.11.2026 da du ba om det | <https://github.com/SimenKode/lysark/releases/tag/v0.5.0> |
| Programmet, ferdig pakket | `release/Lysark-0.5.0-windows-installasjon.exe` og `release/Lysark-0.5.0-win.zip` (Windows), `release/Lysark-0.5.0.AppImage` (Linux) |
| Koden | `~/Forelesningsverktoy/lysark`, offentlig på GitHub (<https://github.com/SimenKode/lysark>) |
| Loggen: alt som er gjort, prøvd og sagt | [docs/historikk.md](docs/historikk.md) |
| Planen | [docs/plan.md](docs/plan.md) |
| Reglene for den som bygger | [AGENTS.md](AGENTS.md) |
| I Windows-VM-en | Lysark er installert (kan avinstalleres fra Innstillinger), og `C:\Users\simen\lysark-test\` ligger der fra før, nå også med mappene `diagram`, `diagram-usn` og `nytt` |
| Prøvefila med diagrammer fra PowerPoint | `eksempler/fra-powerpoint/diagram.pptx` (ikke i git) |

## Sjekkliste for Canvas

1. Last opp HTML-fila under Filer og åpne den. Vises forelesningen?
2. Virker den innebygd i en Canvas-side, og i egen fane?
3. Piltaster, de runde pilene, innholdsoversikten (med kapitlene) og
   fullskjerm.
4. «+»-merkene, «Lær mer»-panelet, «Utvid» og «Bildekilder».
5. YouTube: spiller videoen inne i lysarket?
6. Lenker ut av forelesningen.
7. «Spill av»: følger steg og lysark stemmen din? Vises et lysark igjen
   der du gikk tilbake til det? Åpner boksen seg og spiller videoen der
   du gjorde det? Høres musikken?
8. Hvor stor fil godtar emnet? (Stål er 23 MB.)
9. En forelesning med stor video: følger mappa ved siden av med?
10. Videoen (MP4, med kamerasirkelen og kapitler) og tekstingen (.vtt):
    tar Canvas imot begge? Viser Canvas kapitlene?
11. På mobil, i Canvas-appen.

## Startmelding til neste chat

Lim dette inn i en ny chat i mappa `~/Forelesningsverktoy/lysark`, og
fyll inn de to stedene:

```text
Du fortsetter arbeidet med Lysark, et skrivebordsprogram (Electron) for
forelesere. Det gjør forelesninger i PowerPoint eller PDF om til
interaktiv HTML og video med stemmen min, i USNs visuelle profil.
Prosjektet ligger i ~/Forelesningsverktoy/lysark, har sitt eget git-repo
og ligger offentlig på GitHub (SimenKode/lysark). Versjon 0.5.0 er gitt
ut (26.11.2026), med figurer og diagrammer, steg med bevegelse, fritt
opptak, kapitler, merket bilde, figur i «Lær mer», og valget mellom
«Behold utseendet» og «Gjør om til USN-stil» ved import. Ingenting er
bygget etter den.

Før du gjør noe annet:
1. Les AGENTS.md. Reglene er bindende.
2. Les HANDOFF.md. Den er kort, og sier hva som står for tur.
3. Slå opp i docs/historikk.md og docs/plan.md ved behov.

Rammer:
- Arbeid bare i ~/Forelesningsverktoy/lysark. Ikke les eller endre noe
  utenfor den mappa.
- Snakk med meg på norsk bokmål. Det jeg, andre forelesere og studentene
  leser, er på bokmål; kode, kommentarer og commits på engelsk.
- Commit hvert ferdige, testede trinn, og push main fortløpende. Repoet
  er offentlig, så det som pushes, er offentliggjort. Ikke endre
  synligheten.
- Tester skal aldri vise vindu på skjermen min (LYSARK_HIDDEN=1), aldri
  kontakte nettet og aldri bruke den ekte mikrofonen eller det ekte
  kameraet mitt.
- Canvas prøver jeg selv, for hånd. Ingen KI der.
- Hold HANDOFF.md kort og lettlest for meg. Det som er gjort og prøvd i
  detalj, hører hjemme i docs/historikk.md.

Det jeg har funnet siden sist (versjon 0.5.0 fra release/, rullefeltet
i «Lær mer», bevegelsene, figur i «Lær mer», figurene
og diagrammene, en PowerPoint-fil med diagram, opptak med ekte kamera,
fram og tilbake under opptak, import med «Behold utseendet» og
«USN-stil», særlig PowerPoint på Windows, kapitler, mikrofon, musikk,
installasjonsfila på USN-PC, Openverse, merket bilde, Canvas):
(skriv her)

Innspill til produktet:
(skriv her)

Gjør dette:
1. Skriv det jeg har funnet og innspillene mine inn i
   docs/historikk.md.
2. Rett det jeg har meldt, og ta innspillene mine. Still spørsmål
   samlet, med én anbefaling hver, før du bygger noe som trenger det.
3. Følg ellers «Neste steg» i HANDOFF.md, i den rekkefølgen.

Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som ikke
er prøvd.
```
