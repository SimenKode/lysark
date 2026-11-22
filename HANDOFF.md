# Lysark: status og veien videre

Sist oppdatert 22.11.2026. Denne fila er kort med vilje. Alt som er
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
   neste steg eller neste lysark.
5. **Rette på lyden:** klippe, legge inn pauser, flytte steg, ta om.
6. **Avslutte med USNs logoanimasjon**, som spiller av seg selv.
7. **Eksportere:**
   - HTML-fil, med «Spill av» når du har lest inn stemmen
   - video (MP4) med teksting
   - GIF av ett eller noen få lysark, for korte klipp uten lyd

## Det du bestemte sist (22.11.2026)

| Du sa | Gjort? |
| --- | --- |
| Skiltformen (trekant + rektangel) trengs | Ja: «Form», «Skilt». Importeres også fra PowerPoint |
| «Lær mer» skal være en boks på selve lysarket, animert, ikke skyve alt til siden | Ja, i spilleren og i byggeren |
| Lilla ramme rundt bilder med «Lær mer» | Ja |
| Knapper skal ikke ha «…»; ikon, tekst eller begge der det passer | Ja (se under) |
| Mer liv og lekenhet | Ja: lysark glir inn, steg glir på plass, merker og knapper svarer |
| USNs avslutningsanimasjon som eget lysark | Ja: plukkes opp ved import, spiller av seg selv, også i video |
| Utgivelse | Versjon 0.2.0 (se «Hvor ting er») |
| Flere lydspor (musikk), tidslinje, og «Lær mer» og video under innlesing | **Ikke bygget.** Trenger svar på fire spørsmål, se under |

**Knappene:** bare ikon på det alle kjenner og bruker hele tiden (angre,
gjør om, kopier, flytt, slett). Ikon og tekst på det man leter etter
(importer, lagre, forhåndsvis, eksporter, sett inn, les inn, spill av).
Bare tekst inne i dialoger og på verktøy uten noe naturlig tegn (klipp,
pause, «Ferdig»). Menylinja øverst har fortsatt «…» der et valg åpner en
dialog; det er vanlig skikk i menyer.

## Det jeg trenger fra deg

### Fire spørsmål om det nye du ba om

«Som anbefalt» holder som svar.

1. **«Lær mer» og video under innlesing.** Anbefaling: mens du leser
   inn, kan du trykke «+»-merkene og spille av videoer. Programmet
   husker tidspunktene, slik det gjør med stegene. I videoen spretter
   boksen ut på samme tid, og en videofil spilles i bildet med sin egen
   lyd mens opptaket av stemmen din går videre. HTML-fila gjør det samme
   i «Spill av». En YouTube-video kan ikke bli med i en videofil (vi har
   ikke fila), så den blir et stillbilde i MP4, men spiller i HTML.
2. **Flere lydspor.** Anbefaling: to spor til, «Musikk» og «Lyd», som
   går over hele forelesningen, ikke per lysark. Hvert klipp kan flyttes,
   klippes, tones inn og ut og få egen lydstyrke. Musikken dempes av seg
   selv mens du snakker. Programmet følger ikke med musikk; du legger
   inn egne filer, og kan føre opp kreditering som for bilder.
3. **Tidslinje.** Anbefaling: en egen visning med lysarkene på rad etter
   lengde, og sporene Stemme, Musikk og Lyd under. Den bygges sammen med
   flere lydspor, fordi musikk som går over flere lysark ikke kan
   plasseres uten den.
4. **Rekkefølge.** Anbefaling: først «Lær mer» og video under
   innlesing, så tidslinje og flere lydspor sammen.

### Ellers

1. **Prøv å lese inn med din egen mikrofon.** Det er det viktigste som
   ikke er prøvd.
2. **Prøv i Canvas** (bare du, ingen KI). Sjekklista står nederst.
3. **Si hva som skurrer.** Skriv det i startmeldingen nederst.
4. **Repoet** er fortsatt privat. Om det skal bli offentlig, er din
   avgjørelse. Tre ting bør du ta stilling til først (historikken,
   6.12): unntaket som holder dine eksporterte forelesninger utenfor
   GPL, om USN er komfortabel med at profilen er bygd inn, og hvem som
   eier koden.

## Neste steg, i rekkefølge

1. **«Lær mer» og video under innlesing** (spørsmål 1 over).
2. **Tidslinje og flere lydspor** (spørsmål 2 og 3).
3. **Det du melder** etter å ha prøvd mikrofon og Canvas.
4. **Flere bildekilder** (Openverse først).
5. **Figurer og bevegelser** (leveranse 4), deretter håndlaget stil
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

**Ikke prøvd noe sted:** en ekte mikrofon, en hel forelesning lest inn i
ett strekk, og Canvas. AppImage-fila selv er heller ikke prøvd av meg:
AppImageLauncher på maskinen din tar over oppstarten og spør deg først.
Programmet i fila er prøvd utpakket.

## Kjente svakheter

- **Video inne i et lysark blir et stillbilde** i video og GIF (unntatt
  USNs avslutningsanimasjon, som spilles). Rettes med neste steg 1.
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
| Programmet, ferdig pakket | `release/Lysark-0.2.0.AppImage` (Linux) og `release/Lysark-0.2.0-win.zip` (Windows) |
| Utgivelsen (privat, som repoet) | <https://github.com/SimenKode/lysark/releases/tag/v0.2.0> |
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
7. «Spill av»: følger steg og lysark stemmen din?
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
0.2.0 er gitt ut.

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

Mine svar på de fire spørsmålene i HANDOFF.md:
(skriv her, eller «som anbefalt»)

Det jeg fant da jeg prøvde selv (mikrofon, video, Canvas):
(skriv her)

Innspill til produktet:
(skriv her)

Gjør dette:
1. Skriv svarene mine inn i docs/historikk.md, og bygg det jeg valgte.
2. Rett det jeg fant, og ta innspillene mine.
3. Følg ellers «Neste steg» i HANDOFF.md, i den rekkefølgen.

Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som ikke
er prøvd.
```
