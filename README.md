# Sprintline

> [!WARNING]
> **Early Access:** Sprintline er stadig under udvikling. Funktioner, brugerflade og dataformat kan ændre sig, og fejl kan forekomme. Test Power-Up'en på et ikke-kritisk board, før du bruger den til et aktivt projekt.
> **Der kommer også hurtige opdateringer, så hvis det er noget som er kritisk skal du [Host projektet selv](#host-projektet-selv)**

Sprintline er en Trello Power-Up til tidsestimater, faktisk tidsforbrug og burndown-grafer. Den tilføjer tidsregistrering til kortene og et samlet sprintdashboard til boardet.

Power-Up-ikonet ligger som en færdig PNG i `public/icon.png`. Den redigerbare Aseprite-kildefil ligger i `assets/burnDownChart.aseprite`.

## Brug den eksisterende version

Du behøver ikke hoste koden selv. Den aktuelle version ligger på:

```text
https://kjullu.github.io/trello-burndown-chart/
```

Du skal stadig oprette din egen custom Power-Up i Trello, fordi en Power-Up tilhører et Trello Workspace. Brug adressen ovenfor som **Iframe Connector URL**, og følg opsætningen nedenfor.

Power-Up'en har ingen ekstern database. Tidsdata gemmes på dit eget Trello-board via Trellos `pluginData`.

## Opret den som custom Power-Up i Trello

1. Åbn [Trello App Admin](https://trello.com/apps/admin), og vælg **New**.
2. Vælg **My app will use Power-Up capabilities**.
3. Udfyld navn, Workspace, email, supportkontakt og forfatter. Supportkontakt er et obligatorisk felt. Du kan bruge din egen emailadresse.
   Du kan bruge `public/icon.png` som appens ikon.
4. Indsæt en af følgende adresser som **Iframe Connector URL**:
   - Den eksisterende version: `https://kjullu.github.io/trello-burndown-chart/`
   - Din egen HTTPS-adresse, hvis du selv hoster projektet.
5. Opret appen.
6. Åbn fanen **Capabilities**, og aktivér:
   - `board-buttons`
   - `card-buttons`
   - `card-badges`
   - `card-detail-badges`
   - `show-settings`
7. Gå tilbage til dit Trello-board, åbn **Power-Ups**, og tilføj den nye Power-Up.

OAuth 2.0 skal ikke konfigureres. Sprintline bruger Power-Up-klientens datalager og kalder ikke Trellos REST API med en brugertoken.

Hvis knapperne ikke vises med det samme efter en opdatering, skal du vente på, at deploymentet er færdigt, og derefter genindlæse Trello med `Ctrl+Shift+R`.

## Sådan bruges Sprintline

### Estimér en opgave

1. Åbn et Trello-kort.
2. Vælg **Tid & afslutning** under Power-Ups.
3. Indtast det forventede antal timer under **Estimat**.
4. Vælg **Gem tid**.

Estimatet vises som et blåt badge på kortet.

### Afslut en opgave

1. Markér kortet som færdigt i Trello.
2. Kortet får et rødt **Mangler faktisk tid**-badge.
3. Åbn **Tid & afslutning**.
4. Indtast den tid, opgaven faktisk tog, og kontrollér afslutningsdatoen.
5. Vælg **Gem tid**.

Badget bliver grønt, når den faktiske tid er registreret. Hvis kortet allerede er markeret som færdigt i Trello, åbner formularen automatisk felterne til faktisk tid.

### Se burndown-grafen

1. Vælg **Burndown** i boardets topmenu.
2. Åbn **Sprintdatoer**, og vælg sprintens start- og slutdato.
3. Dashboardet viser timer tilbage, færdige kort, forskellen mellem estimeret og faktisk tid, velocity, effektivitet og en prognose for, hvornår arbejdet er færdigt.

Den stiplede linje er det ideelle forløb. Den blå linje viser den resterende estimerede indsats, og den stiplede røde linje er prognosen.

Værdien på den blå linje er **summen af den indsats, der var tilbage ved arbejdsdagens start** — ikke en løbende nedskrivning af en fast total. Et korts første estimat regnes som en del af sprintens oprindelige backlog, også hvis estimatet først indtastes efter sprintstart. Derfor starter den faktiske og ideelle linje samme sted. Senere estimatændringer gælder fra ændringsdatoen og ændrer ikke fortiden. Arbejde, der afsluttes på en given dato, er brændt af ved næste punkt. Den ideelle linje ender ved nul på sprintens sidste arbejdsdag. Et kort der allerede var afsluttet før sprinten, tæller ikke med. Weekender bruger ingen kapacitet og vises ikke på tidsaksen.

### Prognose, velocity og effektivitet

- **Velocity** er den estimerede mængde arbejde, der er afbrændt pr. arbejdsdag i sprinten.
- **Effektivitet** er forholdet mellem det estimerede og det faktiske tidsforbrug på de afsluttede opgaver. En faktor på 100 % betyder, at arbejdet tog lige så lang tid som estimeret. Under 100 % tager det længere tid. Faktoren genberegnes automatisk i takt med at faktisk tid registreres; indtil da bruges den planlagte faktor fra indstillingerne.
- **Prognose** er den arbejdsdag, hvor det resterende arbejde forventes færdigt, udregnet som `resterende timer ÷ (arbejdstimer pr. arbejdsdag × antal medarbejdere × effektivitet)`. Den røde prognoselinje fortsætter efter sprintens slutdato, hvis arbejdet forventes færdigt senere. I så fald vises datoen også med advarselsfarven.

Den samme formel bruges til at forudsige hele sprintens varighed fra starten: `(samlet estimat ÷ (arbejdstimer pr. arbejdsdag × medarbejdere)) ÷ effektivitet`. Det er den faktor, der kompenserer for systematiske skævvrid i estimaterne, så et hold der konsekvent overestimerer ikke altid ser ud til at være foran planen.

### Tilpas indstillingerne

Åbn boardets **Power-Ups**-menu, find Sprintline, og vælg **Settings**. Indstillingerne gælder kun for det aktuelle board.

Her kan du vælge farver for aktive, færdige og overskredne opgaver, angive et standardestimat, slå automatisk kopiering til faktisk tid til eller fra, vise en rød påmindelse på kort uden estimat, skjule badges på kortforsiden og vælge standardlængden på nye sprints. Under **Prognose** sætter du antal medarbejdere, arbejdstimer pr. dag og den planlagte effektivitetsfaktor. Når påmindelsen om manglende estimat er slået til, kan du fravælge den på enkelte kort via **Tid & afslutning**-dialogens afkrydsningsfelt **Ignorér manglende estimat**.

## Host projektet selv

Trello indlæser Power-Up'en i iframes og kræver derfor en offentlig HTTPS-adresse. Projektet er statisk og kræver ingen server eller database.

### GitHub Pages

Repositoryet indeholder workflowet `.github/workflows/deploy-pages.yml`. Det tester, bygger og publicerer siden ved hvert push til `master`.

1. Fork eller push projektet til dit eget GitHub-repository.
2. Åbn **Settings → Pages** i repositoryet.
3. Vælg **GitHub Actions** under **Source**. Vælg ikke skabelonen **Static HTML**, da Vite først skal bygge projektet.
4. Push til `master`, og vent på at workflowet **Deploy to GitHub Pages** bliver grønt under fanen **Actions**.
5. Din connector-adresse bliver normalt:

   ```text
   https://DIT-BRUGERNAVN.github.io/DIT-REPOSITORY/
   ```

Workflowet beregner automatisk den korrekte repository-sti til Vite-buildet.

Hvis GitHub afviser workflow-filen med en fejl om manglende `workflow`-scope, kan GitHub CLI-loginet opdateres med:

```bash
gh auth refresh -h github.com -s workflow
```

Vent på `Authentication complete`, før terminalkommandoen afbrydes, og push derefter igen.

### Netlify

1. Importér repositoryet i Netlify.
2. Brug build-kommandoen `npm run build`.
3. Brug outputmappen `dist`.
4. Deploy siden, og brug Netlify-adressen som Iframe Connector URL.

### Vercel

1. Importér repositoryet i Vercel.
2. Vælg Vite som framework, hvis det ikke registreres automatisk.
3. Brug build-kommandoen `npm run build` og outputmappen `dist`.
4. Deploy siden, og brug Vercel-adressen som Iframe Connector URL.

Netlify og Vercel publicerer normalt siden på domænets rod. Vite bruger derfor `/` automatisk, når `VITE_BASE_PATH` ikke er sat.

## Lokal udvikling

Installer afhængigheder og start Vite:

```bash
npm install
npm run dev
```

Demo-dashboardet kan åbnes uden Trello på:

```text
http://localhost:5173/dashboard.html?demo
```

Regressionseksemplet, hvor det første estimat indtastes midt i sprinten, kan ses på `http://localhost:5173/dashboard.html?demo=wikipedia-baseline`. Demoen viser, at den faktiske og ideelle linje starter sammen. Demoerne bruger faste datoer og data, så resultatet er det samme uanset hvornår de åbnes.

For at teste selve Power-Up-integrationen skal den lokale server eksponeres via en HTTPS-tunnel. Brug tunnelens rodadresse som Iframe Connector URL i en test-Power-Up.

Kør test og produktionsbuild med:

```bash
npm test
npm run build
```

## Data og privatliv

Sprintline gemmer disse delte oplysninger:

- Estimeret tid, faktisk tid, afslutningsdato og en kort historik over estimatændringer på det enkelte kort. Historikken bruges til at vise det korrekte resterende arbejde for hver dag, så fortidens grafpunkter ikke ændrer sig, når et estimat rettes.
- Sprintens start- og slutdato på boardet.
- Antal medarbejdere, arbejdstimer pr. dag og effektivitetsfaktor på boardet.

Data gemmes via Trellos `pluginData` med synligheden `shared`. Det betyder, at medlemmer med adgang til kortet eller boardet kan læse Power-Up-dataene. Der sendes ingen tidsdata til GitHub Pages, Netlify, Vercel eller en ekstern database.

Trello har en grænse på 4096 tegn pr. scope og synlighed. Sprintline gemmer kun et lille objekt på hvert kort og et lille objekt på boardet. Estimathistorikken på hvert kort holdes ned til de seneste 60 ændringer.
