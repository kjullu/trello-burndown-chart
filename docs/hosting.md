# Host Sprintline selv

Sprintline er en statisk Vite-app. Publicér indholdet af `dist` på en offentlig HTTPS-adresse, og brug adressen som **Iframe Connector URL** i [opsætningen i Trello](opsaetning.md).

## GitHub Pages

1. Lav en fork af projektet.
2. Vælg **GitHub Actions** som kilde under **Settings → Pages**.
3. Kør **Deploy to GitHub Pages** fra fanen **Actions**, eller push til `master` for at starte det automatisk.

[Workflowet](../.github/workflows/deploy-pages.yml) kører test, bygger siden og sætter Vites sti til repositoryets navn. Brug den adresse, som Pages viser efter udgivelsen. Den har normalt formen `https://DIT-BRUGERNAVN.github.io/DIT-REPOSITORY/`.

Hvis GitHub CLI afviser et push med en fejl om manglende `workflow`-scope, kan du opdatere dit login med `gh auth refresh -h github.com -s workflow`.

## Netlify, Vercel eller en anden statisk vært

Brug Node.js 22. Vælg Vite på Netlify eller Vercel, og brug `npm run build` som buildkommando og `dist` som outputmappe.

Bygger du selv, så kør `npm ci` og derefter `npm run build`. Ved udgivelse under en undermappe skal du sætte `VITE_BASE_PATH` til stien, f.eks. `/sprintline/`, når du bygger. Standardstien er `/`.

## Udvikl lokalt

```sh
npm ci
npm run dev
```

Åbn [demoen på localhost](http://localhost:5173/dashboard.html?demo) med den port, Vite viser. Demoen bruger faste data og kan åbnes uden Trello.

- [Tilføjet arbejde](http://localhost:5173/dashboard.html?demo=added-work) viser, hvordan den blå linje stiger, når der kommer 10 timer nyt arbejde ind den 23. september.
- [Sprintens start](http://localhost:5173/dashboard.html?demo=wikipedia-baseline) viser den blå og den ideelle linje med samme startværdi.

Brug en offentlig HTTPS-tunnel til Vites adresse, hvis du vil afprøve integrationen på et Trello-testboard. Sæt tunnelens adresse som connector-URL.

Kør `npm test` for at køre testene og `npm run build` for at bygge til udgivelse.
