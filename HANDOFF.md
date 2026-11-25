# Lysark: status og veien videre

Sist oppdatert 25.11.2026. Denne fila er kort med vilje. Alt som er
gjort og prøvd i detalj, står i [docs/historikk.md](docs/historikk.md).

## Hva Lysark er

Et program **for forelesere**. Du tar en forelesning du allerede har, i
PowerPoint eller PDF, og får

- en **interaktiv HTML-fil** studentene åpner i nettleseren, og
- en **video** med stemmen din og teksting,

begge i USNs visuelle profil. Programmet skal kunne brukes av en
foreleser uten opplæring. Det styrer ordvalg og knapper.

## Nytt 25.11.2026

Startmeldingen din kom uten funn fra egen utprøving, men du ba om to
ting i chatten. Begge er bygget, og i tillegg neste punkt på lista:

| Du ba om | Slik ble det |
| --- | --- |
| Video av deg selv, i en sirkel som kan flyttes | Kryss av for «Kamera» når du leser inn. Ansiktet vises i en sirkel på lysarket. Dra den dit den ikke dekker noe, også mens du leser; flyttingen huskes med tidspunkt. Etterpå kan du flytte den, endre størrelsen eller skjule den per lysark. Sirkelen er med i **videoen**, ikke i HTML-fila (ditt valg) |
| Smidig installering på Windows | En installasjonsfil: ett dobbeltklikk, ingen spørsmål om administrator, snarvei på skrivebordet, programmet starter selv. Prøvd i Windows-VM-en, også som oppgradering fra 0.3.0 |
| En ren forside på GitHub | README er skrevet om: installasjon øverst, så bruk i fem trinn med bilder. Alt om utvikling er flyttet til `docs/utvikling.md` |
| (Neste på lista) Flere bildekilder | Ny fane «Søk i Openverse» i mediedialogen: bilder fra Flickr, museer og andre samlinger, med samme lisensregler som Commons |

Alt dette er **gitt ut som versjon 0.4.0** (du sa ja 25.11.2026).

Etter utgivelsen er **merket bilde** bygget, det første stykket av
figurer og bevegelser, slik du valgte: velg et bilde, trykk «Legg til
merke», og skriv hva merket peker på. Merkene er enten tall med en
forklaringsliste ved siden av, eller etiketter med strek; du velger per
bilde. Hvert merke kan komme inn i et steg og ha «Lær mer». Dette er
**ikke med i 0.4.0**; det ligger i koden til neste utgivelse.

Kameraet var før uttrykkelig stengt i reglene. Nå står det i AGENTS.md
at det bare brukes i innlesingsvinduet, og bare når du har slått det på.

## Dette kan du gjøre nå

1. **Hente inn** en forelesning: PowerPoint, PDF, eller en HTML-fil du
   har eksportert fra Lysark før.
2. **Rette opp** lysarkene: flytte, skrive, legge inn steg.
3. **Legge til «Lær mer»** på hva som helst, med bilder fra Wikimedia
   Commons og Openverse, og **sette merker på et bilde** (ikke gitt ut
   ennå).
4. **Lese inn stemmen**, og nå også **ansiktet ditt i en sirkel**. Mens
   du leser, kan du åpne «Lær mer», spille videoer og flytte sirkelen.
5. **Rette på lyden:** klippe, legge inn pauser, flytte steg, ta om.
   Filmen av ansiktet klippes sammen med lyden.
6. **Legge musikk og lyd under forelesningen** i fanen «Tidslinje».
7. **Avslutte med USNs logoanimasjon.**
8. **Eksportere** HTML-fil, video (MP4) med teksting, og GIF.

## Det du meldte 25.11.2026 (ikke rettet ennå)

Du prøvde PDF-import og opptak med kamera. Ordene dine står i
historikken (6.26). Ingenting av dette er rettet; det står øverst på
lista for neste chat.

| Du fant | Slik jeg leser det |
| --- | --- |
| PDF: et klikk velger hele siden | Slik er PDF-importen laget i dag: hver side er ett bilde. Tekst og bilder må leses ut hver for seg. Det er nytt arbeid |
| PDF: lenker virker ikke | Lenkene leses ikke ved import |
| PDF: teksten er litt kornete | Siden lagres som et bilde med tap. Blir teksten ekte tekst, forsvinner det |
| Kameraet fryser mellom lysark | Trolig fordi det tas opp én film per lysark, og den nye er treg i starten. Bør bli én sammenhengende film |
| Ingen knapp for å gå tilbake under opptak | Stemmer. Bare «neste» finnes |
| Vil ha en sidemeny som spretter ut, for å velge lysark | Lest som en meny i innlesingsvinduet |
| Kapitlene i PPTX og PDF forsvinner | Stemmer. Importen leser dem ikke, og formatet har ikke plass til dem |

## Det jeg trenger fra deg

1. **Svar på tre spørsmål** når neste chat stiller dem: hva som skal
   skje med opptaket når du går tilbake til et lysark du har lest inn,
   om sidemenyen også skal finnes for studentene, og hvor kapitlene
   skal vises.
2. **Se om munn og lyd følger hverandre** i en video med kamera. Det
   kan jeg ikke måle.
3. **Prøv installasjonsfila på en USN-PC**, og si hva Windows sier.
4. **Openverse har bruksvilkår** (historikken, 6.24). Si fra om du ikke
   vil ha kilden med.
5. **Det som sto fra før:** egen mikrofon, musikk, merket bilde på dine
   egne bilder, og Canvas (bare du, ingen KI). Sjekklista står nederst.

## Neste steg, i rekkefølge

1. **Opptaket:** kameraet skal ikke fryse mellom lysark, en knapp for å
   gå tilbake, og en sidemeny for å velge lysark.
2. **PDF-importen:** tekst og bilder som egne elementer, lenker som
   virker, og skarp tekst.
3. **Kapitler** fra PowerPoint og PDF.
4. **Resten av figurer og bevegelser** (leveranse 4): fri figur, malene,
   diagrammer og bevegelsene. Merket bilde er bygget.
5. **Håndlaget stil** (leveranse 5).

## Hva som er prøvd

| Hva | Linux Mint | Windows 11 (VM) |
| --- | --- | --- |
| Automatiske tester (388) | Ja | – |
| Import, redigering, HTML, «Lær mer» | Ja | Ja, for hånd |
| Innlesing | Med prøvemikrofon | Med stille inndata |
| Video (MP4), GIF, «Spill av» i HTML | Ja | Ja |
| Tidslinje og musikk | Ja, også målt i videoen | Ja, for hånd. Lyden kan ikke høres i VM-en |
| **Kamerasirkelen** | Ja, med prøvekamera, også målt i videoen | **Nei.** VM-en har ikke kamera |
| **Installasjonsfila** | – | Ja, for hånd: installere, starte, avbryte, avinstallere |
| **Openverse** | Ja, der testen svarer for Openverse | Nei |
| **Merket bilde** (ikke gitt ut) | Ja, også målt i videoen | Nei |

**Ikke prøvd noe sted:** et ekte kamera, en ekte mikrofon, selve
Openverse-fanen mot det ekte nettstedet, en installasjonsfil lastet ned
fra nettet (da kan Windows advare), en USN-styrt PC, og Canvas.

## Kjente svakheter

- **Kameraet fryser mellom lysark**, og under opptak kan du ikke gå
  tilbake (meldt av deg 25.11.2026, ikke rettet).
- **PDF-import gir ett bilde per side:** ingenting kan velges for seg,
  lenkene virker ikke, og teksten er litt kornete (meldt av deg).
- **Kapitler** i PowerPoint og PDF følger ikke med (meldt av deg).
- **Munn og lyd** i videoen er ikke kontrollert med ekte kamera.
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
- **Opptak du har tatt om, blir liggende** i prosjektmappa, nå også
  filmene.

Hele lista står i [docs/historikk.md](docs/historikk.md), del 5.

## Hvor ting er

| Hva | Hvor |
| --- | --- |
| Utgivelsen, gitt ut 25.11.2026 da du ba om det | <https://github.com/SimenKode/lysark/releases/tag/v0.4.0> |
| Programmet, ferdig pakket | `release/Lysark-0.4.0-windows-installasjon.exe` og `release/Lysark-0.4.0-win.zip` (Windows), `release/Lysark-0.4.0.AppImage` (Linux) |
| Koden | `~/Forelesningsverktoy/lysark`, offentlig på GitHub (<https://github.com/SimenKode/lysark>) |
| Loggen: alt som er gjort, prøvd og sagt | [docs/historikk.md](docs/historikk.md) |
| Planen | [docs/plan.md](docs/plan.md) |
| Reglene for den som bygger | [AGENTS.md](AGENTS.md) |
| I Windows-VM-en | Lysark er installert (kan avinstalleres fra Innstillinger), og `C:\Users\simen\lysark-test\` ligger der fra før |

## Sjekkliste for Canvas

1. Last opp HTML-fila under Filer og åpne den. Vises forelesningen?
2. Virker den innebygd i en Canvas-side, og i egen fane?
3. Piltaster, de runde pilene, innholdsoversikten og fullskjerm.
4. «+»-merkene, «Lær mer»-panelet, «Utvid» og «Bildekilder».
5. YouTube: spiller videoen inne i lysarket?
6. Lenker ut av forelesningen.
7. «Spill av»: følger steg og lysark stemmen din? Åpner boksen seg og
   spiller videoen der du gjorde det? Høres musikken?
8. Hvor stor fil godtar emnet? (Stål er 23 MB.)
9. En forelesning med stor video: følger mappa ved siden av med?
10. Videoen (MP4, med kamerasirkelen) og tekstingen (.vtt): tar Canvas
    imot begge?
11. På mobil, i Canvas-appen.

## Startmelding til neste chat

Lim dette inn i en ny chat i mappa `~/Forelesningsverktoy/lysark`, og
fyll inn de to stedene:

```text
Du fortsetter arbeidet med Lysark, et skrivebordsprogram (Electron) for
forelesere. Det gjør forelesninger i PowerPoint eller PDF om til
interaktiv HTML og video med stemmen min, i USNs visuelle profil.
Prosjektet ligger i ~/Forelesningsverktoy/lysark, har sitt eget git-repo
og ligger offentlig på GitHub (SimenKode/lysark). Versjon 0.4.0 er gitt
ut (25.11.2026), med kamerasirkelen (ansiktet mitt i videoen), en
installasjonsfil for Windows, søk i Openverse og en ny forside. Etter
det er merket bilde bygget (tall eller etiketter oppå et bilde), det
første stykket av leveranse 4; det er ikke gitt ut.

Jeg har prøvd PDF-import og opptak med kamera og meldt sju ting
(HANDOFF.md, «Det du meldte 25.11.2026», og docs/historikk.md 6.26).
Ingen av dem er rettet. De står først i «Neste steg».

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

Mer jeg har funnet siden sist (kamera, mikrofon, musikk,
installasjonsfila på USN-PC, Openverse, merket bilde, Canvas):
(skriv her)

Innspill til produktet:
(skriv her)

Gjør dette:
1. Skriv det jeg har funnet siden sist, og innspillene mine, inn i
   docs/historikk.md.
2. Still spørsmålene som må avklares før de sju meldte tingene rettes
   (docs/historikk.md 6.26), samlet og med én anbefaling hver.
3. Rett det jeg har meldt, og ta innspillene mine.
4. Følg ellers «Neste steg» i HANDOFF.md, i den rekkefølgen.

Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som ikke
er prøvd.
```
