// Slovná zásoba. Formát podstatných mien: "Slovo:preklad" oddelené znakom "|".
(function (root) {
  'use strict';

  const NOUNS = {
    der: `Tisch:stôl|Stuhl:stolička|Hund:pes|Mann:muž|Vater:otec|Bruder:brat|Sohn:syn|Freund:priateľ|Lehrer:učiteľ|Arzt:lekár|Tag:deň|Monat:mesiac (kalendárny)|Morgen:ráno|Abend:večer|Sommer:leto|Winter:zima|Frühling:jar|Herbst:jeseň|Montag:pondelok|Regen:dážď|Schnee:sneh|Wind:vietor|Himmel:nebo|Mond:mesiac (na oblohe)|Stern:hviezda|Baum:strom|Wald:les|Berg:hora|Fluss:rieka|See:jazero|Garten:záhrada|Park:park|Weg:cesta|Platz:námestie, miesto|Bahnhof:stanica|Flughafen:letisko|Zug:vlak|Bus:autobus|Wagen:voz|Schlüssel:kľúč|Löffel:lyžica|Teller:tanier|Kühlschrank:chladnička|Schrank:skriňa|Boden:podlaha|Fernseher:televízor|Computer:počítač|Brief:list (pošta)|Kugelschreiber:guľôčkové pero|Bleistift:ceruzka|Kopf:hlava|Arm:ruka (paža)|Fuß:noha (chodidlo)|Finger:prst|Mund:ústa|Zahn:zub|Rücken:chrbát|Bauch:brucho|Kaffee:káva|Tee:čaj|Saft:džús|Wein:víno|Apfel:jablko|Käse:syr|Kuchen:koláč|Fisch:ryba|Zucker:cukor|Salat:šalát|Reis:ryža|Hunger:hlad|Durst:smäd|Name:meno|Beruf:povolanie|Preis:cena|Urlaub:dovolenka|Film:film|Ball:lopta|Sport:šport|Mantel:kabát|Schuh:topánka|Rock:sukňa|Hut:klobúk|Koffer:kufor|Ausweis:preukaz|Termin:termín|Fehler:chyba|Unterricht:vyučovanie|Kurs:kurz|Text:text|Satz:veta|Anfang:začiatok|Vogel:vták|Körper:telo|Raum:miestnosť|Laden:obchod|Markt:trh|Strand:pláž|Optimismus:optimizmus|Tourismus:turizmus|Honig:med|Teppich:koberec|König:kráľ|Motor:motor|Direktor:riaditeľ|Lehrling:učeň`,

    die: `Frau:žena|Mutter:matka|Schwester:sestra|Tochter:dcéra|Freundin:priateľka|Familie:rodina|Katze:mačka|Schule:škola|Universität:univerzita|Klasse:trieda|Arbeit:práca|Stadt:mesto|Straße:ulica|Wohnung:byt|Küche:kuchyňa|Tür:dvere|Wand:stena|Lampe:lampa|Uhr:hodiny|Tasche:taška|Flasche:fľaša|Tasse:šálka|Gabel:vidlička|Milch:mlieko|Butter:maslo|Suppe:polievka|Wurst:klobása|Banane:banán|Kartoffel:zemiak|Tomate:paradajka|Zeit:čas|Woche:týždeň|Stunde:hodina|Minute:minúta|Nacht:noc|Sonne:slnko|Blume:kvet|Wiese:lúka|Luft:vzduch|Welt:svet|Erde:zem|Hand:ruka (dlaň)|Nase:nos|Schulter:plece|Brust:hruď|Hose:nohavice|Jacke:bunda|Brille:okuliare|Zeitung:noviny|Frage:otázka|Antwort:odpoveď|Sprache:jazyk|Musik:hudba|Reise:cesta (výlet)|Fahrt:jazda|Bahn:železnica|Brücke:most|Kirche:kostol|Bank:banka|Post:pošta|Polizei:polícia|Apotheke:lekáreň|Rechnung:účet (faktúra)|Übung:cvičenie|Meinung:názor|Erfahrung:skúsenosť|Entscheidung:rozhodnutie|Freiheit:sloboda|Gesundheit:zdravie|Krankheit:choroba|Möglichkeit:možnosť|Schwierigkeit:ťažkosť|Freundschaft:priateľstvo|Mannschaft:mužstvo|Wissenschaft:veda|Nation:národ|Information:informácia|Situation:situácia|Qualität:kvalita|Bäckerei:pekáreň|Bibliothek:knižnica|Natur:príroda|Kultur:kultúra|Liebe:láska|Angst:strach|Lust:chuť (do niečoho)|Farbe:farba|Zahl:číslo|Nummer:číslo (poradové)|Adresse:adresa|Karte:karta, lístok|Maus:myš|Kuh:krava|Idee:nápad|Geschichte:história, príbeh|Prüfung:skúška|Hilfe:pomoc|Sache:vec|Seite:strana|Mitte:stred|Ecke:roh|Dusche:sprcha|Treppe:schody|Heizung:kúrenie|Regierung:vláda|Gesellschaft:spoločnosť|Wirtschaft:hospodárstvo|Kindheit:detstvo|Fabrik:továreň|Politik:politika|Energie:energia|Gefahr:nebezpečenstvo|Macht:moc|Kunst:umenie`,

    das: `Kind:dieťa|Mädchen:dievča|Baby:bábätko|Haus:dom|Zimmer:izba|Fenster:okno|Bett:posteľ|Bad:kúpeľňa|Dach:strecha|Auto:auto|Fahrrad:bicykel|Flugzeug:lietadlo|Schiff:loď|Buch:kniha|Heft:zošit|Papier:papier|Bild:obraz|Foto:fotka|Handy:mobil|Telefon:telefón|Radio:rádio|Wasser:voda|Bier:pivo|Brot:chlieb|Ei:vajce|Fleisch:mäso|Obst:ovocie|Gemüse:zelenina|Salz:soľ|Essen:jedlo|Frühstück:raňajky|Glas:pohár|Messer:nôž|Jahr:rok|Wochenende:víkend|Wetter:počasie|Land:krajina|Dorf:dedina|Meer:more|Tier:zviera|Pferd:kôň|Schwein:prasa|Auge:oko|Ohr:ucho|Bein:noha|Herz:srdce|Gesicht:tvár|Haar:vlas|Knie:koleno|Hemd:košeľa|Kleid:šaty|Geld:peniaze|Geschenk:darček|Spiel:hra|Lied:pieseň|Wort:slovo|Beispiel:príklad|Problem:problém|Thema:téma|Ziel:cieľ|Leben:život|Glück:šťastie|Hotel:hotel|Restaurant:reštaurácia|Kino:kino|Museum:múzeum|Theater:divadlo|Büro:kancelária|Geschäft:obchod|Krankenhaus:nemocnica|Zentrum:centrum|Datum:dátum|Studium:štúdium|Dokument:dokument|Instrument:nástroj|Experiment:experiment|Brötchen:žemľa|Märchen:rozprávka|Kaninchen:králik|Fräulein:slečna|Büchlein:knižka|Ergebnis:výsledok|Zeugnis:vysvedčenie|Geheimnis:tajomstvo|Erlebnis:zážitok|Gebäude:budova|Gefühl:pocit|Gespräch:rozhovor|Gepäck:batožina|Licht:svetlo|Feuer:oheň|Eis:ľad, zmrzlina|Gold:zlato|Blut:krv|Tor:brána, gól|Schloss:zámok|Konto:účet (v banke)|Sofa:pohovka|Ticket:lístok|Team:tím|Hobby:hobby|Klima:klíma|Kissen:vankúš|Regal:polica|Fach:predmet (v škole)|Gras:tráva|Blatt:list (na strome)|Holz:drevo`,
  };

  // Krajiny a mestá: "člen:Názov:preklad"
  const GEO = `-:Deutschland:Nemecko|-:Österreich:Rakúsko|-:Frankreich:Francúzsko|-:Italien:Taliansko|-:Spanien:Španielsko|-:Polen:Poľsko|-:Ungarn:Maďarsko|-:Tschechien:Česko|-:England:Anglicko|-:Japan:Japonsko|-:China:Čína|-:Europa:Európa|-:Berlin:Berlín|-:Wien:Viedeň|-:Bratislava:Bratislava|-:München:Mníchov|die:Schweiz:Švajčiarsko|die:Türkei:Turecko|die:Slowakei:Slovensko|die:Ukraine:Ukrajina|die:Mongolei:Mongolsko|der:Iran:Irán|der:Irak:Irak|der:Libanon:Libanon|der:Sudan:Sudán|die:USA:USA|die:Niederlande:Holandsko`;

  const GEO_NOTE = {
    '-': 'väčšina krajín a miest → bez člena',
    der: 'výnimka medzi krajinami → der',
    die: 'výnimka medzi krajinami → die',
  };
  const GEO_SPECIAL = {
    USA: 'množné číslo → die',
    Niederlande: 'množné číslo → die',
    Türkei: 'krajiny na -ei → die',
    Slowakei: 'krajiny na -ei → die',
    Mongolei: 'krajiny na -ei → die',
  };

  const N_JOB = 'povolanie/status po sein, als → bez člena';
  const N_FIX = 'ustálené spojenie → bez člena';
  const N_MASS = 'neurčité množstvo → bez člena';
  const N_PLACE = 'mestá a väčšina krajín → bez člena';
  const N_SUBJ = 'konkrétna vec/osoba ako podmet → s členom';

  // Frázy: [text s medzerou, člen, preklad, poznámka]
  const PHRASES = [
    ['Er ist ___ Arzt.', '-', 'Je lekár.', N_JOB],
    ['Sie ist ___ Lehrerin.', '-', 'Je učiteľka.', N_JOB],
    ['Er ist ___ Student.', '-', 'Je študent.', N_JOB],
    ['Sie arbeitet als ___ Ärztin.', '-', 'Pracuje ako lekárka.', N_JOB],
    ['Er arbeitet als ___ Koch.', '-', 'Pracuje ako kuchár.', N_JOB],
    ['Ich habe ___ Hunger.', '-', 'Som hladný.', N_FIX],
    ['Ich habe ___ Durst.', '-', 'Som smädný.', N_FIX],
    ['Ich habe ___ Angst.', '-', 'Bojím sa.', N_FIX],
    ['Hast du ___ Lust?', '-', 'Máš chuť?', N_FIX],
    ['Ich habe ___ Fieber.', '-', 'Mám horúčku.', N_FIX],
    ['Wir haben ___ Urlaub.', '-', 'Máme dovolenku.', N_FIX],
    ['Er hat ___ Erfolg.', '-', 'Má úspech.', N_FIX],
    ['Das macht ___ Spaß.', '-', 'To je zábava.', N_FIX],
    ['Hast du ___ Appetit?', '-', 'Máš chuť do jedla?', N_FIX],
    ['Ich trinke gern ___ Kaffee.', '-', 'Rád pijem kávu.', N_MASS],
    ['Ich trinke ___ Tee mit Zitrone.', '-', 'Pijem čaj s citrónom.', N_MASS],
    ['Sie spielt ___ Klavier.', '-', 'Hrá na klavíri.', 'spielen + nástroj/šport → bez člena'],
    ['Er spielt ___ Fußball.', '-', 'Hrá futbal.', 'spielen + nástroj/šport → bez člena'],
    ['Ich lerne ___ Deutsch.', '-', 'Učím sa nemčinu.', 'jazyky → bez člena'],
    ['Wir fahren nach ___ Berlin.', '-', 'Ideme do Berlína.', N_PLACE],
    ['Ich komme aus ___ Österreich.', '-', 'Pochádzam z Rakúska.', N_PLACE],
    ['___ Herr Müller ist nicht da.', '-', 'Pán Müller tu nie je.', 'mená a oslovenia → bez člena'],
    ['___ Arzt kommt gleich.', 'der', 'Lekár hneď príde.', N_SUBJ],
    ['___ Lehrerin heißt Anna.', 'die', 'Učiteľka sa volá Anna.', N_SUBJ],
    ['___ Kaffee hier ist kalt.', 'der', 'Tá káva tu je studená.', N_SUBJ],
    ['___ Klavier ist sehr alt.', 'das', 'Ten klavír je veľmi starý.', N_SUBJ],
    ['___ Urlaub war zu kurz.', 'der', 'Dovolenka bola príliš krátka.', N_SUBJ],
    ['___ Fieber ist gesunken.', 'das', 'Horúčka klesla.', N_SUBJ],
    ['___ Koch ist neu hier.', 'der', 'Kuchár je tu nový.', N_SUBJ],
    ['___ Student wohnt nebenan.', 'der', 'Ten študent býva vedľa.', N_SUBJ],
    ['___ Hunger ist weg.', 'der', 'Hlad je preč.', N_SUBJ],
    ['___ Angst war umsonst.', 'die', 'Ten strach bol zbytočný.', N_SUBJ],
  ];

  const ITEMS = [];

  for (const a of Object.keys(NOUNS)) {
    for (const entry of NOUNS[a].split('|')) {
      const [text, sk] = entry.split(':');
      ITEMS.push({ id: text, text, a, sk, kind: 'noun' });
    }
  }
  for (const entry of GEO.split('|')) {
    const [a, text, sk] = entry.split(':');
    ITEMS.push({ id: 'geo:' + text, text, a, sk, kind: 'geo', note: GEO_SPECIAL[text] || GEO_NOTE[a] });
  }
  for (const [text, a, sk, note] of PHRASES) {
    ITEMS.push({ id: text, text, a, sk, kind: 'phrase', note });
  }

  root.ITEMS = ITEMS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
})(typeof window !== 'undefined' ? window : globalThis);
