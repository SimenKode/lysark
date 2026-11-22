# Spørsmål før de neste leveransene

**Svar 22.11.2026: «Alt som anbefalt».** Alle anbefalingene under er
dermed valgt. Planen er skrevet om etter dem ([plan.md](plan.md)), og
unntaket for nettilgang (spørsmål 8) står i [AGENTS.md](../AGENTS.md).

Leveranse 2 er bygd etter svarene. To steder ble det litt annerledes
enn anbefalingen, se «Avvik» under leveranse 2 i [plan.md](plan.md):
bilder hentes i høyst 1920 px (ikke 2560), og bare YouTube spilles i to
trinn. Spørsmål 10 er prøvd på ekte: YouTube spiller fra
forhåndsvisningen, og svarer «Error 153» når fila åpnes rett fra disk.

**Endret av eieren 22.11.2026, etter at han hadde prøvd leveranse 2**
(se [HANDOFF.md](../HANDOFF.md) 6.14):

- Spørsmål 8: `thumb.wikimedia.org` er lagt til på lista, og andre kilder
  til bilder i det offentlige domenet er velkomne.
- Spørsmål 10: YouTube skal være **innebygd som spiller i lysarket**,
  ikke et stillbilde med «Spill av fra YouTube». Ikke bygget ennå.
- Spørsmål 3 og 10: Canvas prøver eieren selv, for hånd. Ingen KI der.
- Spørsmål 14: eieren vil ha **flere animasjoner og mer lekenhet** enn
  anbefalingen la opp til.
- Spørsmål 23: mikrofon i Windows-VM-en kan rigges av den som bygger.

Ett spørsmål er fortsatt åpent: hvilken fil eller lenke ga den svarte
videospilleren (spørsmål 24)?

Spørsmålene slik de ble stilt 22.11.2026 (økt 3), etter tilbakemeldingene
i [HANDOFF.md](../HANDOFF.md) 6.9 og 6.10:

---

## A. Rekkefølge og ny inndeling av planen

**1. Hvilken rekkefølge skal de tre områdene ha?**
Anbefaling: **«Lær mer»-byggeren, så video, så figurer og bevegelser.**

- «Lær mer» først: det er det du selv kaller det unike, det bygger rett
  på HTML-eksporten som finnes, og du kan bruke det i undervisningen med
  én gang.
- Video før figurer: 315 lysark er allerede importert og kan bli video
  med stemme uten en eneste ny figur. Dessuten skal bevegelsene i
  figurene gå på den samme tidslinja som lyden. Når tidslinja (tid,
  spillehode, dra fram og tilbake) finnes først, bygges bevegelsene én
  gang, mot noe du kan spille av og høre.
- Figurer til slutt av de tre: størst arbeid, og det henger sammen med
  uttrykket (6.1) som ikke er godkjent ennå.

Forslag til ny plan. Hver leveranse er ferdig og brukbar alene:

| Nr. | Leveranse | Du kan etterpå |
| --- | --- | --- |
| 1 | PPTX-import, tema, redigering, HTML (bygget) | Gjøre en forelesning om til HTML |
| 2 | **«Lær mer»-byggeren** | Knytte rik utdyping til hva som helst i en scene, hente bilder fra Wikimedia Commons med riktig navngivelse, og vise YouTube slik du velger i spørsmål 10 |
| 3 | **Lyd og video** | Lese inn stemme, redigere på tidslinje, eksportere MP4 med teksting, og få HTML-fila til å spille seg selv med stemmen din. Start fra prosjekt, PPTX, eksportert HTML eller PDF |
| 4 | **Figurer og bevegelser** | Bygge statiske og animerte figurer fra maler og fritt, og bruke dem i scener, i «Lær mer» og i video |
| 5 | **Håndlaget stil** | Bytte hele forelesningen til kullstrek-uttrykket med ett valg |

Byggesteinen «animasjon» i «Lær mer»-byggeren kommer med leveranse 4,
når figurene finnes. Den vises ikke i leveranse 2 (ingen plassholder).

**2. Skal PDF og HTML som inndata ligge i videoleveransen (3)?**
Anbefaling: **ja.** Du nevnte dem som inndata for videoproduksjon, og
begge er små når omfanget er som i spørsmål 20 og 21.

**3. Det som står åpent fra leveranse 1 (6.1–6.8, Canvas, tabeller i
importen): vente eller gå videre?**
Anbefaling: **gå videre, med ett unntak: Canvas prøves først i
leveranse 2,** sammen med deg mens du er innlogget. Canvas avgjør om
innbygging og skript virker der studentene åpner fila, og det styrer
spørsmål 10. Uttrykket er et tema og kan endres senere uten å røre
innholdet. Tabellimporten rettes når du har pekt på lysark som plager
deg.

---

## B. «Lær mer»-byggeren

**4. Hvordan knyttes utdyping til et element (formatet)?**
Anbefaling: **utdyping blir en egenskap alle elementer kan ha**
(tittel + en liste med byggesteiner). Knappen «+ Lær mer» blir da bare
et knappe-element med samme slags utdyping, så det finnes én modell og
én bygger. Eldre prosjekter løftes automatisk (format 1 → 2).
Byggesteiner i leveranse 2: tekst (med overskrifter, lister, markering og
lenker), bilde (med bildetekst og kreditering), video (fil eller lenke),
tabell og innbygging. Rekkefølgen dras på plass.

**5. Hvordan ser studenten at et element har utdyping?**
Anbefaling: **et lite, rundt «+»-merke i hjørnet av elementet, alltid
synlig** (ikke bare når musa er over, for berøring og tastatur har ingen
mus). Hele elementet er klikkbart. Merket er en ekte knapp i
tabulatorrekkefølgen, rett etter elementet, med navnet «Lær mer om:
<tittel>» for skjermleser, og sier fra at den åpner et panel. Enter og
mellomrom åpner, Esc lukker og setter fokus tilbake. Hjørnet kan velges
per element når merket dekker noe viktig. I video og utskrift vises ikke
merket.

**6. Hvordan ser byggeren ut i programmet?**
Anbefaling: **et stort vindu over hele arbeidsflaten med to spalter:**
byggesteinene til venstre, og panelet slik studenten ser det til høyre,
levende. Veier inn: «+ Lær mer» (lager knapp og åpner byggeren), og
«Legg til utdyping» på et hvilket som helst valgt element (i
Element-fanen og i høyreklikkmenyen).

**7. Panelet i spilleren: trenger det mer plass?**
Anbefaling: **ja: sidepanel som i dag, med knappen «Utvid» som gir det
hele bredden.** Tabeller, video og innbygging blir for trange i en smal
spalte.

**8. Nettilgang for bildesøket (regelen i AGENTS.md må endres).**
I dag: «Programmet samler ingenting og sender ingenting noe sted.»
Anbefaling: **ett avgrenset unntak, skrevet inn i AGENTS.md slik:**

> Programmet kontakter nettet bare når eieren selv ber om det i
> mediedialogen: et søk han skriver og sender til Wikimedia Commons, og
> nedlasting av bildet han velger. Bare `commons.wikimedia.org` og
> `upload.wikimedia.org`, håndhevet med en liste i hovedprosessen.
> Ingenting skjer i bakgrunnen, ved oppstart eller uten et klikk. Det
> sendes ingen opplysninger om eieren, maskinen eller prosjektet; bare
> søkeordene og programmets navn og versjon. Tegnekoden og eksportert
> HTML er uendret: ingen nettkall.

Første gang du søker, forklarer dialogen dette i to setninger.
Å vite: Wikimedia ber programmer oppgi kontaktinformasjon i
forespørslene. Jeg anbefaler bare «Lysark» og versjonsnummer, uten
e-post. Blir det avvist, tar jeg det opp med deg igjen.
Henger sammen med spørsmål 10: forhåndsbilde fra YouTube er også et
nettkall, og krever i så fall én vert til på lista.

**9. Lisens og navngivelse for bilder fra Commons.**
Anbefaling:
- Søket viser bare bilder som er **fri bruk (public domain, CC0), CC BY
  eller CC BY-SA.** Bilder som bare har GFDL, holdes utenfor (lisensen
  krever at hele lisensteksten følger med).
- Med bildet lagres **tittel, opphavsperson, lisens med lenke, og
  adressen til bildets side på Commons**, og om det er beskåret.
- Krediteringen settes inn av programmet: **liten linje under bildet** i
  «Lær mer»-panelet, og **«Bildekilder»** som egen oversikt i spilleren
  (og som valgfri siste scene i video). Du kan ikke fjerne den for bilder
  som krever navngivelse.
- Egne opplastinger får de samme feltene, frivillige.
- Bildet lastes ned i **høyst 2560 px bredde**, ikke originalen, så
  HTML-fila ikke eser ut.

Jeg er ikke jurist: CC BY-SA krever at *bearbeidelser av bildet* deles
på samme vilkår. Min forståelse er at en forelesning som bruker bildet
uendret, er en samling og ikke en bearbeidelse, men det bør USNs
bibliotek eller jurister bekrefte hvis det betyr noe for deg.

**10. YouTube: innebygd eller lenke, og personvern.**
Fakta først:
- I dag er en YouTube-lenke et kort som åpner nettleseren. Fra økt 3
  viser kortet stillbildet PowerPoint hadde lagret.
- Innebygd avspilling betyr at studentens nettleser henter spiller og
  video fra Google, med det Google da får vite.
- YouTube krever at siden oppgir hvor den kommer fra. En HTML-fil åpnet
  rett fra disk gjør ikke det, og da svarer YouTube trolig med «Feil
  153». Fra Canvas (https) skal det virke. **Dette er ikke prøvd**, og
  må prøves i Canvas.

Anbefaling: **innebygd, men to-trinns:** scenen viser bare stillbildet
(lokalt, ingen nettkall) med teksten «Spill av fra YouTube». Først når
studenten klikker, lastes spilleren fra `youtube-nocookie.com`. Lenka
«Åpne på YouTube» står alltid ved siden av, så videoen kan nås også der
innbygging ikke virker (fil åpnet fra disk). Forhåndsvisningen i
programmet vises fra en lokal adresse på din egen maskin
(`127.0.0.1`), slik at den oppfører seg som i Canvas.
Stillbilde for lenker du limer inn selv: **hentes når du trykker «Hent
forhåndsbilde»**, ikke automatisk (én vert til på lista i spørsmål 8:
`i.ytimg.com`).
Annen innbygging (Panopto, GeoGebra og lignende) følger samme mønster:
«Innhold fra <vert> – klikk for å laste».

**11. Mediedialogen.**
Anbefaling: **tre faner: «Søk i Wikimedia Commons», «Last opp» og «I
prosjektet»** (det du allerede har lagt inn; kom gratis og sparer
dobbeltlagring). Søket viser et galleri med lisensmerke på hvert bilde;
klikk gir større bilde, opphavsperson og lisens, og «Sett inn».

---

## C. Figurer og bevegelser

**12. Hva skal «statisk figur» bety?**
Anbefaling: **en figur er statisk til du gir delene steg.** Samme
bygger, samme figur; bevegelse er noe du legger på, ikke en annen type.
I tillegg til maler med skjema foreslår jeg **fri figur**: bokser,
ellipser, piler, koblingslinjer og etiketter som holdes sammen som ett
element. Si fra hvis du mente noe annet, for eksempel tegning for hånd.

**13. Hvilke figurer trengs først?**
Planen har åtte maler: tidslinje, prosess, årsak-virkning, venndiagram,
søylediagram, linjediagram, lagvis oppbygging, sammenligning.
Anbefaling: **begynn med seks, valgt etter forelesningene dine:**
1. **merket bilde** (nytt): tall, piler og etiketter oppå et foto eller
   en tegning. Du har 581 bilder, og dette går rett sammen med «Lær mer»
   på deler av et bilde
2. prosess / flyt
3. lagvis oppbygging (for eksempel sjikt i en konstruksjon)
4. sammenligning
5. tidslinje
6. søyle- og linjediagram

og fri figur (spørsmål 12). Venndiagram og årsak-virkning kommer etterpå
hvis du savner dem. Alle maler starter tomme; jeg fyller aldri inn
fagverdier.

**14. Hvilke bevegelser?**
Anbefaling: de seks fra planen (**tone inn, gli inn, tegne strek, vokse,
markere, telle opp**), pluss **forsvinne** og én ny: **zoome inn på et
utsnitt** og ut igjen. Den siste er det som gir liv til bildetunge
lysark i video. Ingen sprett, snurr eller andre effekter; det bryter med
det rolige uttrykket i profilen.

**15. Håndlaget stil.**
Anbefaling: **egen leveranse til slutt (5).** Den venter uansett på
USNs svar om indigo tavle, og på at uttrykket (6.1) er godkjent.

---

## D. Video

**16. Per scene eller én samlet tidslinje?**
Anbefaling: **begge, som to visninger av de samme dataene.** Hver scene
eier sin lyd og sine tidspunkter, så du kan lese inn én scene på nytt
uten å forstyrre resten, og flytte scener fritt. Over dette ligger én
tidslinje for hele forelesningen, der scenene står etter hverandre og
du drar i grensene, spiller gjennom og ser total lengde. Det passer
formatet som finnes (lyd og steg per scene), og ingen utgave får egen
kopi av innholdet.

**17. Hvilke grep skal redigeringen ha?**
Anbefaling, første versjon:
- **klippe** start og slutt, og **klippe bort et stykke midt i**
  (merk et område, slett). Originalopptaket beholdes; klipp er en liste
  som kan angres
- **dele** lyden og **legge inn pause**
- **strekke en scene:** la bildet stå lenger før, etter eller mellom
  setninger
- **flytte tidspunktet for hvert steg** ved å dra merker på tidslinja
- **ta om** en scene, eller ta om fra spillehodet og ut
- **lydstyrke per scene**, og jevn styrke for hele videoen ved eksport
- overgang mellom scener: rent klipp, eller kort toning (0,3 s) som valg

Ikke med: musikk og flere lydspor, endring av hastighet, effekter. Musikk
drar med seg lisensspørsmål og er sjelden ønsket i undervisningsvideo.

**18. Innspillingen.**
Anbefaling: **les inn fortløpende.** Manuset står på skjermen, pil høyre
går til neste steg eller neste scene og setter tidspunktet, og opptaket
deles automatisk ved scenegrensene. Du kan altså lese inn en hel
forelesning i ett strekk og likevel redigere scene for scene.
Nedtelling, nivåmåler, pause og «ta om denne scenen» er med. Lydfil kan
også importeres.

**19. Hva kommer ut?**
Anbefaling: **MP4, 1080p, 30 bilder i sekundet, H.264 med AAC-lyd,**
tegnet bilde for bilde (ikke skjermopptak). **Teksting som egen fil
(WebVTT)** laget av manuset og tidspunktene, ikke brent inn i bildet;
Canvas, Panopto og YouTube tar imot slike filer, og studenten kan slå
den av og på. **HTML-fila får «Spill av»:** stemmen din spilles og
stegene går av seg selv på de samme tidspunktene. «Lær mer» vises ikke i
video, som i dag.

**20. Eksportert HTML som inndata.**
Anbefaling: **«Åpne HTML-fil …» gjør fila til et prosjekt igjen.** Den
inneholder hele prosjektet og mediene, så dette blir nøyaktig. Store
videoer som ligger i mappa ved siden av, tas med hvis mappa er der. Bare
HTML laget av Lysark kan åpnes; andre HTML-filer avvises med en
forklaring.

**21. PDF som inndata.**
Anbefaling: **hver side blir en scene med siden som bilde,** tegnet i
dobbel oppløsning. Teksten på siden hentes ut og legges som alternativ
tekst, så skjermleser og søk virker. Innholdet kan ikke redigeres, men
du kan legge på steg, zoom, «Lær mer» og stemme. PPTX er fortsatt veien
til redigerbart innhold.
Lisens: **pdf.js (pakken `pdfjs-dist`, Apache-2.0)** kan bygges inn
etter reglene. Poppler er GPL og kunne bare vært brukt som eget program;
det trengs ikke. Skriftdataene pdf.js har med seg, kontrolleres og føres
i [stakk.md](stakk.md) før pakken tas inn.

**22. Hvilket FFmpeg-bygg, og skal det følge med programmet?**
FFmpeg startes som eget program, aldri bygd inn. To bygg finnes fra
BtbN/FFmpeg-Builds for Windows og Linux:
- **GPL-bygget** har libx264: best kvalitet og minst filer.
- **LGPL-bygget** mangler libx264. Om det har en annen brukbar
  H.264-koder (openh264), har jeg ikke fått bekreftet; det må sjekkes på
  selve fila.

Anbefaling: **GPL-bygget, en fast, navngitt utgave (ikke «siste»), hentet
av et skript med kontroll av sjekksum, og lagt ved programmet** sammen
med lisensteksten og en lenke til kildekoden for akkurat den utgaven.
Da virker video uten at du installerer noe. Prisen er at AppImage og
zip blir anslagsvis 80–130 MB større hver. FFmpeg ligger aldri i git.

**23. Mikrofon på Linux og Windows.**
Anbefaling:
- Programmet gir seg selv lov til **lyd, aldri kamera,** og bare for sitt
  eget vindu. Lyden lagres i prosjektmappa og sendes ingen steder.
- Du velger mikrofon i en liste, med nivåmåler før opptak.
- **Støydemping på, automatisk styrkeregulering av** (den pumper
  volumet opp i pauser). Begge kan endres.
- **Windows 11:** «La skrivebordsapper få tilgang til mikrofonen» må stå
  på under Personvern. Programmet oppdager avslag og forklarer hvor
  innstillingen er.
- **Linux Mint:** ingen egen tillatelse trengs; AppImage-fila bruker
  systemets lyd direkte.

Tilleggsspørsmål: **kan Windows-VM-en din få en mikrofon?** Hvis ikke,
må innspilling prøves på en ekte Windows 11-maskin før leveranse 3 kan
kalles ferdig.

---

## E. Til slutt

**24. Den svarte videospilleren i skjermbildet ditt (0:02 / 0:05).**
Jeg klarte ikke å gjenskape den: en vanlig videofil spiller riktig i
«Lær mer»-panelet, og en YouTube-lenke blir et lenkekort. Hvilken fil
eller lenke la du inn, og hvordan? Det nærmeste jeg kom, er en video
der bildet er kodet på en måte programmet ikke kan vise (for eksempel
H.265 fra mobil): da spilles lyden mot svart bilde. Det sier programmet
nå fra om, men jeg vet ikke om det var din feil.
