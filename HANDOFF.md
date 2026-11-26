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

## Versjon 0.6.0 er gitt ut (26.11.2026)

Du ba om utgivelsen etter at alt du hadde meldt, var bygget.

- **Utgivelsen:** <https://github.com/SimenKode/lysark/releases/tag/v0.6.0>
- **Du kan prøve den nå.** Filene ligger i `release/`:
  `Lysark-0.6.0.AppImage` (Linux), og
  `Lysark-0.6.0-windows-installasjon.exe` og `Lysark-0.6.0-win.zip`
  (Windows).
- **Forsiden på GitHub** beskriver det 0.6.0 kan, med ni nye bilder (to
  av dem er nye: valget ved import, og et nettverk).

Versjon 0.5.0, gitt ut tidligere samme dag, hadde figurer og diagrammer,
steg med bevegelse, fritt opptak, kapitler, merket bilde, figur i «Lær
mer» og valget mellom «Behold utseendet» og «Gjør om til USN-stil».

**Dette er nytt i 0.6.0.** Du meldte ni ting etter 0.5.0 og svarte på
fire spørsmål (historikken, 6.50 og 6.51). Alt er bygget av Opus-agenter
etter designet mitt. Detaljene står i historikken, 6.52 til 6.57.

| Du meldte | Slik ble det |
| --- | --- |
| Kameraet fryser når jeg går til neste lysark | **Funnet og rettet.** Innlesingsvinduet stanset alle videoer på lysarket ved hvert skifte, og sirkelen med ansiktet ditt ble stanset sammen med dem. Videoen var aldri berørt |
| Lagring av opptak bør gå i bakgrunnen | «Ferdig» lukker innlesingsvinduet med en gang. Øverst står «Lagrer opptaket», og du kan redigere imens. «Les inn» og eksportene venter til det er ferdig |
| Stående PDF-er og stående video | Importdialogen spør **«Hvilken form skal lysarkene ha?»**: «Liggende (16:9)» eller «Stående (9:16)», med «Anbefalt» på formen sidene har. Videoen blir 1080 × 1920 |
| Jeg sliter med grunntiden per lysark | Feltet **«Tid uten lyd»** i fanen «Lysark» og i fanen «Lyd», og knappen «Bruk på alle lysark uten lyd» |
| Nettverk med noder og koblinger | Ny figur **«Nettverk»** under «Sett inn → Figur». Skjemaet sier hvilke noder og koblinger som finnes; du drar nodene dit du vil |
| Forme streker fritt, og feste strek til strek | Dra i midten av en strek for å bøye den. En ende smetter på plass på boksenes **festepunkter** og på **andre streker** (T-kryss), og følger med når de flyttes |
| Kjente feil må bare fikses | Tette tabeller fra PowerPoint holder seg på lysarket. Musikken i HTML-fila har ikke lenger opphold. Piltastene virker etter YouTube. Lagre-dialogene husker mappa. «Lær mer»-boksen ligger riktig under zoom. **«Fil → Rydd i prosjektmappa»** legger ubrukte filer i papirkurven |
| Canvas er irrelevant | Tatt ut av planen og av denne fila |
| Slett den gamle testprosessen | Stoppet |

**To ting jeg valgte selv. Si fra om de er feil:**

- **Lysark du hopper over under et opptak,** og som ikke har lyd, tas
  ut av videoen. Meldingen etter opptaket sier hvilke. Haken «Ta med i
  videoen og i «Spill av»» i fanen «Lysark» tar dem med igjen.
- **Titler blir 5 prosent mindre** ved import fra en PowerPoint-fil satt
  i Calibri, fordi Lysarks tittelskrift er litt bredere og siste
  bokstav kunne bli dekket av et bilde.

## Dette kan du gjøre nå

1. **Hente inn** en forelesning: PowerPoint, PDF, eller en HTML-fil du
   har eksportert fra Lysark før. Du velger om lysarkene skal beholde
   utseendet eller gjøres om til USN-stil. Kapitlene følger med.
2. **Rette opp** lysarkene: flytte, skrive, og dele inn i kapitler.
3. **Lage figurer:** fra en mal med skjema, søyle- og linjediagram fra
   en tabell med tall, et nettverk av noder og koblinger, eller fritt av
   bokser og streker som henger sammen.
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

Prøv 0.6.0 fra `release/`.

1. **Les inn med kameraet på, og bytt lysark.** Står sirkelen fortsatt
   stille? Det er målt med prøvekamera, ikke med et ekte.
2. **Trykk «Ferdig» etter et opptak,** og rediger et lysark mens det
   står «Lagrer opptaket». Kommer opptaket på plass?
3. **Importer en stående PDF** og lag en kort video. Er 9:16 riktig, og
   ser tittellysarket bra ut stående?
4. **Sett «Tid uten lyd»** på et par lysark, og prøv «Bruk på alle
   lysark uten lyd». Er det lett å finne nå?
5. **Lag et nettverk:** «Sett inn → Figur → Nettverk». Dra nodene, bøy
   en kobling, og dra en ende inn på en annen kobling. Er håndtakene
   lette nok å treffe?
6. **Importer Stål, Trevirke og Praktisk HMS på nytt** og se på
   tabellene (Stål 4, Trevirke 17 og 19, HMS 35).
7. **Det som sto fra før:** bevegelsene, figur i «Lær mer», et diagram
   fra en av dine egne PowerPoint-filer, «Behold utseendet» på Windows
   med en egen forelesning, installasjonsfila på en USN-PC, vilkårene
   til Openverse (historikken, 6.24), egen mikrofon og musikk.

## Neste steg, i rekkefølge

1. **Det du melder** etter å ha prøvd.
2. **Windows:** ingenting av det som er nytt i 0.6.0, er prøvd der,
   heller ikke installasjonsfila. Fra før gjenstår innlesing, fritt
   opptak, PDF-import og grupper.
3. **Ny utgivelse** når du ber om det.
4. **Håndlaget stil** (leveranse 5). Venter på USNs svar om indigo
   tavle, og på spørsmål til deg før den bygges.
5. **Ikke bygget, fordi det er nye funksjoner:** ekte formler, SmartArt,
   flere diagramtyper, venndiagram og årsak-virkning, tekst på
   koblingene i et nettverk, og bytte av form etter import.

## Hva som er prøvd

| Hva | Linux Mint | Windows 11 (VM) |
| --- | --- | --- |
| Automatiske tester (696) | Ja, alle besto 26.11 på 0.6.0 | – |
| **Den pakkede utgaven 0.6.0** | Ja: 157 tester mot det pakkede programmet (utpakket, ikke selve AppImage-fila) | **Nei.** Verken installasjonsfila eller zip-fila for 0.6.0 er startet der. 0.5.0 ble installert og startet der 26.11 |
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
| **Kamerasirkelen under lysarkskifte** (nytt i 0.6.0) | Ja, målt med prøvekamera: sirkelen får bilder hele tiden | **Nei** |
| **Lagring av opptak i bakgrunnen** (nytt i 0.6.0) | Ja, i det bygde programmet uten vindu | **Nei** |
| **«Tid uten lyd», og lysark utenfor videoen** (nytt i 0.6.0) | Ja, også et opptak som hopper over et lysark, og målt lengde på videoen | **Nei** |
| **Stående lysark, 9:16** (nytt i 0.6.0) | Ja: import av en stående PDF, «Forhåndsvis», HTML-fila, og en video målt til 1080 × 1920. Ikke innlesingsvinduet, ikke GIF | **Nei** |
| **Streker med punkter, festepunkter og T-kryss** (nytt i 0.6.0) | Ja, liggende og stående, i programmet og målt i en videofil | **Nei** |
| **Figuren «Nettverk»** (nytt i 0.6.0) | Ja, liggende og stående, i programmet, «Forhåndsvis» og HTML-fila | **Nei** |
| **Tabeller fra PowerPoint** (nytt i 0.6.0) | Ja, på alle forelesningene dine, og bilder mot PDF-ene | **Nei** |
| **«Rydd i prosjektmappa»** (nytt i 0.6.0) | Ja, der testen svarer for papirkurven | **Nei** |

**Ikke prøvd noe sted:** et ekte kamera, en ekte mikrofon, et langt
opptak (45 minutter) i ett strekk, selve Openverse-fanen mot det ekte
nettstedet, en installasjonsfil lastet ned fra nettet (da kan Windows
advare) og en USN-styrt PC. **Av det som kom i 0.5.0, er dette prøvd på Windows:** «Behold
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
  der du redigerer lysarket, bare rammen.
- **Fri figur:** teksten i boksene endrer ikke størrelse når du gjør en
  gruppe større eller mindre. Grupper og koblingslinjer fra PowerPoint
  kommer inn som løse former. Det finnes ingen hurtigtast for «Grupper».
- **Streker og nettverk:** punkter på en strek og festepunkter kan bare
  brukes med mus, ikke med tastatur. Håndtakene midt på en strek er
  bleke, og når to ender ligger tett, kan det være vanskelig å treffe
  den rette. En ende festet oppe eller nede på en boks kan gå tvers
  gjennom boksen når streken fortsetter på den andre siden. Det kan ikke
  stå tekst på en kobling. Endrer du skriftstørrelsen i et nettverk,
  blir ikke nodene som finnes, større.
- **Stående lysark:** formen kan ikke byttes etter importen, og det
  finnes bare liggende 16:9 og stående 9:16. På en mobil som holdes
  stående, står lysarket øverst, og de små pilene havner under det.
- **Lagring av opptak:** «Lagre som én fil» og «Forhåndsvis» venter ikke
  på at et opptak er ferdig lagret.
- **Det du sier på et «igjen»-lysark, får ikke teksting** av seg selv.
  Skriv manus på stedet om du vil ha teksting der.
- **Munn og lyd** i videoen, og sirkelen under lysarkskifte, er ikke
  kontrollert med ekte kamera.
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
  Edge og Safari. I Firefox er rullefeltet som før.
- **Kamerasirkelen er ikke i HTML-fila** (ditt valg; kan bygges senere).
- **Windows kan advare** første gang en nedlastet installasjonsfil
  kjøres, fordi programmet ikke er signert.
- **En video på et lysark står stille i videofila** hvis du ikke
  spilte den under innlesingen. En YouTube-video står alltid stille der.
- **Tekstingen er beregnet** ut fra manusets lengde, ikke lyttet fram.
- **Formler, SmartArt og diagrammer** fra PowerPoint kommer ikke alltid
  med slik de var. Tabellstilen (rammer, annenhver rad farget) følger
  ikke med.
- **Opptak du har tatt om, blir liggende** i prosjektmappa til du
  velger «Fil → Rydd i prosjektmappa».

Hele lista står i [docs/historikk.md](docs/historikk.md), del 5.

## Hvor ting er

| Hva | Hvor |
| --- | --- |
| Utgivelsen, gitt ut 26.11.2026 da du ba om det | <https://github.com/SimenKode/lysark/releases/tag/v0.6.0> |
| Programmet, ferdig pakket | `release/Lysark-0.6.0-windows-installasjon.exe` og `release/Lysark-0.6.0-win.zip` (Windows), `release/Lysark-0.6.0.AppImage` (Linux) |
| Koden | `~/Forelesningsverktoy/lysark`, offentlig på GitHub (<https://github.com/SimenKode/lysark>) |
| Loggen: alt som er gjort, prøvd og sagt | [docs/historikk.md](docs/historikk.md) |
| Planen | [docs/plan.md](docs/plan.md) |
| Reglene for den som bygger | [AGENTS.md](AGENTS.md) |
| I Windows-VM-en | Lysark 0.5.0 er installert (kan avinstalleres fra Innstillinger), og `C:\Users\simen\lysark-test\` ligger der fra før, nå også med mappene `diagram`, `diagram-usn` og `nytt` |
| Prøvefila med diagrammer fra PowerPoint | `eksempler/fra-powerpoint/diagram.pptx` (ikke i git) |

## Startmelding til neste chat

Lim dette inn i en ny chat i mappa `~/Forelesningsverktoy/lysark`, og
fyll inn de to stedene:

```text
Du fortsetter arbeidet med Lysark, et skrivebordsprogram (Electron) for
forelesere. Det gjør forelesninger i PowerPoint eller PDF om til
interaktiv HTML og video med stemmen min, i USNs visuelle profil.
Prosjektet ligger i ~/Forelesningsverktoy/lysark, har sitt eget git-repo
og ligger offentlig på GitHub (SimenKode/lysark). Versjon 0.6.0 er gitt
ut (26.11.2026), med stående lysark 9:16 valgt ved import, figuren
«Nettverk», streker med punkter, festepunkter og T-kryss, lagring av
opptak i bakgrunnen, «Tid uten lyd», lysark som kan stå utenfor videoen,
og «Rydd i prosjektmappa». Ingenting er bygget etter den.

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
- Hold HANDOFF.md kort og lettlest for meg. Det som er gjort og prøvd i
  detalj, hører hjemme i docs/historikk.md.

Det jeg har funnet siden sist (versjon 0.6.0 fra release/,
kamerasirkelen når jeg bytter lysark,
lagring i bakgrunnen, stående PDF og stående video, «Tid uten lyd»,
nettverk og streker, tabellene, rullefeltet i «Lær mer», bevegelsene, figur i «Lær mer», figurene
og diagrammene, en PowerPoint-fil med diagram, opptak med ekte kamera,
fram og tilbake under opptak, import med «Behold utseendet» og
«USN-stil», særlig PowerPoint på Windows, kapitler, mikrofon, musikk,
installasjonsfila på USN-PC, Openverse, merket bilde):
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
