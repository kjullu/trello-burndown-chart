# Sprintline

En Trello Power-Up til tidsestimater, faktisk tidsforbrug og burndown-grafer.

## Lokal udvikling

```bash
npm install
npm run dev
```

Trello kræver en offentlig HTTPS-adresse. Brug fx en tunnel til Vite-serveren, og angiv rodadressen som Power-Up'ens Iframe Connector URL.

## Opsætning i Trello

1. Deploy mappen til en HTTPS-host, fx Netlify, Vercel eller GitHub Pages.
2. Opret en app i [Trello Power-Up Admin](https://trello.com/power-ups/admin).
3. Vælg at appen bruger Power-Up capabilities.
4. Sæt Iframe Connector URL til den deployede `index.html`.
5. Aktivér capabilities: `board-buttons`, `card-buttons`, `card-badges` og `card-detail-badges`.
6. Tilføj Power-Up'en til et board.

Brug "Tid & afslutning" på hvert kort til at gemme estimat og faktisk tid. Åbn "Burndown" i boardets topmenu for at vælge sprintdatoer og se grafen.

## Data

Power-Up'en gemmer delte tidsdata på hvert kort og sprintdatoerne på boardet via Trellos pluginData. Der er ingen ekstern database. Trellos grænse er 4096 tegn pr. scope og synlighed, men hvert kort gemmer kun ét lille objekt.
