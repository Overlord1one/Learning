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

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Motion · Lucide · Recharts · Zustand · Zod

## Regeln der Wirtschaft

| | Formel | Standard |
|---|---|---|
| Credits | Minuten × Rate / 60 | 10 SC pro Stunde (90 Min. = 15 SC) |
| XP | Minuten × Rate / 60 | 60 XP pro Stunde |
| Level | ⌊XP / 300⌋ + 1 | Level 2 bei 5 h |

- Credits werden intern als ganzzahlige **Centi-Credits** (1 SC = 100) gespeichert – keine Gleitkommafehler.
- Das Guthaben ist die **Summe eines Ledgers** (`session_earn`, `session_adjust`, `session_revoke`, `purchase`, `refund`). Es gibt keinen separat gespeicherten Kontostand.
- XP, Level, Streaks, Statistiken und Erfolge werden immer aus den Sessions abgeleitet.
- Jede Session speichert die **Raten zum Zeitpunkt der Erfassung**. Geänderte Raten gelten nur für neue Sessions; auch beim Bearbeiten alter Sessions bleibt deren Rate.
- Freischaltungen speichern ihren **Preis zum Kaufzeitpunkt**; Erstattungen zahlen genau diesen Betrag zurück.
- Sessions werden über ihre ID genau einmal gutgeschrieben (Timer-Sessions erhalten die ID schon beim Start).
- Bearbeiten/Löschen von Sessions, das das Guthaben negativ machen würde, wird abgelehnt.

## Live-Timer

Der Timer basiert auf Zeitstempeln (laufende Segmente + angesammelte Zeit), zählt keine Pausen und überlebt Reloads. Ein Heartbeat erkennt geschlossene Tabs bzw. Standby: Fehlt er länger als 3 Minuten, wird der Timer am letzten bestätigten Zeitpunkt pausiert. Die bestätigte Zeit darf die gemessene nie überschreiten.

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
