# Lysark: status og veien videre

Sist oppdatert 23.11.2026. Denne fila er kort med vilje. Alt som er
gjort og prøvd i detalj, står i [docs/historikk.md](docs/historikk.md).

## Hva Lysark er

Et program **for forelesere**. Du tar en forelesning du allerede har, i
PowerPoint eller PDF, og får

- en **interaktiv HTML-fil** studentene åpner i nettleseren, og
- en **video** med stemmen din og teksting,

begge i USNs visuelle profil. Programmet skal kunne brukes av en
foreleser uten opplæring. Det styrer ordvalg og knapper.

## Dette kan du gjøre nå

1. **Hente inn** en forelesning: PowerPoint, PDF, eller en HTML-fil du
   har eksportert fra Lysark før.
2. **Rette opp** lysarkene: flytte, skrive, legge inn steg, endre
   tykkelsen på piler og streker, og bruke skiltformen (rektangel med
   spiss) som peker mot noe.
3. **Legge til «Lær mer»** på hva som helst. Studenten trykker «+», og en
   boks spretter ut ved elementet, oppå lysarket. Du bygger boksen mens
   du ser den på lysarket.
4. **Lese inn stemmen** mens manuset står på skjermen. Pil høyre går til
   neste steg eller neste lysark. **Nytt:** mens du leser inn, kan du
   trykke på lysarket. «+» åpner «Lær mer»-boksen, og en video spilles
   når du trykker på den. Det kommer med i videoen og i «Spill av» på
   samme tidspunkt.
5. **Rette på lyden:** klippe, legge inn pauser, flytte steg, ta om.
6. **Legge musikk og lyd under forelesningen (nytt).** Fanen
   «Tidslinje» viser lysarkene på rad etter lengde, med sporene Stemme,
   Musikk og Lyd under. Du legger inn en lydfil, drar den på plass,
   korter den inn, toner den inn og ut, og spiller av hele forelesningen.
   Musikken dempes av seg selv mens du snakker.
7. **Avslutte med USNs logoanimasjon**, som spiller av seg selv.
8. **Eksportere:**
   - HTML-fil, med «Spill av» når du har lest inn stemmen
   - video (MP4) med teksting
   - GIF av ett eller noen få lysark, for korte klipp uten lyd

## Det du bestemte sist (22.–23.11.2026)

Du ba om flere lydspor (musikk, klipping), en tidslinje med lysarkene og
lydsporene, og å kunne åpne «Lær mer» og spille videoer under
innlesingen. Jeg stilte fire spørsmål, og du svarte «som anbefalt».
Alt er bygget:

| Du valgte | Slik ble det |
| --- | --- |
| «Lær mer» og video under innlesing | Trykk på lysarket mens du leser inn. Tidspunktene huskes og vises som små merker i lydsporet, der de kan flyttes og fjernes |
| I videoen | Boksen spretter ut på samme tid, og videoen spilles i bildet med sin egen lyd |
| I HTML-fila | «Spill av» åpner boksen og starter videoen av seg selv |
| To lydspor til: Musikk og Lyd | Går over hele forelesningen. Klipp kan flyttes, kortes inn, deles, tones og få egen styrke |
| Musikken dempes mens du snakker | Ja, til omtrent en fjerdedel. Kan slås av |
| Tidslinje | Egen fane. Du kan også dra i kanten av et lysark for å la det stå lenger |

En YouTube-video kan ikke spilles under innlesing og kan ikke bli med i
en videofil (vi har ikke fila). Den står som stillbilde i MP4 og spiller
som før i HTML.

**En gammel feil ble funnet og rettet underveis:** åpnet du et prosjekt
på nytt, ble ikke opptakene tegnet eller spilt i fanen «Lyd» (bare
opptak fra samme økt virket). Eksporten var ikke berørt.

## Det jeg trenger fra deg

1. **Prøv å lese inn med din egen mikrofon**, og trykk på en «+» og en
   video mens du gjør det. Bruk hodetelefoner når videoen har lyd,
   ellers tar mikrofonen den opp en gang til.
2. **Legg inn et musikkstykke** og hør på videoen. Er musikken passe
   dempet under stemmen din, eller skal den lenger ned eller opp?
3. **Prøv i Canvas** (bare du, ingen KI). Sjekklista står nederst.
4. **Si hva som skurrer.** Skriv det i startmeldingen nederst.
5. **Vil du ha en ny utgivelse?** Det nye ligger ferdig pakket hos deg
   som versjon 0.3.0, men er ikke gitt ut på GitHub.
6. **Repoet** er fortsatt privat. Om det skal bli offentlig, er din
   avgjørelse. Tre ting bør du ta stilling til først (historikken,
   6.12): unntaket som holder dine eksporterte forelesninger utenfor
   GPL, om USN er komfortabel med at profilen er bygd inn, og hvem som
   eier koden.

## Neste steg, i rekkefølge

1. **Det du melder** etter å ha prøvd mikrofon, musikk og Canvas.
2. **Ny utgivelse**, når du ber om den.
3. **Flere bildekilder** (Openverse først).
4. **Figurer og bevegelser** (leveranse 4), deretter håndlaget stil
   (leveranse 5).

## Hva som er prøvd

| Hva | Linux Mint | Windows 11 (VM) |
| --- | --- | --- |
| Automatiske tester | Ja | – |
| Import, redigering, HTML | Ja | Ja, for hånd |
| «Lær mer» som boks på lysarket | Ja | Ja, for hånd |
| Skiltformen, ikonene, de nye navnene | Ja | Ja, for hånd |
| YouTube som spiller i lysarket | Bare i test, ikke mot ekte nett | Ja, spilte |
| Innlesing | Med prøvemikrofon | Med stille inndata |
| Video (MP4) | Ja, også en ekte forelesning | Ja |
| «Spill av» i HTML-fila | Ja | Ja, i Edge |
| USNs avslutningsanimasjon | Ja, med den ekte filmen | Ja, med den ekte filmen |
| GIF-eksport | Ja | Ja |
| PDF-import | Ja, din Stål-PDF | Nei |
| «Lær mer» og video under innlesing | Ja, med prøvemikrofon | WINDOWS_A |
| Tidslinje og musikk | Ja, også målt i videoen | WINDOWS_B |

**Ikke prøvd noe sted:** en ekte mikrofon, en video spilt over ekte
høyttalere under innlesing, en hel forelesning lest inn i ett strekk, og
Canvas. AppImage-fila selv er heller ikke prøvd av meg:
AppImageLauncher på maskinen din tar over oppstarten og spør deg først.
Programmet i fila er prøvd utpakket.

## Kjente svakheter

- **En video på et lysark står stille i videofila** hvis du ikke
  spilte den under innlesingen. En YouTube-video står alltid stille der.
- **Musikk i HTML-fila** kan få et bitte lite opphold når «Spill av»
  går til neste lysark. I videoen er den sammenhengende.
- **Avspillingen i programmet** spiller ikke lyden fra videoer på
  lysarkene; den er med i videofila og i HTML-fila.
- **Tekstingen er beregnet** ut fra manusets lengde, ikke lyttet fram.
  Snakker du fritt, stemmer den dårlig.
- **Tabeller fra PowerPoint** kan bli høyere enn i originalen.
- **Formler, SmartArt og diagrammer** fra PowerPoint følger ikke med som
  redigerbart innhold.
- **PDF-import gir bilder**, ikke tekst du kan redigere.
- **Opptak du har tatt om, blir liggende** i prosjektmappa (omtrent 6 MB
  per minutt).
- **Windows-installasjonsfil mangler**; zip-utgaven pakkes ut og kjøres.

Hele lista står i [docs/historikk.md](docs/historikk.md), del 5.

## Hvor ting er

| Hva | Hvor |
| --- | --- |
| Programmet med det nye, ferdig pakket (ikke gitt ut) | `release/Lysark-0.3.0.AppImage` (Linux) og `release/Lysark-0.3.0-win.zip` (Windows) |
| Forrige utgivelse (privat, som repoet), uten det nye | <https://github.com/SimenKode/lysark/releases/tag/v0.2.0> |
| Koden | `~/Forelesningsverktoy/lysark`, privat på GitHub (`SimenKode/lysark`) |
| Planen for de fem leveransene | [docs/plan.md](docs/plan.md) |
| Loggen: alt som er gjort, prøvd og sagt | [docs/historikk.md](docs/historikk.md) |
| Reglene for den som bygger | [AGENTS.md](AGENTS.md) |
| I Windows-VM-en | `C:\Users\simen\lysark-test\` (kan slettes når du ikke trenger den) |

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
10. Videoen (MP4) og tekstingen (.vtt): tar Canvas imot begge?
11. På mobil, i Canvas-appen.

## Startmelding til neste chat

Lim dette inn i en ny chat i mappa `~/Forelesningsverktoy/lysark`, og
fyll inn de to stedene:

```text
Du fortsetter arbeidet med Lysark, et skrivebordsprogram (Electron) for
forelesere. Det gjør forelesninger i PowerPoint eller PDF om til
interaktiv HTML og video med stemmen min, i USNs visuelle profil.
Prosjektet ligger i ~/Forelesningsverktoy/lysark, har sitt eget git-repo
og ligger privat på GitHub (SimenKode/lysark). Leveranse 1 (PPTX til
HTML), 2 («Lær mer») og 3 (lyd, video, GIF, PDF) er bygget, og versjon
0.2.0 er gitt ut. Etter det er tidslinje, musikk- og lydspor og «Lær
mer» og video under innlesing bygget (pakket som 0.3.0, ikke gitt ut).

Før du gjør noe annet:
1. Les AGENTS.md. Reglene er bindende.
2. Les HANDOFF.md. Den er kort, og sier hva som står for tur.
3. Slå opp i docs/historikk.md og docs/plan.md ved behov.

Rammer:
- Arbeid bare i ~/Forelesningsverktoy/lysark. Ikke les eller endre noe
  utenfor den mappa.
- Snakk med meg på norsk bokmål. Det jeg, andre forelesere og studentene
  leser, er på bokmål; kode, kommentarer og commits på engelsk.
- Commit hvert ferdige, testede trinn, og push main til det private
  repoet fortløpende. Ikke endre synligheten.
- Tester skal aldri vise vindu på skjermen min (LYSARK_HIDDEN=1), aldri
  kontakte nettet og aldri bruke den ekte mikrofonen min.
- Canvas prøver jeg selv, for hånd. Ingen KI der.
- Hold HANDOFF.md kort og lettlest for meg. Det som er gjort og prøvd i
  detalj, hører hjemme i docs/historikk.md.

Det jeg fant da jeg prøvde selv (mikrofon, musikk, video, Canvas):
(skriv her)

Innspill til produktet:
(skriv her)

Ny utgivelse av 0.3.0? (ja/nei)

Gjør dette:
1. Skriv det jeg fant og innspillene mine inn i docs/historikk.md.
2. Rett det jeg fant, og ta innspillene mine.
3. Følg ellers «Neste steg» i HANDOFF.md, i den rekkefølgen.

Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som ikke
er prøvd.
```
