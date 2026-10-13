# SETUP QUEST

Lernen → Credits verdienen → XP sammeln → Level aufsteigen → echte Produkte für das Traum-Setup freischalten.

SETUP QUEST ist eine gamifizierte Lern-App (Deutsch) im Stil einer Premium-Produktivitätsanwendung. Bestätigte Lernsessions bringen **Setup Credits (SC)** und **Erfahrungspunkte (XP)**. Credits werden im Shop für reale Belohnungen „freigeschaltet“. Eine Freischaltung ist eine virtuelle Erlaubnis, sich zu belohnen – es wird nichts bestellt oder bezahlt.

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Domänen- & Akzeptanztests (Vitest)
npm run build      # Typecheck + Produktions-Build
```

## Auf dem iPhone nutzen

SETUP QUEST ist eine installierbare Web-App (PWA): Vollbild ohne Safari-Leiste, eigenes App-Symbol, funktioniert offline.

1. App online stellen (siehe *Veröffentlichen*) und die URL in **Safari** auf dem iPhone öffnen.
2. Unten auf **Teilen** tippen → **Zum Home-Bildschirm**.
3. Ab jetzt immer über das App-Symbol öffnen.

Hinweise:
- Alle Daten liegen lokal auf dem iPhone (im Speicher der installierten App, getrennt von Safari-Tabs). Regelmäßig unter *Einstellungen → Daten → Exportieren* sichern („In Dateien sichern“, z. B. iCloud Drive).
- iOS pausiert Web-Apps bei gesperrtem Display. Läuft der Timer währenddessen, fragt die App beim Zurückkehren, ob die Zeit als Lernzeit zählt.
- Benachrichtigungen funktionieren auf dem iPhone nur in der installierten App (ab iOS 16.4) und nur, solange sie geöffnet ist.

## Veröffentlichen

`npm run build` erzeugt einen statischen Ordner `dist/`, der auf jedem HTTPS-Webspace läuft (relative Pfade, Hash-Routing – keine Server-Konfiguration nötig).

**GitHub Pages:** Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`. Einmalig in GitHub unter *Settings → Pages → Source* „GitHub Actions“ wählen. Die App ist dann unter `https://<nutzer>.github.io/<repo>/` erreichbar.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Motion · Lucide · Recharts · Zustand · Zod

## Regeln der Wirtschaft

| | Formel | Standard |
|---|---|---|
| Credits | Minuten × Rate × Gewichtung / 60 | 10 SC pro Stunde bei ×1 (90 Min. = 15 SC) |
| XP | Minuten × Rate × Gewichtung / 60 | 60 XP pro Stunde bei ×1 |
| Level | Level L beginnt bei 150 · L · (L − 1) XP | Level 2 bei 300 XP, Level 5 bei 3.000, Level 10 bei 13.500 |

**Fach-Gewichtung (Priorität):** Mathematik ×1,5 (8 Schulstunden pro Woche, doppelt so viele wie die anderen Fächer) · Programmieren (CS50x, CS50P) ×1,2 · Elektrotechnik ×1 · Digitalrechner ×1 · Vorlesungen ×0,75 · Video-Schnitt (Social Media) ×0,5 · Sonstiges ×0,5. Die Gewichtung wird pro Session gespeichert; spätere Änderungen gelten nur für neue Sessions.

**Wochenziele:** optional pro Fach unter *Einstellungen → Lernkategorien & Wochenziele*; sobald eines gesetzt ist, erscheint der Wochenplan auf dem Dashboard.

**Belohnungen:** Mauspad 150 SC · MX Master 3S 400 SC · Lofree Flow 2 700 SC · DT 900 PRO X 800 SC · FlexiSpot E7 Pro 2.500 SC (gesamt 4.550 SC ≈ 455 h bei ×1).

- Credits werden intern als ganzzahlige **Centi-Credits** (1 SC = 100) gespeichert – keine Gleitkommafehler.
- Das Guthaben ist die **Summe eines Ledgers** (`session_earn`, `session_adjust`, `session_revoke`, `purchase`, `refund`). Es gibt keinen separat gespeicherten Kontostand.
- XP, Level, Streaks, Statistiken und Erfolge werden immer aus den Sessions abgeleitet.
- Jede Session speichert die **Raten zum Zeitpunkt der Erfassung**. Geänderte Raten gelten nur für neue Sessions; auch beim Bearbeiten alter Sessions bleibt deren Rate.
- Freischaltungen speichern ihren **Preis zum Kaufzeitpunkt**; Erstattungen zahlen genau diesen Betrag zurück.
- Sessions werden über ihre ID genau einmal gutgeschrieben (Timer-Sessions erhalten die ID schon beim Start).
- Bearbeiten/Löschen von Sessions, das das Guthaben negativ machen würde, wird abgelehnt.

## Live-Timer

Der Timer basiert auf Zeitstempeln (laufende Segmente + angesammelte Zeit), zählt keine Pausen und überlebt Reloads. Ein Heartbeat erkennt geschlossene App, gesperrtes iPhone oder Standby: Fehlt er länger als 3 Minuten, fragt die App beim Zurückkehren, ob diese Zeit mitzählt – sonst wird sie abgezogen. Nichts wird stillschweigend gezählt; vorher kann die Session weder pausiert noch abgeschlossen werden. Die bestätigte Zeit darf die gemessene nie überschreiten.

## Architektur

```
src/
  domain/      Reine Geschäftslogik ohne React (Typen, Ledger, Befehle, Statistiken, Erfolge, Validierung)
  store/       Zustand-Store + Persistenz-Adapter (localStorage, Tab-Synchronisation)
  components/  UI-Bausteine, Layout, Overlays, Shop-/Lern-Komponenten
  pages/       Dashboard, Lernen, Shop, Fortschritt, Erfolge, Einstellungen
```

Alle Mutationen laufen über die reinen Funktionen in `src/domain/commands.ts`. Die Persistenz ist hinter `PersistenceAdapter` gekapselt – ein Supabase-Adapter (inkl. Auth) kann den lokalen Adapter ersetzen, ohne die Geschäftslogik zu ändern; dieselben Befehle lassen sich serverseitig wiederverwenden.

## Bedienung

- `⌘K` / `Strg+K` – Befehlspalette
- `1`–`6` – zu den Bereichen springen
- Fokus-Modus auf der Lernseite blendet die Navigation aus
- Export/Import (JSON, vollständig validiert) unter Einstellungen → Daten
