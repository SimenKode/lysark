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
2. **Rette opp** lysarkene: flytte, skrive, legge inn steg, og endre
   tykkelsen på piler og streker.
3. **Legge til «Lær mer»** på hva som helst, med tekst, bilder (også fra
   Wikimedia Commons), video, tabeller og nettsider.
4. **Lese inn stemmen** mens manuset står på skjermen. Pil høyre går til
   neste steg eller neste lysark.
5. **Rette på lyden:** klippe, legge inn pauser, flytte steg, ta om.
6. **Eksportere:**
   - HTML-fil, med «Spill av» når du har lest inn stemmen
   - video (MP4) med teksting
   - GIF av ett eller noen få lysark, for korte klipp uten lyd

## Det du bestemte sist (22.11.2026)

| Du sa | Gjort? |
| --- | --- |
| Følg anbefalingene i de seks spørsmålene | Navnene er byttet (se under). Resten står under «Neste steg» |
| PDF skal kunne være inndata | Ja: «Importer PDF …» på startskjermen og i Fil-menyen |
| Eksport til GIF for småvideoer | Ja: «Eksporter video», velg «GIF» og hvilke lysark |
| Programmet er for forelesere | Skrevet inn i reglene, README og startskjermen |
| HANDOFF skal være kort og lettlest | Denne fila. Loggen er flyttet til `docs/historikk.md` |

Navn som er byttet: «Utdyping» heter **«Lær mer»**, «Byggestein» heter
**«Innhold»**, «Innbygging» heter **«Nettside»**, «Tilpass til rutenett»
heter **«Rydd opp lysarket»**, og «Pakk prosjektet til én fil» heter
**«Lagre som én fil»**.

## Det jeg trenger fra deg

1. **Prøv å lese inn med din egen mikrofon.** Det er det viktigste som
   ikke er prøvd. Les inn tre–fire lysark, klipp bort et feilsnakk, lag
   video og hør på den.
2. **Prøv i Canvas** (bare du, ingen KI). Sjekklista står nederst.
3. **Si hva som skurrer.** Du ville komme med innspill til produktet er
   fornuftig; skriv dem i startmeldingen nederst.
4. **Repoet:** første utgave med både HTML og video finnes nå. Om det
   skal bli offentlig, er din avgjørelse. Tre ting bør du ta stilling
   til først (detaljer i historikken, 6.12): unntaket som holder dine
   eksporterte forelesninger utenfor GPL, om USN er komfortabel med at
   profilen er bygd inn, og hvem som eier koden.

## Neste steg, i rekkefølge

1. **Mer liv og lekenhet** (anbefalingen du valgte): myk overgang mellom
   lysark, elementer som glir inn per steg, knapper og «+»-merker som
   svarer når man peker, panel som glir inn. Ro i selve faginnholdet.
2. **USNs avslutningsanimasjon** som et eget avslutningslysark som
   spiller av seg selv, uten knapper og uten lyd.
3. **Det du melder** etter å ha prøvd mikrofon og Canvas.
4. **Flere bildekilder** (Openverse først), når resten sitter.
5. **Figurer og bevegelser** (leveranse 4), deretter håndlaget stil
   (leveranse 5).

## Hva som er prøvd

| Hva | Linux Mint | Windows 11 (VM) |
| --- | --- | --- |
| Automatiske tester | Ja | – |
| Import, redigering, «Lær mer», HTML | Ja | Ja, for hånd |
| YouTube som spiller i lysarket | Bare i test, ikke mot ekte nett | Ja, spilte |
| Innlesing | Med prøvemikrofon | Med stille inndata |
| Video (MP4) | Ja, også en ekte forelesning | Ja |
| «Spill av» i HTML-fila | Ja | Ja, i Edge |
| PDF-import | Ja, din Stål-PDF | Nei |
| GIF-eksport | Ja | Nei |
| De nye navnene | Ja | Nei |

**Ikke prøvd noe sted:** en ekte mikrofon, en hel forelesning lest inn i
ett strekk, og Canvas.

## Kjente svakheter

- **Video inne i et lysark blir et stillbilde** i video og GIF. USNs
  logoanimasjon blir derfor et hvitt bilde (rettes med neste steg 2).
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
| Programmet, ferdig pakket | `release/Lysark-0.1.0.AppImage` (Linux) og `release/Lysark-0.1.0-win.zip` (Windows) |
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
HTML), 2 («Lær mer») og 3 (lyd, video, GIF, PDF) er bygget.

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

Det jeg fant da jeg prøvde selv (mikrofon, video, Canvas):
(skriv her)

Innspill til produktet:
(skriv her)

Gjør dette:
1. Rett det jeg fant, og ta innspillene mine.
2. Følg ellers «Neste steg» i HANDOFF.md, i den rekkefølgen.

Rapporter ærlig: hva som er prøvd, på hvilket system, og hva som ikke
er prøvd.
```
