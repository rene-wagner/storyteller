---
description: Implement one roadmap phase or task using subagents, validate, create a feature branch, and commit
argument-hint: "<Phase N|Task N>"
---

# Roadmap-Implementierung

Implementiere die Phase oder den Task aus `@docs/development/ROADMAP.md`, den der Benutzer als **positive ganze Zahl** angibt.

## Eingabe

Benutzereingabe: $ARGUMENTS

- Akzeptiere genau eine positive ganze Zahl `N`.
- Interpretiere `Phase N` als die vollständige Roadmap-Phase `Phase N`.
- Interpretiere `Task N` als genau den Eintrag `TASK-NNN` (z. B. `Task 7` entspricht `TASK-007`).
- Wenn der Benutzer nur eine Zahl ohne Bezeichnung angibt, frage nach, ob sie eine Phase oder einen Task meint. Rate nicht.
- Lehne null, negative Zahlen, Dezimalzahlen, mehrere Zahlen sowie nicht vorhandene Phasen oder Tasks ab. Nimm keine Änderungen vor, bis die Eingabe gültig ist.
- Für eine Phase gelten ausschließlich die innerhalb dieser Phase aufgeführten Roadmap-Tasks. Implementiere keine spätere Phase. Für einen Task gilt ausschließlich dieser Task.

## Ablauf

1. Lies die gewählte Phase bzw. den Task vollständig aus `@docs/development/ROADMAP.md`, einschließlich Goal, Tasks, Result und Definition of Done. Lies zusätzlich die allgemeinen Agent Rules und das passende `AGENTS.md`. Prüfe Arbeitsbaum und Branch, bevor du etwas änderst. Bewahre bestehende Benutzeränderungen.
2. Verwende Subagents zwingend für die Implementierung. Aktiviere die Subagent-Funktionen und delegiere die abgegrenzte Implementierungsarbeit mit dem vollständigen Roadmap-Kontext und den Projektregeln. Lass Subagents niemals Commits oder Branch-Wechsel ausführen. Bei einer Phase mit mehreren Tasks können unabhängige Arbeiten parallel delegiert werden; abhängig aufeinander aufbauende Arbeiten müssen sequenziell erfolgen. Integriere und überprüfe alle Ergebnisse selbst. Kannst du keine Subagents verwenden, stoppe vor Änderungen und melde das Hindernis.
3. Implementiere nur den ausgewählten Umfang. Ergänze oder aktualisiere geeignete Tests und Dokumentation. Prüfe den Diff auf versehentliche Änderungen und darauf, dass keine bestehenden Benutzeränderungen überschrieben wurden.
4. Führe `pnpm validate` aus. Wenn es fehlschlägt, untersuche und behebe taskbedingte Fehler und führe die Validierung erneut aus. Erstelle weder Branch noch Commit, solange die Implementierung nicht erfolgreich ist und `pnpm validate` nicht erfolgreich abgeschlossen wurde. Wenn die Fehler nicht behoben werden können, stoppe ohne Branch/Commit und berichte die Fehler.
5. Erstelle nach erfolgreicher Validierung einen Feature-Branch für diese Arbeit. Verwende einen kurzen, sprechenden Namen mit Präfix `feature/`, zum Beispiel `feature/task-007-project-schema` oder `feature/phase-03-database-foundation`. Prüfe vor dem Wechsel, ob der Branchname bereits existiert. Überschreibe keinen existierenden Branch; wähle dann einen eindeutigen Namenszusatz.
6. Erstelle einen passenden Conventional Commit für ausschließlich die Änderungen dieses Umfangs. Du musst nicht nachfragen, ob die Commit-Beschreibung passt. Füge keine vorher bestehenden Benutzeränderungen hinzu. Verwende kein `git add -A`; stage nur die Dateien dieser Implementierung. Committe auf dem neu erstellten Feature-Branch.
7. Prüfe abschließend `git status` und den letzten Commit. Falls Branch-Erstellung oder Commit fehlschlägt, stoppe, bewahre Änderungen und melde den Grund. Push oder Pull Request sind nicht verlangt.

## Abschlussbericht

Antworte auf Deutsch und nenne:

- ausgewählte Phase oder Task;
- umgesetzte Änderungen und wichtige Dateien;
- verwendete Subagents und wesentliche Entscheidungen;
- Ergebnis von `pnpm validate`;
- Branch-Name und Commit-Hash, sofern erstellt;
- verbleibende, auf diesen Umfang bezogene Probleme.

Behaupte nicht, dass Checks, Branch oder Commit erfolgreich waren, wenn sie nicht erfolgreich ausgeführt wurden.
