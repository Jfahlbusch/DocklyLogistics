# SFTP-Box — separater EDI-Austauschserver (Setup)

DocklyLogistics ist **Client**. Dieser Server ist die gemeinsame Ablage zwischen der
Warenwirtschaft (WaWi) und DocklyLogistics — bewusst **getrennt** von der App-VM, damit
deren Härtung unangetastet bleibt.

## Prinzip
```
   SFTP-Box (eigene kleine Scaleway-Instanz)
   /home/<tenant>/outbox   ← WaWi legt fertiges EDIFACT ab → DocklyLogistics holt+versendet
   /home/<tenant>/inbox    ← DocklyLogistics legt empfangene Dokumente (XML) ab → WaWi holt
   (outbox/sent, outbox/error legt DocklyLogistics automatisch an)
```

## 1. Instanz anlegen (Scaleway-Konsole)
- Kleinste Instanz reicht (z. B. **DEV1-S**), Ubuntu LTS.
- **In dasselbe Private Network / VPC wie die App-VM** hängen → DocklyLogistics erreicht die
  Box privat (172.16.x). SFTP muss dann **nach außen nur für die WaWi-IP(s)** offen sein.
- Docker installieren: `curl -fsSL https://get.docker.com | sh`

## 2. `docker-compose.yml` (atmoz/sftp, chroot je Tenant)
```yaml
services:
  sftp:
    image: atmoz/sftp:alpine
    ports:
      - "2222:22"                     # extern nur für WaWi freigeben (Firewall/Security Group)
    volumes:
      - ./users.conf:/etc/sftp/users.conf:ro
      - ./keys/dockly.pub:/home/brotmanufaktur/.ssh/keys/dockly.pub:ro   # DocklyLogistics-Pubkey
      - ./keys/wawi.pub:/home/brotmanufaktur/.ssh/keys/wawi.pub:ro       # WaWi-Pubkey
      - ./data/brotmanufaktur/outbox:/home/brotmanufaktur/outbox
      - ./data/brotmanufaktur/inbox:/home/brotmanufaktur/inbox
    restart: unless-stopped
```
`users.conf` — ein chroot-User je Tenant (Key-Auth, kein Passwort):
```
brotmanufaktur::1001
```
(Verzeichnisse `outbox`/`inbox` werden über die Volumes bereitgestellt; `atmoz/sftp` chrootet
den User auf `/home/brotmanufaktur`.)

## 3. Schlüssel
- **DocklyLogistics** braucht einen eigenen Schlüssel. Erzeuge das Paar (z. B. lokal):
  `ssh-keygen -t ed25519 -f dockly -N ""` → `dockly.pub` auf die Box (siehe Volume),
  den **privaten** Key `dockly` trägst du in DocklyLogistics ein (Einstellungen → EDI → SFTP,
  Auth = „Privater Schlüssel").
- **WaWi** liefert ihren Public Key → als zweiten Key beim selben User hinterlegen (die WaWi
  liest `outbox`, schreibt ggf. `inbox`; DocklyLogistics liest/schreibt gegengleich).
- Beide teilen sich denselben Tenant-User/-Ordner — die Trennung erfolgt über die IP-Firewall
  und die Ordner-Semantik. (Getrennte User pro Rolle sind möglich, wenn ihr strengere
  Rechte wollt.)

## 4. Firewall (Scaleway Security Group)
- **Eingehend erlauben:** Port `2222` (SFTP) **nur** von der/den **WaWi-IP(s)** und der
  **privaten IP der App-VM**. Alles andere DROP. SSH-Admin (22) getrennt und nur für euch.

## 5. Host-Key-Fingerprint (empfohlen, MITM-Schutz)
Nach dem Start:
```
ssh-keyscan -p 2222 <box-ip> 2>/dev/null | ssh-keygen -lf - -E sha256
```
Den `SHA256:...`-Wert in DocklyLogistics unter „Host-Key-Fingerprint" eintragen.

## 6. In DocklyLogistics eintragen (Einstellungen → EDI → SFTP-Anbindung)
- Host = private IP der Box, Port = 2222, Benutzer = `brotmanufaktur`
- Auth = Privater Schlüssel → den `dockly`-Private-Key einfügen
- Ausgangsordner `/outbox`, Eingangsordner `/inbox` (relativ zum chroot)
- „Verbindung testen" → muss „Verbunden" melden.

## 7. Betrieb
- **Ausgang:** WaWi legt fertiges EDIFACT (z. B. INVOIC mit Empfänger-GLN im UNB) in `outbox`.
  Der DocklyLogistics-Cron (alle paar Minuten) versendet es an den Partner (AS2 …),
  verschiebt die Datei nach `outbox/sent` bzw. `outbox/error` und zeigt alles im EDI-Monitor.
- **Eingang:** Von Partnern empfangene Bestellungen legt DocklyLogistics als XML in `inbox`;
  die WaWi holt sie ab.
