# DV Dokumentation

DV (Data Visualization) ist eine JavaScript-Bibliothek welche die Visualisierung von Graphdaten mit dem Bezug auf eine zeitliche Verteilung ermöglicht. 
Für die Visualisierung wird HTML zum Anzeigen des Benutzerinterfaces und SVG zur Visualisierung der Daten eingesetzt. Die Bibliothek wurde für den Einsatz im Browser entwickelt und ist nicht mit anderen JavaScript-Umgebungen kompatibel. (node.js, nw.js, etc).

### Datenstruktur
Ein Graph ist eine abstrakte Struktur die aus einer Menge von Knoten besteht, die mit Kanten verbunden sind.

#### Knotenstruktur (Node)
Eindeutig definierter Knoten bestehend aus einer ID und einem Datum:
```
{
  "id": 1,
  "date": "2014-06-05"
}
```

Das optionale Feld "description" wird beim Knoten im Tooltip als Knotenbeschreibung verwendet. Falls dieses Feld nicht definiert ist, wird die ID benutz.

#### Kantenstruktur (Edge)
Eine Kante zwischen zwei Knoten wird mit den 2 Schlüsseln, „sourceId“ und „targetId“ definiert:
```
{
  "sourceId": 1,
  "targetId": 2
}
```

Das optionale Feld „weight“ einer Kante dient der Angabe von Zusatzinformationen, welche im Tooltip angezeigt werden. Falls der "weight"-Wert nicht definiert ist, wird "0" als Standardwert gesetzt.

#### Knotengruppierung (Community)
Jeder Knoten kann durch einen eindeutigen Wert einer Gruppe zugewiesen werden. Die Gruppierung wird mit Hilfe eines Dictionary-Objekts umgesetzt, welches den ID-Wert des Knoten als Schlüssel und den Gruppenname als Wert definiert.
```
{
  1: "it",
  2: "sport
}
```

### Konfiguration

Standard-Konfiguration:
```
{
  // Key mapping
  keyMap: {...},
  // Liste mit der Anzeigefarbe
  colors: [...],
  // Agenda anzeigen
  agenda: true,
  // Funktion für die Datumformatierung in der Knotenstruktur
  dateFormatNode: ...
}
```

#### keyMap (Datenvorbereitung)
Um die Benutzung der Bibliothek zu vereinfachen besteht die Möglichkeit ein KeyMapping für die Datenstruktur zu definieren. Mit diesem KeyMapping kann das Programm die gegebenen Daten in der passenden Struktur für die Visualisierung, ohne zusätzliche Implementierung umwandeln. Im Folgenden ist ein Mapping-Beispiel:
```
{
  "id": "url",
  "date": "dct",
  "description": "headline",
  "sourceId": "sourceUrl",
  "targetId": "targetUrl",
  "weight": "similarity"
}
```

##### dateFormatNode (Datumformatierung)
Als Standard für ein Datum wird das ISO-Format eingesetzt. Falls das Format abweicht die Konvertierungsfunktion in der Konfiguration der Bibliothek überschrieben werden. Dafür sollen die Funktionen der d3-Bibliothek verwendet werden, wie zum Beispiel:
```
{
  dateFormatNode: d3.time.format("%d-%m-%Y")
}
```

## Verwendung der Bibliothek

Die Bibliothek stellt das DV-Objekt im globalen JavaScript-Namespace zur Verfügung. Mit dem Aufruf des DV-Objekts wird eine Instanz des Metro-Visualisierung-Objekts erstellt. Mit dem Aufruf der "appendTo"-Methode kann das Metro-Objekt der Seite hinzugefügt werden.
```
DV(nodes, edges, community).appendTo(selector, config);
```
Erwartete Parametern des Metro-Konstruktors:
- nodes - eine Liste mit den Graphknoten
- edges - eine Liste mit den Graphkanten (optional)
- community - Dictionary mit dem ID-Community-Mapping

Erwartete Parametern der appendTo-Methode:
- selector - ein jQuery-Selector
- config - ein Konfigurations-Objekt (optional)

### weitere Methoden
| Methode        | Beschreibung
| -------------  |----------------------
| config(config) | Setzen eines Konfiguration-Objekts
| range(from, to)| Knotenfilterung nach Datum von-bis
| weight(min)    | minimales Gewichtung der Kante
| grouped(type)  | Zusammenfassung der Knoten in Tag, Woche, etc (nur Tag implementiert)

### Demos

#### Base
Dieses Beispiel beschreibt die Anwendung der Bibliothek, wenn alle Daten schon im richtigen Format vorliegen.
```
DV.metro(nodes, edges).appendTo("body", {
    agenda: false
});
```

#### Advanced
Dieses Beispiel beschreibt den Fall, falls die Knoten- und Kantendaten nicht dem erwarteten Format entsprechen.
```
DV(nodes, edges, community)
    .config({
            keyMap: {
                id: "CustomId",
                date: "DaTE",
                sourceId: "from",
                targetId: "to"
        }
    })
    .appendTo("body");
```


## Abhängigkeiten
 - d3.js 3.5.9 (https://d3js.org/)
 - jQuery 2.1.4 (https://jquery.com/)
 - Bootstrap v3.3.6 (http://getbootstrap.com/)
 - jLouvain (https://github.com/upphiminn/jLouvain)

## Getestete Browser
 - Google Chrome Version 49.0.2623.87 (Ubuntu 14.04)
 - Mozilla Firefox 45.0 (Ubuntu 14.04)
 - Safari (iOS 9.2)


