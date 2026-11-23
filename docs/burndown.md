# Burndown-graf og prognose

Dashboardet viser, hvor mange estimerede timer der er tilbage i sprinten, hvordan arbejdet udvikler sig dag for dag, og hvornår sprinten forventes færdig. Hold musen over grafen, eller fokusér grafen og brug venstre og højre piletast for at aflæse hver arbejdsdag.

## Grafens linjer og markeringer

| Element | Betydning |
| --- | --- |
| **Faktisk** (blå fuldt optrukket linje) | Summen af resterende estimerede timer efter dagens registreringer. Tegnes for arbejdsdage frem til i dag eller til sprintens slutdato. |
| **Ideel** (grå stiplet linje) | Ret linje fra udgangspunktet ved sprintstart til nul på sprintens sidste arbejdsdag. |
| **Prognose** (rød prikket linje) | Ret linje fra det seneste faktiske punkt mod nul med holdets beregnede daglige afbrænding. |
| **I DAG** (lodret stiplet linje) | Dagens placering i sprinten. I weekender står linjen på den seneste arbejdsdag før i dag. |
| **+X t tilføjet** (orange markering) | Vises over punkter, hvor den blå linje stiger i forhold til den forrige arbejdsdag. |

Grafens tidsakse følger altid sprintens egne datoer. Hvis prognosen ligger efter sprintens slutdato, stopper den røde linje over nul ved slutdatoen, og prognosedatoen vises med advarselsfarve.

## Sådan beregnes grafen

Den blå linje er summen af estimater for de kort i sprinten, der stadig er åbne efter dagens registreringer. Den kan stige, når der kommer arbejde til.

- **Kun arbejdsdage tæller med.** Lørdag og søndag vises ikke på tidsaksen og bruger ingen kapacitet. Ændringer i en weekend vises på den næste arbejdsdag. Slutter sprinten i en weekend, indgår weekendens ændringer i sprintens sidste arbejdsdag.
- **Udgangspunktet er sprintens første arbejdsdag.** Den ideelle linje starter ved summen af estimater på kort, der tilhører sprinten og ikke var afsluttet før første arbejdsdag.
- **Nyt arbejde og estimatændringer gælder fra deres dato.** Når et kort får et estimat midt i sprinten, tæller timerne med fra den valgte **Tilføjet**-dato. Den ideelle linje følger fortsat estimaterne på sprintens første arbejdsdag. Retter du et estimat fra en dato, erstatter ændringen eventuelle senere ændringer i kortets historik.
- **Afsluttede kort brændes ned samme dag.** Et kort, der afsluttes på en arbejdsdag, tæller som 0 timer på dagens punkt.
- **Én samlet værdi pr. arbejdsdag.** Tilføjelser og afslutninger samme dag kan udligne hinanden på dagens punkt.
- **Kort uden estimat eller afsluttet før start tæller ikke med.** Ældre kort uden registreret dato på det første estimat regnes som en del af udgangspunktet ved sprintstart.

## Status og nøgletal

Øverst i dashboardet viser statusfeltet en samlet vurdering: **Færdig** når 0 timer er tilbage, **På sporet** når prognosen ligger på eller før slutdatoen, **N arbejdsdage bagud** når prognosen overskrider slutdatoen, eller **Ukendt tempo** hvis der mangler et beregningsgrundlag.

| Nøgletal | Hvad det viser |
| --- | --- |
| **Tilbage** | Resterende estimerede timer nu, sammenholdt med det samlede estimat ved sprintstart. |
| **Færdige kort** | Antal kort afsluttet inden for sprinten ud af sprintens sporede kort. Viser også, hvor mange færdige kort i Trello der stadig mangler faktisk tid. |
| **Prognose** | Den arbejdsdag, hvor det resterende arbejde forventes færdigt, sammenholdt med sprintens slutdato. |
| **Velocity** | Afbrændte estimerede timer divideret med antal forløbne arbejdsdage i sprinten. Vises, når der er brændt estimerede timer af. |
| **Effektivitet** | Afbrændte estimerede timer divideret med registrerede faktiske timer på færdige kort i sprinten, vist i procent. |
| **Estimat mod faktisk** | Forskellen mellem faktisk tid og estimeret tid på færdige kort i sprinten. Et plus betyder, at arbejdet tog længere tid end estimeret. |

Under grafen samler listen **Opgaver** sprintens sporede kort i tre grupper: **Kræver handling** for kort markeret som færdige i Trello uden faktisk tid, **Åbne** og **Færdige**.

## Prognose og effektivitet

Prognosen beregner først holdets daglige afbrænding i estimerede timer pr. arbejdsdag.

```text
daglig afbrænding = arbejdstimer pr. arbejdsdag × antal medarbejdere × effektivitet
resterende arbejdsdage = oprundet(resterende timer ÷ daglig afbrænding)
```

Sprintline tæller de resterende arbejdsdage frem fra i dag. For en kommende sprint tæller den fra startdatoen, og for en afsluttet sprint tæller den fra slutdatoen. Antal medarbejdere, arbejdstimer pr. arbejdsdag og den planlagte effektivitetsfaktor indstilles i [boardets indstillinger](brug.md#tilpas-indstillingerne).

En effektivitet på 100 % betyder, at afsluttede opgaver tog den estimerede tid. Under 100 % betyder, at opgaverne tog længere tid end estimeret, så den daglige afbrænding falder og prognosedatoen rykker senere. Over 100 % betyder, at opgaverne tog kortere tid end estimeret.

Faktoren genberegnes automatisk ud fra de færdige kort i sprinten, så snart der er registreret faktisk tid. Indtil da bruger Sprintline den planlagte **Effektivitetsfaktor** fra indstillingerne og markerer tallet som planlagt. Det kompenserer for systematiske skævvrid i estimaterne.

[Brug Sprintline på dit board](brug.md) · [Data og privatliv](data.md)
