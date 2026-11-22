# Spørsmål før leveranse 1

**Svar 22.11.2026: «Alt som anbefalt».** Alle anbefalingene under er
dermed valgt, og programmet heter Lysark. Leveranse 1 er bygd etter dem.

Disse tilleggsspørsmålene er fortsatt ubesvart, og trengs for å prøve
leveransen ferdig:

- Hvilken læringsplattform bruker du, og hvordan legger du ut filer der
  i dag? (spørsmål 2)
- Har du en Windows 11-maskin å prøve på, og styres den av USN?
  (spørsmål 3)
- To–tre ekte forelesninger i `eksempler/`. Er de bygd på USNs mal og i
  16:9? (spørsmål 4)
- Hvor ligger videoene dine vanligvis: som filer hos deg, eller som
  lenker? (spørsmål 9)
- USNs logopakke i `merkevare/` (spørsmål 14). I programmet velges
  filene under Innstillinger.

Ett valg ble justert under byggingen: rene tittel- og seksjonslysark
(bare tittel og undertittel) får temaets oppsett ved import, med teksten
i de fem venstre kolonnene og profilformene til høyre. PowerPoint
midtstiller slike titler over hele bredden, og da er det ikke plass til
formene. Alle andre lysark beholder plasseringen fra PowerPoint, som
valgt i spørsmål 11.

---

Spørsmålene slik de ble stilt:

## A. Navn og rammer

**1. Hva skal programmet hete?**
Anbefaling: **Lysark**. Det er det norske ordet for det programmet lager,
det er kort, og det er ikke bundet til USN-navnet (som er USNs merke).
Annet forslag: Kullstrek (etter streken i håndlaget stil).

**2. Skal HTML-filene kunne vises andre steder enn i læringsplattformen?**
Anbefaling: **ja, og det koster ingenting ekstra.** Fila er selvstendig
og nøytral, og virker likt fra læringsplattformen, en nettside, Teams, en
minnepinne eller e-post. Det eneste jeg da lar være nå, er koblinger som
bare virker i én plattform (for eksempel sporing av hvem som har sett
hva). Det kan legges til senere som en egen eksport, uten å endre
formatet.
Tilleggsspørsmål: hvilken læringsplattform bruker du, og hvordan legger
du ut filer der i dag? Jeg prøver HTML-fila der før leveransen er ferdig.

**3. Har du en Windows 11-maskin å prøve på, og styres den av USN?**
Anbefaling: **både installasjonsfil og en utgave som kjøres uten
installasjon.** Programmet kan ikke signeres uten et betalt sertifikat,
så Windows viser en advarsel første gang. En USN-styrt maskin kan nekte
installasjon; da er utgaven uten installasjon den som virker.

**4. Kan du legge to–tre ekte forelesninger i mappa `eksempler/`?**
Anbefaling: **ja, velg en enkel, en bildetung og en med SmartArt eller
diagrammer.** Importen må prøves mot ekte filer, ikke mot noe jeg lager
selv. Mappa ligger ikke i git.
Tilleggsspørsmål: er forelesningene bygd på USNs PowerPoint-mal, og er de
i bredformat (16:9)?

## B. HTML-spilleren

**5. Hvordan skal studenten bevege seg gjennom forelesningen?**
Anbefaling: **scene for scene, i bredformat som fyller vinduet**, med
piltaster, mellomrom og klikk, innholdsoversikt og framdriftslinje. Det
er samme form som videoen og som PPTX-en du kommer fra. Alternativet er
én lang rullbar side; den kan komme senere som en lesevisning.

**6. Skal elementer kunne komme inn ett for ett allerede nå?**
Anbefaling: **ja, med enkel inn-toning.** Du bestemmer rekkefølgen i en
liste, og studenten går videre med piltast. Rikere bevegelser og malene
kommer i leveranse 2, men stegene bør være der fra starten, siden
PowerPoint-animasjonene ikke følger med i importen.

**7. Skal studentene kunne lese manuset?**
Anbefaling: **ja, som et panel de selv slår på («Vis manus»), og som du
kan skru av per eksport.** Det gir et tekstalternativ til stemmen og
hjelper universell utforming. Manuset er notatene dine fra PPTX-en, så du
bør kunne velge det bort når notatene ikke er skrevet for studenter.

**8. Hvordan skal en fordypningsboks åpne seg?**
Anbefaling: **en avrundet knapp «Lær mer» i scenen, som åpner et panel
fra høyre.** Scenen står synlig ved siden av, panelet lukkes med Esc, og
det kan inneholde tekst, bilde, lenker og video. Alternativer: en boks
midt på skjermen, eller at teksten folder seg ut inne i scenen.

**9. Hva gjør vi med lokale videofiler når alt skal være én fil?**
Anbefaling: **små videoer bakes inn i HTML-fila; store legges ved siden
av i en mappe med samme navn.** En stor video inne i fila gjør den for
tung til å åpne. Programmet sier tydelig fra ved eksport når det blir en
mappe i tillegg. Videolenker (for eksempel til YouTube eller Panopto)
merkes «krever nett».
Tilleggsspørsmål: hvor ligger videoene dine vanligvis, som filer hos deg
eller som lenker?

**10. Trenger spilleren engelsk i tillegg til bokmål?**
Anbefaling: **bokmål som standard, med engelsk som valg per
forelesning.** Det gjelder bare knappene og hjelpetekstene i spilleren og
koster lite. Si fra hvis du aldri underviser på engelsk, så lar jeg det
være.

## C. Import og uttrykk

**11. Hvor tro skal importen være mot PPTX-en?**
Anbefaling: **plasseringen beholdes, mens skrift og farger byttes til
USN-temaet.** Titler og brødtekst får temaets roller; bilder står som de
står. Hver scene får en knapp «Tilpass til rutenett» som rydder den inn i
de åtte kolonnene. Alternativet, å beholde PowerPoint-fargene og
-skriftene, gir et utkast som ikke følger profilen.

**12. Titler: stor og vanlig, eller tung og fet?**
Anbefaling: **stor tittel i vanlig vekt.** Referansevideoen har tung,
fet tittel, men designmanualen sier at tittelskriften aldri skal settes
i fet. Tyngden lages med størrelse og med lilla flate bak.

**13. Hvilken grunnflate skal innholdsscenene ha?**
Anbefaling: **lys beige med sort tekst og lilla titler; tittel- og
seksjonsscener på lilla flate med to overlappende profilformer.** Lys
beige er roligere for øynene enn hvit, er tillatt som stor flate, og er
samme «papir» som håndlaget stil bruker, så de to stilene henger sammen.
Alternativet er hvit grunnflate.

**14. Logoen: kan du legge USNs logopakke i mappa `merkevare/`?**
Den lastes ned fra designmanualen («Last ned logopakke»). Si fra om du
heller vil at jeg henter den. Mappa ligger ikke i git.
Anbefaling for plassering: **nede til venstre på alle scener, liten, og
mulig å skru av per scene.** Titler står oppe til venstre, så logoen
kolliderer ikke med dem der nede.

## D. Lagring

**15. Skal et prosjekt være en mappe eller én fil?**
Anbefaling: **en mappe, pluss valget «Pakk til én fil» når prosjektet
skal flyttes eller arkiveres.** En mappe tåler store lydopptak og
videoer, lagrer raskt, og går fint sammen med OneDrive og
sikkerhetskopi. Én fil er ryddigere å se på, men må skrives helt på nytt
ved hver lagring.

## Valg jeg har tatt uten å spørre (si fra om du er uenig)

- Scenene er i bredformat, 1920 x 1080.
- HTML-fila bygges for universell utforming (WCAG 2.1 AA).
- Programmet kontakter aldri nettet og oppdaterer seg ikke selv.
- Kode som bygges inn i programmet, har tillatende fri lisens. FFmpeg
  (GPL) brukes som eget program ved siden av.
- Prosjektet har ingen lisens ennå, siden bare du bruker det. Det må
  avgjøres hvis det en gang skal deles.
