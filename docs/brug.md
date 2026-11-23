# Brug Sprintline

Når Sprintline er [sat op på dit board](opsaetning.md), registrerer du tid på de enkelte kort og følger fremdriften i boardets dashboard.

## Estimér en opgave

1. Åbn et kort, og vælg **Tid & afslutning** under Power-Ups. Du kan også klikke på feltet **Tid** på kortet.
2. Vælg sprint øverst under **Sprint**. Brug pilene `‹` og `›`, klik på en nabosprint, eller klik på den midterste sprint for at åbne hele listen.
3. Indtast det forventede antal timer under **Estimat (timer)**. Du kan bruge knapperne `−` og `+`, hurtigknapperne for 1 til 8 timer eller skrive et tal over 0.
4. Kontrollér datoen under **Tilføjet**. Datoen styrer, hvornår estimatet tæller med i grafen.
5. Vælg **Gem tid**.

Sprintline foreslår den aktuelle sprint til nye kort. Hvis ingen sprint er aktiv, foreslår den den næste planlagte eller den seneste afsluttede. **Backlog** betyder, at kortet ikke indgår i nogen sprint.

Når estimatet er gemt, vises det som et badge på kortet i farven for **Aktive estimater**, for eksempel `S1 · 4 t`.

## Afslut en opgave

1. Markér kortet som færdigt i Trello. Hvis faktisk tid mangler, viser feltet **Tid** en advarsel.
2. Åbn **Tid & afslutning**. Kontakten **Færdig** er slået til automatisk, når kortet allerede er markeret som færdigt i Trello.
3. Indtast det faktiske tidsforbrug under **Faktisk tid (timer)**, og kontrollér afslutningsdatoen ud for **Færdig**. Hurtigknapperne foreslår værdier ud fra estimatet.
4. Vælg **Gem tid**.

Du kan også slå **Færdig** til direkte i dialogen uden først at markere kortet i Trello. Når den faktiske tid er gemt, skifter badget til farven for **Færdige opgaver** og viser både faktisk og estimeret tid.

Datoerne for **Tilføjet** og **Færdig** holdes inden for den valgte sprint og kan ikke ligge efter i dag.

## Administrer sprints

Åbn dashboardet ved at vælge **Burndown** i boardets topmenu. Dashboardet åbner den aktive sprint, den næste planlagte eller den seneste afsluttede, i den rækkefølge. Skift sprint ved at klikke på sprintnavnet eller bruge pilene `‹` og `›`.

Vælg **Sprints** for at oprette eller ændre sprints.

- **+ Ny sprint** opretter et forslag med boardets standardlængde. Hvis den seneste sprint stadig er i gang eller ligger i fremtiden, starter den nye sprint dagen efter. Er den seneste sprint afsluttet, starter forslaget i dag.
- Klik på en sprint i listen for at rette **Navn** på op til 40 tegn, **Mærke** på op til 4 tegn til kortbadges, **Startdato** og **Slutdato** i formatet `dd/mm/åååå`.
- **Slet** fjerner sprinten og flytter dens kort til backlog. Et board skal have mindst én sprint.

Sprints må ikke overlappe, og et board kan højst have 40 sprints.

### Når en sprint er slut

Hvis en afsluttet sprint stadig har åbne kort med estimat, spørger dashboardet én gang, hvad der skal ske med dem. Kort uden estimat og kort, der allerede er markeret som færdige i Trello, berøres ikke.

| Valg | Hvad der sker |
| --- | --- |
| **Flyt til næste sprint** eller **Flyt til en ny sprint** | Flytter kortene til den første senere sprint, der ikke også er afsluttet. Findes der ingen, opretter Sprintline automatisk en ny sprint. Kortene tæller med fra den nye sprints start. |
| **Flyt til backlog** | Fjerner kortene fra sprinten, så de ikke indgår i nogen sprint. |
| **Lad dem blive** | Lader kortene ligge i den afsluttede sprint, så dens graf ender over nul. |
| **Senere** | Lukker dialogen uden ændringer og spørger igen næste gang dashboardet åbnes. |

## Eksportér CSV

Vælg **Eksportér CSV** i dashboardets topmenu for at hente grafdata for den valgte sprint. Filen har én række pr. arbejdsdag med kolonnerne `Dato`, `Ideelle resterende timer`, `Faktiske resterende timer` og `Prognose`.

## Tilpas indstillingerne

Åbn boardets **Power-Ups**-menu, find Sprintline, og vælg **Settings**. Indstillingerne gælder for det aktuelle board og deles mellem boardets medlemmer. Brug **Nulstil** for at gendanne standardværdierne, og afslut med **Gem indstillinger**.

| Indstilling | Standard | Hvad den styrer |
| --- | --- | --- |
| **Aktive estimater** | Blå | Badgefarve for åbne kort med estimat. |
| **Færdige opgaver** | Grøn | Badgefarve for kort med registreret faktisk tid. |
| **Handling kræves** | Rød | Badgefarve når et kort mangler faktisk tid eller estimat. |
| **Badge på kortforsiden** | Til | Viser tidsbadges på kortforsiden uden at åbne kortet. |
| **Påmindelse om manglende estimat** | Fra | Viser badget **Mangler estimat** på kort uden estimat. Kan fravælges på enkelte kort med **Ignorér manglende estimat** i **Tid & afslutning**. |
| **Standardestimat** | Intet | Forudfylder **Estimat (timer)** på nye kort. |
| **Standard sprintlængde** | 14 dage | Antal kalenderdage fra 1 til 90 for nye sprints. |
| **Start faktisk tid med estimatet** | Til | Forudfylder **Faktisk tid (timer)** med estimatet, når **Færdig** slås til. |
| **Antal medarbejdere** | 1 | Antal personer fra 1 til 50 i prognoseberegningen. |
| **Arbejdstimer pr. arbejdsdag** | 8 | Kapacitet pr. person fra 1 til 24 timer i prognoseberegningen. |
| **Effektivitetsfaktor** | 1 | Planlagt faktor fra 0,1 til 3, indtil der er registreret faktisk tid på færdige kort. |

[Forstå burndown-grafen og prognosen](burndown.md) · [Data og privatliv](data.md)
