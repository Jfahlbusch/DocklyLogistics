# Security-Review: DocklyLogistics (logistics.dockly.de) — 2026-06-23

## Zusammenfassung
Die Prod-VM (Scaleway `51.15.219.21`) ist grundsolide aufgesetzt: nach außen lauschen **nur 22/80/443**, der App-Container ist an `127.0.0.1:3000` gebunden (nicht öffentlich), Caddy terminiert TLS automatisch, der Container läuft als non-root (`nextjs`), `unattended-upgrades` ist aktiv, und es liegen **keine Secrets im Git**. Der klassische Fehler dieses Stacks (Postgres/Redis offen ins Internet) ist hier **nicht** vorhanden — die App nutzt die gemanagte Scaleway-DB über den **privaten** Endpunkt. Die größten verbleibenden Risiken sind: der **öffentliche DB-Endpunkt** der gemanagten DB, der **SSH-Zugang** (20 hinterlegte Keys, kein fail2ban, Passwort-Login nicht explizit aus), die fehlende Bestätigung der **Scaleway Security Group**, fehlende **Security-Header** am Edge und eine **SSRF-Fläche** im Webhook-/API-Versand. Keine akut-kritische, unauthentifiziert ausnutzbare Lücke gefunden.

## Sofortmaßnahmen (jetzt, nicht warten)
1. **Öffentlichen Endpunkt der gemanagten DB prüfen/schließen.** Der Migrations-Pfad nutzt `51.159.26.23:7205` (öffentlich). Die App selbst braucht ihn nicht (sie verbindet über den privaten Endpunkt `172.16.8.4:5432`). → In der Scaleway-Konsole die **ACL** der Database-Instanz prüfen; ist sie offen (`0.0.0.0/0`), auf die nötigen IPs einschränken oder den öffentlichen Endpunkt **deaktivieren** (Migrationen dann von der VM über den privaten Endpunkt fahren).
2. **Scaleway Security Group bestätigen.** Sicherstellen, dass an der Instanz eine Security Group hängt mit Default-Eingang = DROP und nur **22/80/443** erlaubt — Docker umgeht UFW, die SG ist die maßgebliche Sperre.

## Funde
| # | Kategorie | Schwere | Fundort | Beschreibung | Empfehlung |
|---|-----------|---------|---------|--------------|------------|
| 1 | Netz-Exposition | **Hoch** | Scaleway Managed DB `51.159.26.23:7205` | DB hat einen öffentlichen Endpunkt; erreichbar aus dem Internet (nur durch Credentials + TLS geschützt). App braucht ihn nicht (privater Endpunkt). | ACL auf nötige IPs einschränken **oder** öffentlichen Endpunkt deaktivieren. |
| 2 | SSH & Zugang | **Hoch** | `~/.ssh/authorized_keys` (root) | **20 hinterlegte Keys** — viele/alte Zugänge sind je eine Angriffsfläche. | Datei frisch + minimal aufsetzen, nur aktuelle eigene Keys. Alte entfernen. |
| 3 | SSH & Zugang | Mittel | `/etc/ssh/sshd_config` | `PasswordAuthentication` / `PermitRootLogin` **nicht explizit gesetzt** (Default greift, ggf. Passwort-Login an). | `PasswordAuthentication no`, `PermitRootLogin prohibit-password`. Sichere Reihenfolge (Zweit-Session!). |
| 4 | SSH & Zugang | Mittel | VM (kein fail2ban) | Kein Brute-Force-Schutz für SSH. | `apt install fail2ban`, sshd-Jail an. |
| 5 | Cloud-Firewall | Mittel | Scaleway Security Group | Nicht bestätigt, dass eine restriktive SG aktiv ist (UFW ist nicht installiert). | SG mit Default-DROP + nur 22/80/443 setzen/prüfen. |
| 6 | Edge / TLS | Mittel | `/opt/logistics/Caddyfile` | **Keine Security-Header** (HSTS, `X-Content-Type-Options`, CSP/`frame-ancestors`, `Referrer-Policy`). | Header-Block in Caddy ergänzen (Diff liegt bereit). |
| 7 | App-Layer (SSRF) | Mittel | `lib/channels/api.ts`, `webhook-worker.ts` | Versand postet an **frei konfigurierbare URLs** (Supplier/Webhook) ohne Sperre interner Ziele (`127.0.0.1`, `169.254.169.254`, RFC-1918). | Ausgehende Ziel-URLs gegen interne Bereiche/Metadata-IP allowlisten/blocken. |
| 8 | System & Updates | Mittel | VM | **19 ausstehende Paket-Updates** (unattended-upgrades aktiv, aber nicht alles eingespielt). | `apt update && apt full-upgrade` (Reboot-Fenster bei Kernel). |
| 9 | Backup & Monitoring | Mittel | VM | **Keine Anomalie-/CPU-Last-Erkennung** — der bekannte Miner-Vorfall fiel erst bei 95 % CPU auf. | CPU-Last-Alarm (Cron) + Exposure-Drift-Scan (siehe unten). Managed-DB-Backups + Offsite bestätigen. |
| 10 | Container-Härtung | Niedrig | `/opt/logistics/docker-compose.yml` | App-Container ohne `no-new-privileges` / `cap_drop` (läuft aber bereits als non-root). | `security_opt: ["no-new-privileges:true"]`, `cap_drop: ["ALL"]`. |
| 11 | Secrets | Niedrig | `docker-compose.yml` (lokal) | Lokale Dev-Compose mit schwachem DB-Passwort `docklylogistics` und `5432:5432` auf `0.0.0.0`. Nur lokaler Rechner, nicht Prod. | An `127.0.0.1` binden; Dev-Passwort egal, aber Muster vermeiden. |
| — | Edge / DSGVO | **behoben** | `app/layout.tsx` | Fonts liefen über Google Fonts (Laufzeit-/Build-Abruf → DSGVO + Supply-Chain). | **Self-hosted** (`next/font/local`, woff2 in `app/fonts/`) ✓ — diese Session. |
| — | AuthZ / Multi-Tenant | **gut** | `lib/api/guard.ts`, Repos | Jede Route prüft `requireRoleFromHeaders`; Repos sind tenant-gescoped; neue Funktions-Berechtigungen serverseitig durchgesetzt. | — |

## Angriffsflächen-Übersicht (Prod-VM)
| Port/Dienst | von außen erreichbar? | soll er das? | Maßnahme |
|---|---|---|---|
| 22/tcp SSH | ja (`0.0.0.0:22`) | ja | härten (Keys/fail2ban/PW-Login) |
| 80/tcp Caddy | ja | ja (HTTP→HTTPS) | ok |
| 443/tcp Caddy | ja | ja | Security-Header ergänzen |
| 3000/tcp App | **nein** (`127.0.0.1`) | nein | ✓ korrekt intern |
| 53 systemd-resolved | nein (localhost) | nein | ✓ |
| Managed-DB `…:7205` | **ja (öffentl. Endpunkt)** | **nein** | ACL einschränken / Endpunkt deaktivieren (Fund 1) |

## Empfohlene Maßnahmen (priorisiert)
1. **DB-ACL/öffentlichen Endpunkt schließen** — Aufwand S, Risiko niedrig (App nutzt privaten Endpunkt). Rückweg: ACL/Endpunkt wieder aktivieren.
2. **Security Group bestätigen/setzen** — S, niedrig. Rückweg: SG-Regeln sind in der Konsole reversibel; **zuerst 22 erlauben**, dann DROP-Default.
3. **SSH härten** — S, mittel (Lockout-Gefahr). Rückweg: Zweit-Session offen, `sshd -t` + reload, neuer Login testen, dann erst alte Session schließen.
4. **fail2ban** — S, niedrig. Rückweg: deinstallieren.
5. **Security-Header in Caddy** — S, niedrig. Rückweg: Header-Block entfernen + reload.
6. **SSRF-Schutz im Versand** — M, niedrig. Rückweg: Allowlist-Check ist additiv, abschaltbar.
7. **`apt full-upgrade`** — S, niedrig–mittel (Reboot). Rückweg: Snapshot vor Upgrade.
8. **CPU-Last-Alarm + Exposure-Drift-Scan** — S, niedrig. Rein additiv.
9. **Container-`no-new-privileges`/`cap_drop`** — S, niedrig. Rückweg: Flags entfernen.

> Eingriffe werden erst nach Freigabe angewendet; ich liefere je Maßnahme fertige Befehle/Diffs und den Verifikationsschritt. Zwei klassische Lockouts (SSH, Firewall) gehe ich nur mit offener Zweit-Session und Test-zuerst an.
