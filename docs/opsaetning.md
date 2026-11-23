# Tilføj Sprintline i Trello

Du skal være administrator for det Trello Workspace, hvor du vil bruge Sprintline. Du kan bruge den udgivne version eller [hoste Sprintline selv](hosting.md).

## Opret en Power-Up

1. Åbn [Trello App Admin](https://trello.com/apps/admin), og vælg **New**.
2. Vælg **My app will use Power-Up capabilities**.
3. Udfyld navn, Workspace, e-mail, supportmail og forfatter. Du kan bruge din egen e-mailadresse som supportmail.
4. Indsæt `https://kjullu.github.io/trello-burndown-chart/` i feltet **Iframe Connector URL**. Hvis du selv hoster Sprintline, bruger du din egen HTTPS-adresse.
5. Vælg **Create**. Du kan bruge [Sprintlines ikon](../public/icon.png) som app-ikon.

## Slå funktionerne til

Åbn **Capabilities** i Trello App Admin, og aktivér disse fem funktioner.

| Capability | Hvad den viser |
| --- | --- |
| `board-buttons` | **Burndown** på boardet |
| `card-buttons` | **Tid & afslutning** på kortet |
| `card-badges` | Tidsmærker på kortforsiden |
| `card-detail-badges` | Feltet **Tid** på det åbne kort |
| `show-settings` | Sprintlines indstillinger i Power-Ups-menuen |

Åbn dit board, vælg **Power-Ups**, og tilføj den Power-Up, du lige har oprettet. Vælg **Burndown** for at åbne dashboardet. Sprintline bruger Trellos Power-Up-klient, så du kan springe OAuth-opsætningen over.

## Mangler en knap?

- Kontrollér, at Power-Up'en er tilføjet til boardet, og at den relevante capability er slået til.
- Hvis du lige har opdateret din egen version, så vent på, at udgivelsen er færdig. Genindlæs derefter Trello med `Ctrl+Shift+R`.

[Brug Sprintline på dit board](brug.md) · [Trellos vejledning til Power-Ups](https://developer.atlassian.com/cloud/trello/guides/power-ups/managing-apps/)
