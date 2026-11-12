# Ako prispieť

Artikel Jackpot je otvorený projekt a hľadá spoluhráčov. Nemusíš vedieť programovať: najcennejšie príspevky sú slová, skúsenosti z triedy a oko pre detail.

## Čo sa hodí najviac

| Oblasť | Príklady |
|---|---|
| **Slová a vysvetlivky** | slová, ktoré robia žiakom problém; mnemotechniky; opravy prekladov; frázy, kde sa rozhoduje o člene |
| **Grafika a zvuk** | ilustrácie, ikony, zvuky a hudba v duchu „Spielbank 1926“ (plsť, mosadz, krémový papier) |
| **Ďalšie jazyky a režimy** | francúzske či španielske členy, plurály, pády, iné kasínové mechaniky |
| **Testovanie a spätná väzba** | hranie v triede, hlásenie chýb, nápady na pravidlá, postrehy od žiakov |

Nemusíš otvárať pull request. Stačí napísať na **jurzon@seznam.cz** alebo založiť [issue](https://github.com/jurzon/artikel-jackpot/issues).

## Pridanie slova

Slovná zásoba je v `js/words.js`.

**Podstatné mená** sú v troch blokoch podľa člena, formát `Slovo:preklad`, položky oddelené `|`:

```js
die: `Frau:žena|Mutter:matka|Zeitung:noviny|…`,
```

**Krajiny a mestá** majú tvar `člen:Názov:preklad`, kde `-` znamená „bez člena“:

```js
const GEO = `-:Deutschland:Nemecko|die:Schweiz:Švajčiarsko|der:Iran:Irán|…`;
```

**Frázy** sú polia `[text s medzerou ___, člen, preklad, poznámka]`; poznámka vysvetľuje, prečo tam člen je alebo nie je:

```js
['Er arbeitet als ___ Koch.', '-', 'Pracuje ako kuchár.', N_JOB],
```

Pravidlá:

- Preklad nesmie obsahovať `:` ani `|`. Viac významov oddeľ čiarkou alebo daj do zátvorky: `Monat:mesiac (kalendárny)`.
- Slovo nesmie byť v súbore dvakrát. Test `dáta: platné členy, preklady, žiadne duplicity` to ustráži.
- Ak slovo spadá pod pravidlo koncovky (-ung, -heit, -chen, -ismus, Ge-…), hra ho podčiarkne a vysvetlí sama (`ruleMatch` v `js/engine.js`). Výnimky (*der Raum*, *das Zimmer*, *der Name*) pravidlo zámerne nedostanú, netreba ich nijako označovať.
- Drž sa úrovne A1–A2 a slovenských prekladov, ktoré by použil učiteľ.

Po úprave spusti testy a prejdi si pár rúk v testovacom móde (`T` v hre zvýrazní správnu odpoveď):

```bash
node --test
python3 -m http.server 8080   # http://localhost:8080/
```

## Zmeny v kóde

- **Bez frameworkov a závislostí.** Čistý HTML, CSS a JavaScript, žiadny build krok. Testy bežia cez `node --test` bez `package.json`.
- **Logika do `js/engine.js`, DOM do `js/ui.js`.** Všetko, čo sa dá otestovať bez prehliadača, patrí do engine-u a má test.
- **Žiadne sledovanie, žiadny server.** Hra nesmie nič odosielať. Postup ostáva v `localStorage`.
- **Rozhranie je po slovensky**, herné termíny po nemecky (Kassieren, Risiko, Pfandhaus). Nové hlášky píš v tom istom tóne ako krupiér.
- **Pri zmene súborov zvýš `CACHE`** v `sw.js`, aby hráči dostali novú verziu aj offline.
- **Pohyb musí ísť vypnúť.** Nové animácie rešpektujú `prefers-reduced-motion` (globálne pravidlo v `style.css` to rieši, nevypínaj ho).
- Pred pull requestom: testy zelené, ruka prejdená v prehliadači na šírke 360 px aj 480 px, žiadne chyby v konzole.

## Hlásenie chyby

Do issue napíš: čo si robil (vklad, fáza hry, ktoré tlačidlo), čo sa stalo, čo si čakal, a prehliadač so zariadením. Screenshot pomôže. Ak ide o nesprávny člen alebo preklad, stačí slovo a správna verzia.

## Licencia príspevkov

Odoslaním príspevku súhlasíš, že bude zverejnený pod rovnakou licenciou ako projekt, [CC BY-NC-SA 4.0](LICENSE), s uvedením tvojho mena v changelogu.
