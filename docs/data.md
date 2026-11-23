# Data og privatliv

Sprintline gemmer data i Trellos `pluginData`. Hostingudbyderen leverer Power-Up'ens filer. Sprintline sender ingen tidsdata til hostingudbyderen eller en ekstern database.

| Hvor | Hvad Sprintline gemmer |
| --- | --- |
| På kortet | Estimeret og faktisk tid, afslutningsdato, sprint, estimathistorik og fravalg af påmindelsen om manglende estimat. |
| På boardet | Sprints med navn, datoer og eventuelt kortmærke. Boardet gemmer også indstillinger for visning, tidsregistrering og prognose. |

Data gemmes med synligheden `shared`. Alle med adgang til kortet eller boardet kan læse de tilhørende data, også hvis boardet er offentligt.

Estimathistorikken bruges til at beregne, hvor meget arbejde der var tilbage på hver dag i grafen. Sprintline gemmer op til 60 historikposter på hvert kort. Ved flere ændringer bevarer den første post og de 59 nyeste.

Når en administrator fjerner Power-Up’en fra et board, kan de vælge at slette de delte data på både boardet og kortene.

[Om Trellos pluginData](https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/)
