# Changelog

Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/), verzie podľa [SemVer](https://semver.org/lang/sk/).

## [Unreleased]

## [1.0.0] – 2026-11-12

Prvá verejná verzia na https://jurzon.github.io/artikel-jackpot/.

### Hra
- Tri valce so slovami, voľba člena der / die / das / bez člena, vklad a bank.
- Kurz slova podľa osobnej histórie (Leitnerove boxy): istota ×1,2, nové ×2, dlžník ×3.
- Drilling (tri rovnaké členy = výhra ×2), Risikoleiter so šiestimi priečkami a jackpotom, Joker za sériu piatich správnych.
- Kniha dlžníkov so štatistikou podľa člena, Pfandhaus pri bankrote.
- Lobby na úvodnej obrazovke: Pokračovať / Hrať, Nová hra, Top 10, O hre; návrat do menu ikonou alebo Esc.
- Top 10 najvyšších výhier so slovami ruky, vkladom a dátumom; Nová hra ho zachová.
- Denná zmena v lobby (slová, správne odpovede, splatené dlhy, séria dní).

### Učenie
- Po prehre sa zvyšné karty otočia zadarmo so správnym členom a tipom.
- Člen vo farbe rodu a podčiarknutá koncovka či predpona, keď platí pravidlo (-ung, -chen, Ge-…).
- Žetóny kurzu v troch hodnotách so štítkom istota / nové / neisté / dlžník.
- Výslovnosť odhaleného slova s členom nemeckým hlasom (Web Speech API).
- Vedený prvý spin štyrmi bublinami namiesto čítania pravidiel.
- Hlášky krupiéra a osobná pamäť („Zeitung ťa zhodil už 3. raz“).

### Vizuál a zvuk
- Štýl Spielbank 1926: plsť, mosadz, krémový papier, písma Fraunces, Limelight, Outfit.
- Pulzovanie ovládacích prvkov, ktoré sa dajú práve stlačiť.
- Monogram AJ na rube karty, tri zlaté gule pre Pfandhaus, ikony pre Kassieren a Risiko, úvodná tabuľa „Otvorené“.
- Zvuky syntetizované cez WebAudio, haptika na telefónoch, sprcha mincí pri výhre.

### Technika
- Statická PWA bez závislostí, offline cez service worker, inštalovateľná na plochu.
- 17 testov hernej logiky (`node --test test/`), CI na GitHub Actions.
- Žiadny server, žiadne sledovanie; postup v `localStorage`.

[Unreleased]: https://github.com/jurzon/artikel-jackpot/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jurzon/artikel-jackpot/releases/tag/v1.0.0
