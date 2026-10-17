# Mobil- und Tablet-Audit — 17.10.2026 (T15, B9/B10)

Zwei Quellen: **Live-Messung** auf logistics.dockly.de (Mandant demo) per Skript bei 375 × 812, 768 × 1024 und 1024 × 768, und ein
**statischer Code-Audit** aller Dateien unter `app/(app)/**` und der genutzten `components/**` (124 Funde F-M1…F-M124, je mit Datei:Zeile).

## Live-Messung

| Route | 375 px: seitl. Scrollen | 375 px: sichtbare Tabelle | 375 px: Inputs < 16 px | 375 px: Ziele < 44 px | 768/1024 px: Tabelle (Inhalt/verfügbar) |
|---|---|---|---|---|---|
| /dashboard | nein | – | 0 | 1 | – |
| /order-suggestions | nein | – (Karten) | 32 (Selects/Mengen in Karten) | 54 | **1098 / 662–698 → scrollt** |
| /orders | nein | – (Karten) | 2 | 4 | **832 / 662–698 → scrollt** |
| /edi | nein | – | 1 | 4 | **772 / 668–704 → scrollt** |
| /reports | nein | **450 px** | 0 | 1 | passt |
| /stock | nein | **693 + 391 px** | 0 | 18 | **693 / 662 (quer) → scrollt** |
| /warehouse-mode | nein | – | 0 | 8 (Knöpfe 36 px) | – |
| /articles | nein | – (Karten) | 1 | 3 | **936 / 662–698 → scrollt** |
| /suppliers | nein | – | 0 | 6 | – |
| /audit | nein | **764 px** | 1 | 17 | **764 / 662–698 → scrollt** |
| /settings | nein (375) / **ja bei 1024 × 768** (Tab-Leiste +7 px) | – | 0 | 14 (Tabs 25 px) | – |
| /admin | nein | – | 0 | 2 (Tabs 25 px) | passt |

Muster: Basis-Knöpfe 36 px, Chips/Tabs 25–30 px, native Selects 14 px (iOS zoomt beim Fokus). Auf **Tablets** zeigen alle
Listen ab 768 px die Desktop-Tabelle, die aber erst ab ~1100 px Inhaltsbreite passt → internes Seitwärts-Scrollen.
Hoch- und Querformat-Tablet liegen beide unter dem Menü-Breakpoint (992 px) bzw. knapp darüber: 768 → Drawer + Tab-Leiste, 1024 → Leiste + ~730 px Inhalt.

## Statischer Audit — Zusammenfassung

| Kategorie | Funde | Schwerpunkt |
|---|---|---|
| TAB (Tabelle ohne Karten) | 9 | /audit, /stock Lagerplätze, /reports, Positions-Grid Bestelldetail; Rest Detail-Modals |
| DLG (Dialog statt Bottom-Sheet) | 21 Dialoge | davon **7 handgebaute Overlays ohne Focus-Trap/Escape** (Wareneingang, Inventur, Neuer Webhook, Auslieferungen, Lieferanten-API-Key, Bestand korrigieren, ⌘K) |
| INP (Schrift < 16 px, inputmode) | 30 | native `<select>`/`<textarea>` fast überall `text-sm`/`text-xs`; fehlende `inputMode`/`type`/`autoCapitalize` |
| TCH (Ziel < 44 px) | 38 | Basis-`Button` h-9/h-7, `px-2 py-1 text-xs`-Knöpfe, Chips, `h-4 w-4`-Checkboxen, Text-Links |
| HOV (nur Hover) | 3 | Begründung nur im `title`, Diagrammwerte nur im Tooltip |
| OVF (Überlauf) | 18 | Tab-Leisten (Settings 8 Tabs), `DetailField` w-44, `grid-cols-[2fr_1fr_…]` ohne Mobil-Reduktion |

Hebel (behebt viele Funde auf einmal): `components/ui/button.tsx` (F-M115), `tabs.tsx` (F-M116), `input.tsx` (F-M118),
`detail-field.tsx` (F-M12), ein gemeinsamer Select-/Textarea-Stil, ein responsiver Dialog (F-M117; Vorlage `app/(app)/stock/zones-panel.tsx`).
Vorlagen im Bestand: `zones-panel.tsx` (Dialog ↔ Bottom-Sheet), `zone-form.tsx` (Touch-Größen), `components/warehouse/*` (44-px-Ziele).

Die vollständige Fundtabelle F-M1…F-M124 (Datei:Zeile, Kategorie, Vorschlag) steht im Anhang unten.

## Anhang: Fundtabelle F-M1…F-M124

| F-M# | Seite/Route | Datei:Zeile | Kategorie | Fund (konkret) | Vorschlag | Aufwand |
|---|---|---|---|---|---|---|
| F-M1 | /admin | admin/admin-view.tsx:265–266 | TCH | Buttons "Bearbeiten"/"Löschen" `px-2 py-1 text-xs` (ca. 26 px) | `max-md:h-11` bzw. Button-Variante | S |
| F-M2 | /admin | admin/admin-view.tsx:283, 368 | DLG | Tenant-Funktionen-Dialog und Funktionsprofil-Formular zentriert; `max-h-[85vh]` (vh statt dvh) überschreibt das `dvh`-Limit des Dialogs | auf responsiven Dialog umstellen, `max-h`-Override entfernen | M |
| F-M3 | /admin | admin/admin-view.tsx:297 | INP | select Funktionsprofil `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M4 | /admin | admin/admin-view.tsx:335–351 | TCH | Segment-Buttons Profil/Erlaubt/Gesperrt `px-2.5 py-1.5 text-xs` (ca. 30 px) | `max-md:min-h-11` | S |
| F-M5 | /admin | admin/admin-view.tsx:407–417 | TCH | Checkbox `h-4 w-4` (16 px). Ausnahme?: die ganze Label-Zeile (`py-2.5`, ca. 40 px) ist klickbar | Checkbox `size-5` mobil, Zeile `min-h-11` | S |
| F-M6 | /articles | articles/articles-view.tsx:118 | INP | Kategorie-select `text-sm`, ohne `value`/`onChange` (wirkungslos) | wirkungslos entfernen oder anbinden, dann `text-base` | S |
| F-M7 | /articles | articles/articles-view.tsx:112–116 | INP | Suchfeld ohne `type="search"`/`enterKeyHint="search"`/`autoCapitalize="none"` | Attribute ergänzen | S |
| F-M8 | /articles | articles/articles-view.tsx:248 | DLG | Dialog "Neuer Artikel" (langes Formular) | Bottom-Sheet | M |
| F-M9 | /articles | articles/article-detail-modal.tsx:210 | DLG | Artikel-Detail mit Tabs und Edit-Formular, zentriert | Bottom-Sheet | M |
| F-M10 | /articles | articles/article-detail-modal.tsx:553 | DLG | Dialog "Lieferant zuordnen" (Formular) | Bottom-Sheet | M |
| F-M11 | /articles | articles/article-detail-modal.tsx:239–244 | OVF, TCH | 4 Tabs "Stamm / Lieferanten (n) / Barcode / Bestand" in `w-fit`, `nowrap`, `h-8` bei ca. 311 px Modalbreite | Tabs-Leiste scrollbar (`overflow-x-auto`) und `h-11` mobil | S |
| F-M12 | /articles | articles/article-detail-modal.tsx:247–260 und components/ui/detail-field.tsx:13 | OVF | `DetailField`: fester Label-Block `w-44` (176 px) `flex-shrink-0`, Wert ohne `min-w-0`/`break-all`; EAN, SKU und lange Texte quetschen oder laufen über | `flex-col` mobil (`sm:flex-row`), Wert `min-w-0 break-words` | S |
| F-M13 | /articles | articles/article-detail-modal.tsx:295–364 | TAB | Tabelle mit 8 Spalten (Lieferant, Kanal, EK, Lieferzeit, Min, Lief.-SKU, Primär, Aktionen) im Detail-Modal. Ausnahme? (Detail-Modal), praktisch aber nur per Scroll im Scroll nutzbar | Karten-Liste `md:hidden` | M |
| F-M14 | /articles | articles/article-detail-modal.tsx:332–358, 413–426, 427–450 | TCH | Text-Links `text-xs underline` ("als primär", "Bearbeiten", "Löschen", PNG/SVG/Drucken) ohne Padding | als Buttons mit `min-h-11` | S |
| F-M15 | /articles | articles/article-detail-modal.tsx:264–281 | OVF, TCH | Kopfzeile `flex justify-between` ohne `flex-wrap`: langer Hinweistext neben Button `size="sm"` (28 px) | `flex-wrap`, Button `h-11` mobil | S |
| F-M16 | /articles | articles/article-form.tsx:193 | INP | Beschreibung-textarea `text-sm` | `text-base md:text-sm` | S |
| F-M17 | /articles | articles/article-form.tsx:235, 254 | INP | `type="number"` Verpackungsfaktor/MwSt (Dezimal) ohne `inputMode`. Kategorie (200) und SKU (158) ohne `autoCapitalize` | `inputMode="numeric"` bzw. `"decimal"` | S |
| F-M18 | /articles | articles/article-supplier-form.tsx:98 | INP | Lieferanten-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M19 | /articles | articles/article-supplier-form.tsx:117, 138, 147 | INP | `type="number"` ohne `inputMode`. Preis braucht `"decimal"`, Tage/Menge `"numeric"` | `inputMode` ergänzen | S |
| F-M20 | /articles | articles/article-supplier-form.tsx:164 und articles/article-detail-modal.tsx:512–534 | TCH | Checkbox in Label ohne Mindesthöhe; Buttons Löschen/Bearbeiten default h-9 | wie `zone-form.tsx` (`min-h-11`, `size-5`) | S |
| F-M21 | /audit | audit/audit-view.tsx:205–291 | TAB | Datentabelle mit 6 Spalten und aufklappbarer Detailzeile (Vorher/Nachher), keine Karten-Variante, `overflow-x-auto` ohne `hidden md:block` | Tabelle `hidden md:block`, Karten `md:hidden` mit Expand | M |
| F-M22 | /audit | audit/audit-view.tsx:169–180 | INP | Entitäten-select ohne Größenklasse, erbt `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M23 | /audit | audit/audit-view.tsx:250–255 | TCH | "anzeigen/ausblenden" `text-xs underline` ohne Fläche | Button `min-h-11` | S |
| F-M24 | /audit | audit/audit-view.tsx:246 | HOV | Voller Hash steht nur im `title` (Hover), mobil ohne Tastatur nicht lesbar; im aufgeklappten Bereich steht er aber in 279–282 | Hash in der Karte/Detail sichtbar lassen | S |
| F-M25 | /audit | audit/audit-view.tsx:279–282 | OVF | `hash:`/`prevHash:` (64 Hex-Zeichen, Mono) ohne `break-all` | `break-all` | S |
| F-M26 | /dashboard | dashboard/page.tsx:51 | TCH | Link "Alle Artikel" `text-xs underline` ohne Fläche | `inline-flex min-h-11 items-center` | S |
| F-M27 | /edi | edi/edi-view.tsx:161–173 | TCH | Filter-Chips "Alle/Eingang/Ausgang" `px-3 py-1.5 text-xs` (ca. 30 px) | `max-md:min-h-11` | S |
| F-M28 | /edi | edi/edi-view.tsx:176–185 | INP | Status-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M29 | /edi | edi/edi-view.tsx:188, 192 | TCH | Pager-Buttons `px-2 py-1 text-xs` | `max-md:h-11` | S |
| F-M30 | /edi | edi/edi-view.tsx:274 | DLG | EDI-Nachricht-Detail (lang), `max-h-[85vh]` überschreibt `dvh` | Bottom-Sheet, `max-h`-Override entfernen | M |
| F-M31 | /edi | edi/edi-view.tsx:328–356 | TAB | Positions-Tabelle (5 Spalten) im Detail-Modal. Ausnahme?: mit `overflow-x-auto` gekapselt | optional Karten, sonst Ausnahme dokumentieren | S |
| F-M32 | /edi | edi/edi-view.tsx:368–378 | TCH | Buttons `text-xs` default h-9 | über Button-Anpassung (Querschnitt) | S |
| F-M33 | /order-suggestions | order-suggestions/suggestions-view.tsx:202–219 | OVF, TCH | Filter-Chips `flex gap-1` ohne `flex-wrap`: 4 Chips ("Alle", "PENDING", "CONFIRMED", "DISMISSED") `px-3 py-1.5 text-xs`, knapp an der 343-px-Breite | `flex-wrap`, `min-h-11` | S |
| F-M34 | /order-suggestions | order-suggestions/suggestions-view.tsx:373–378 | TCH | Karten-Checkbox `h-4 w-4` (16 px) | `size-5`, Treffer-Label `min-h-11` | S |
| F-M35 | /order-suggestions | order-suggestions/suggestions-view.tsx:405–425 | INP, TCH | Mobile Karte: select `px-2 py-1.5 text-sm` und Mengen-Input `type="number" w-20 text-sm` (14 px, ca. 34 px hoch), natives `<input>` statt `Input`; kein `inputMode="numeric"` | `Input` bzw. `text-base h-11`, `inputMode="numeric"` | S |
| F-M36 | /order-suggestions | order-suggestions/suggestions-view.tsx:437–452 | TCH | Karten-Buttons "Speichern"/"Verwerfen" `px-2.5 py-1 text-xs` (ca. 26 px) | `max-md:h-11 text-sm` | S |
| F-M37 | /order-suggestions | order-suggestions/suggestions-view.tsx:166–186 | TCH | Kopf-Buttons `text-sm` default h-9 | Querschnitt | S |
| F-M38 | /orders | orders/orders-view.tsx:86, 92 | INP | Status-/Lieferanten-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M39 | /orders | orders/orders-view.tsx:85 | INP | Suchfeld ohne `type="search"`/`enterKeyHint` | Attribute ergänzen | S |
| F-M40 | /orders | orders/orders-view.tsx:77 | HOV | "+ Neue Bestellung" ist `disabled`, die Begründung steht nur im `title` (Tooltip, mobil unsichtbar) | Hinweis sichtbar als Text | S |
| F-M41 | /orders | orders/order-detail-modal.tsx:114 | DLG | Bestelldetail (lang, mit Aktionen), zentriert | Bottom-Sheet | M |
| F-M42 | /orders | orders/order-detail-modal.tsx:149–171 | OVF, TAB | Positions-"Tabelle" aus Div-Grid `grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3` (5 Spalten, ohne mobile Reduktion) bei ca. 311 px: Spalten ca. 45 px, "Erhalten"/EK/Summe laufen über | Positionskarten `md:hidden`, Grid ab `sm:` | M |
| F-M43 | /orders | orders/receive-modal.tsx:75 | DLG | Wareneingang buchen: handgebautes Overlay (`fixed inset-0`, z-[60]) statt Radix. Kein Focus-Trap, kein Escape, kein Scroll-Lock, kein `max-h`/`overflow` | auf gemeinsamen responsiven Dialog umstellen | M |
| F-M44 | /orders | orders/receive-modal.tsx:87–106 | OVF | je Position `grid-cols-[2fr_1fr_1.5fr]` mit Menge-Input und Lagerplatz-select nebeneinander (ca. 100 px und 90 px breit) | `grid-cols-1 sm:grid-cols-[...]` | S |
| F-M45 | /orders | orders/receive-modal.tsx:96 | INP | `Input` mit `className="text-sm"` hebt `text-base` auf (14 px). Dazu `type="number"` ohne `inputMode="numeric"` | `text-sm` entfernen, `inputMode="numeric"` | S |
| F-M46 | /orders | orders/receive-modal.tsx:98 | INP | Lagerplatz-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M47 | /reports | reports/reports-view.tsx:183–211 | TAB | "Lieferanten-Tabelle" (4 Spalten) ohne Karten-Variante; schmal, aber eigene Card außerhalb eines Grids. Ausnahme? unwahrscheinlich | Karten-Liste oder `hidden md:block` | S |
| F-M48 | /reports | reports/reports-view.tsx:113–133 | OVF | PieChart `outerRadius={100}` mit Außen-Labels `${status}: ${count}` in ca. 300 px Breite: Labels werden wahrscheinlich abgeschnitten | `outerRadius` responsiv, Legende statt Außen-Labels | S |
| F-M49 | /reports | reports/reports-view.tsx:149–173 | OVF | BarChart: 8 Lieferanten mit `interval={0}`, `angle={-12}` auf ca. 300 px, Labels überlagern sich | `interval="preserveStartEnd"` oder horizontale Balken | S |
| F-M50 | /reports | reports/reports-view.tsx:130, 168 | HOV | Werte nur im recharts-`Tooltip` (Hover/Tap). Bar-Chart ohne Datenlabels, Tabelle darunter liefert die Werte | Datenlabels oder Tabelle als Fallback | S |
| F-M51 | /settings | settings/settings-view.tsx:105–114 | OVF, TCH | 8 Tabs in einer `w-fit h-8 nowrap` TabsList ("Versand", "Tenant", "API-Dokumentation", …, "Benutzer & Rechte"): läuft sicher über 375 px hinaus, 32 px hoch | scrollbare Tab-Leiste (`overflow-x-auto`, `h-11`) oder Select-Navigation mobil | M |
| F-M52 | /settings | settings/settings-view.tsx:445–449 | OVF | Lokales `Field` mit `w-40 flex-shrink-0` Label; Keycloak-URL/-Client (Mono) im Tenant-Tab ohne `break-all` laufen über | `flex-col`, `break-all` | S |
| F-M53 | /settings | settings/settings-view.tsx:265 | DLG | Versand-Profil-Formular (JSON-Konfiguration), zentriert | Bottom-Sheet | M |
| F-M54 | /settings | settings/settings-view.tsx:196, 202, 216, 222 | TCH | Link-Buttons `px-4 py-2 text-sm` (ca. 36 px) | `min-h-11` | S |
| F-M55 | /settings | settings/channel-form.tsx:96 | INP | Kanal-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M56 | /settings | settings/channel-form.tsx:143 | INP | JSON-textarea `text-xs` (12 px) | `text-base md:text-xs` | S |
| F-M57 | /settings | settings/channel-form.tsx:119–136 | TCH | Checkboxen ohne Größenklasse, Labels ohne Mindesthöhe | wie `zone-form.tsx` | S |
| F-M58 | /settings | settings/sftp-section.tsx:128 | INP | Port-Input ohne `inputMode="numeric"`. Host (124), Benutzer (132), Fingerprint (189) ohne `autoCapitalize="none"`/`autoCorrect="off"`/`spellCheck={false}` | Attribute ergänzen | S |
| F-M59 | /settings | settings/sftp-section.tsx:136, 175, 182 | INP | 3 selects `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M60 | /settings | settings/sftp-section.tsx:156 | INP | Schlüssel-textarea `text-xs` | `text-base md:text-xs` | S |
| F-M61 | /settings | settings/sftp-section.tsx:195, 199 | TCH | Checkboxen `h-4 w-4` | `size-5`, Label `min-h-11` | S |
| F-M62 | /settings | settings/sftp-section.tsx:213–218 | TCH | Buttons `text-xs` default h-9 | Querschnitt | S |
| F-M63 | /settings | settings/edi-tab.tsx:279, 295–304 | TCH | 5 Partner-Buttons je Zeile `px-2 py-1 text-xs` (Bearbeiten/URL kopieren/Rotieren/Sperren/Löschen, ca. 26 px) | `max-md:h-11`, ggf. Overflow-Menü | S |
| F-M64 | /settings | settings/edi-tab.tsx:480 | DLG | Partner-Postfach-Formular (inkl. PEM-textarea), zentriert | Bottom-Sheet | M |
| F-M65 | /settings | settings/edi-tab.tsx:502, 537 | INP | GLN-Input ohne `inputMode="numeric"`; AS2-URL ohne `type="url"`/`autoCapitalize="none"` | Attribute ergänzen | S |
| F-M66 | /settings | settings/edi-tab.tsx:509 | INP | Lieferanten-select `text-sm` | `text-base md:text-sm` | S |
| F-M67 | /settings | settings/edi-tab.tsx:545–554 | INP | PEM-textarea `text-xs` | `text-base md:text-xs` | S |
| F-M68 | /settings | settings/edi-tab.tsx:414–431 | TCH | Checkboxen `h-4 w-4`. Ausnahme?: Label mit mehrzeiligem Text ist klickbar | `size-5` | S |
| F-M69 | /settings | settings/edi-tab.tsx:342, 360–373, 403–405 | TCH | Buttons `text-xs` default h-9 | Querschnitt | S |
| F-M70 | /settings | settings/api-keys-tab.tsx:204 (und 174 nur Desktop) | TCH | Karten-Button "Widerrufen" `px-2 py-1 text-xs` | `max-md:h-11` | S |
| F-M71 | /settings | settings/api-keys-tab.tsx:122–134 | TCH | "Kopieren"/"Schließen" `text-xs` default h-9 | Querschnitt | S |
| F-M72 | /settings | settings/api-keys-tab.tsx:223 | DLG | Dialog "Neuer API-Key" (kleines Formular), zentriert | Bottom-Sheet | S |
| F-M73 | /settings | settings/api-keys-tab.tsx:246 | INP | `type="number"` Gültigkeit ohne `inputMode="numeric"` | ergänzen | S |
| F-M74 | /settings | settings/webhooks-tab.tsx:142, 222–248 | TCH | `size="sm"` Buttons (h-7, 28 px): Schließen, Deliveries, Aktivieren, Secret rotieren, Löschen | Button-Größen mobil anheben | S |
| F-M75 | /settings | settings/webhooks-tab.tsx:326 | DLG | "Neuer Webhook": handgebautes Overlay (`fixed inset-0`), kein Radix | auf gemeinsamen Dialog umstellen | M |
| F-M76 | /settings | settings/webhooks-tab.tsx:340 | INP | URL-Input ohne `type="url"`/`inputMode="url"`/`autoCapitalize="none"` | ergänzen | S |
| F-M77 | /settings | settings/webhooks-tab.tsx:352–368 | TCH | Event-Chips (Label+sr-only Checkbox) `px-3 py-1.5 text-xs` (ca. 30 px) | `min-h-11` | S |
| F-M78 | /settings | settings/webhooks-tab.tsx:447–452 | DLG | "Letzte Auslieferungen": handgebautes Overlay, `max-h-[80vh]` (vh). Inhalt hat bereits Karten (524–564) | auf gemeinsamen Dialog umstellen | M |
| F-M79 | /settings | settings/webhooks-tab.tsx:507, 555 | TCH | "Erneut senden" `px-2 py-1 text-xs` | `max-md:h-11` | S |
| F-M80 | /settings | settings/pdf-tab.tsx:100, 112 (`FIELD` Zeile 11) | INP | beide textareas `text-sm` | `text-base md:text-sm` | S |
| F-M81 | /settings | settings/pdf-tab.tsx:81, 86 | TCH | "Bild wählen" `px-3 py-1.5` (ca. 32 px), "entfernen" `text-xs` ohne Fläche | `min-h-11` | S |
| F-M82 | /settings | settings/users-tab.tsx:123–131 | TCH | Rollen-Segment `px-3 py-1.5 text-sm` (ca. 34 px) | `min-h-11` | S |
| F-M83 | /settings | settings/users-tab.tsx:205–233 | OVF, TCH | Zeile: Label plus `shrink-0` 3-Button-Segment (ca. 190 px) in ca. 290 px; Label wird gequetscht. Buttons `px-2 py-1 text-xs` | mobil `flex-col`, `min-h-11` | S |
| F-M84 | /settings | settings/users-tab.tsx:147–153 | TCH | Checkbox `h-4 w-4`. Ausnahme?: ganze Zeile klickbar (`py-2.5`, ca. 40 px) | `size-5` | S |
| F-M85 | /stock | stock/stock-view.tsx:171–246 | TAB | "Lagerplätze": 5 Spalten (Code, Name, Zone, Belegung mit Balken `min-w-[80px]`, Aktionen), keine Karten-Variante. Liegt im Grid (`grid-cols-1 xl:grid-cols-2`), das ist unter xl einspaltig, daher Ausnahme laut CLAUDE.md unwahrscheinlich | Karten-Liste `md:hidden`, Aktionen als 44-px-Buttons | M |
| F-M86 | /stock | stock/stock-view.tsx:254–291 | TAB | "Bestände je Artikel" (4 Spalten), keine Karten. Ausnahme? (schmal, im Grid) | Karten-Variante empfohlen | S |
| F-M87 | /stock | stock/stock-view.tsx:224–238 | TCH | "Bearbeiten"/"Löschen" `text-xs underline` ohne Fläche | als Buttons `h-11` in der Karte | S |
| F-M88 | /stock | stock/stock-view.tsx:137–153 | TCH | "+ Lagerplatz"/"Inventur starten" `text-sm` default h-9 (bei Zones: h-11) | Querschnitt | S |
| F-M89 | /stock | stock/stock-view.tsx:327 | DLG | Lagerplatz-Formular, zentriert (die Zonen-Variante daneben ist schon Sheet) | gemeinsamer Baustein | M |
| F-M90 | /stock | stock/location-form.tsx:62, 99 | INP | Code/Bin ohne `autoCapitalize="none"`/`autoCorrect="off"` (Code ist ein Scan-Wert) | Attribute ergänzen | S |
| F-M91 | /stock | stock/location-form.tsx:118; 132–138 | TCH | Checkbox Standardgröße, Label ohne Mindesthöhe; Buttons default h-9 (`zone-form.tsx` macht es richtig) | `zone-form.tsx`-Muster übernehmen | S |
| F-M92 | /stock | stock/inventory-modal.tsx:63 | DLG | Inventur: handgebautes Overlay, `max-h-[85vh]`, kein Focus-Trap/Escape | gemeinsamer responsiver Dialog | M |
| F-M93 | /stock | stock/inventory-modal.tsx:77 | INP, TCH | Lagerplatz-select `h-9 text-sm` (36 px, 14 px) | `h-11 text-base md:h-9 md:text-sm` | S |
| F-M94 | /stock | stock/inventory-modal.tsx:115–125 | TCH | Zähl-Input `h-8 w-24` (32 px) mit `type="number"`; Zähleingabe ist Kernaktion | `h-11 md:h-8`, `inputMode="numeric"` | S |
| F-M95 | /stock | stock/inventory-modal.tsx:97–130 | TAB | 3-Spalten-Tabelle im Modal. Ausnahme? (Detail-Modal, schmal) | belassen oder auf Kartenzeilen umstellen | S |
| F-M96 | /suppliers | suppliers/suppliers-view.tsx:114–126 | TCH | Kanal-Chips "Alle/EMAIL/API/EDI" `px-3 py-1.5 text-xs` | `min-h-11` | S |
| F-M97 | /suppliers | suppliers/suppliers-view.tsx:106 | INP | Suchfeld ohne `type="search"`/`enterKeyHint` | ergänzen | S |
| F-M98 | /suppliers | suppliers/suppliers-view.tsx:202 | DLG | "Neuer Lieferant"-Formular, zentriert | Bottom-Sheet | M |
| F-M99 | /suppliers | suppliers/supplier-form.tsx:121–143 | OVF | `grid-cols-[2fr_1fr_1fr]` ohne `sm:`-Auflösung: Straße, PLZ, Ort je ca. 80–150 px breit | `grid-cols-1 sm:grid-cols-[2fr_1fr_1fr]` | S |
| F-M100 | /suppliers | suppliers/supplier-form.tsx:106, 129, 97 | INP | Telefon ohne `type="tel"`/`inputMode="tel"`, PLZ ohne `inputMode="numeric"`/`autoComplete="postal-code"`, E-Mail ohne `autoCapitalize="none"`/`inputMode="email"` | ergänzen | S |
| F-M101 | /suppliers | suppliers/supplier-form.tsx:149 | INP | Kanal-select `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M102 | /suppliers | suppliers/supplier-form.tsx:170 | INP | JSON-textarea `text-xs` | `text-base md:text-xs` | S |
| F-M103 | /suppliers | suppliers/supplier-form.tsx:160 | TCH | Checkbox Standardgröße, `mt-2` Label ohne `min-h-11` | `zone-form.tsx`-Muster | S |
| F-M104 | /suppliers | suppliers/supplier-detail-modal.tsx:71 | DLG | Lieferanten-Detail mit Tabs und Edit-Formular, zentriert | Bottom-Sheet | M |
| F-M105 | /suppliers | suppliers/supplier-detail-modal.tsx:97–102 | OVF, TCH | 4 Tabs "Stamm/Kanal/Bestellungen/API-Keys" `w-fit nowrap h-8` | scrollbare Tabs, `h-11` | S |
| F-M106 | /suppliers | suppliers/supplier-detail-modal.tsx:105–114 | OVF | `DetailField` w-44 (siehe F-M12), E-Mail Mono läuft über | siehe F-M12 | S |
| F-M107 | /suppliers | suppliers/supplier-detail-modal.tsx:303–328 | TAB | Bestellungen 5 Spalten im Modal. Ausnahme? | Karten optional | S |
| F-M108 | /suppliers | suppliers/supplier-detail-modal.tsx:410, 420, 474 | TCH | `size="sm"` Buttons (h-7) "Schließen", "+ Neuer Key", "Widerrufen" | Querschnitt | S |
| F-M109 | /suppliers | suppliers/supplier-detail-modal.tsx:515 | DLG | "Neuer API-Key" im Modal: handgebautes Overlay (z-[60]) | gemeinsamer Dialog | M |
| F-M110 | /suppliers | suppliers/supplier-detail-modal.tsx:535–551 | TCH | Scope-Chips `px-3 py-1.5 text-xs` | `min-h-11` | S |
| F-M111 | /warehouse-mode | warehouse-mode/warehouse-mode-view.tsx:366–371 | INP | Manuell-Eingabe SKU/EAN ohne `inputMode`/`autoCapitalize="none"`/`autoCorrect="off"`/`enterKeyHint="search"` (ohne Kamera-Scan der Hauptweg) | Attribute, ggf. `inputMode="text"` | S |
| F-M112 | /warehouse-mode | warehouse-mode/warehouse-mode-view.tsx:347–383, 452 | TCH | Buttons "Scanner starten", "Suche", "Offline-Queue", "Zur Übersicht" `text-sm` default h-9; nur "Beenden" (277) hat `h-11` | `h-11` mobil | S |
| F-M113 | /warehouse-mode | warehouse-mode/warehouse-mode-view.tsx:551 | DLG | "Bestand korrigieren" (AdjustModal): handgebautes Overlay ohne `max-h`/`overflow` (Tastatur schneidet Inhalt ab) | gemeinsamer Dialog/Sheet | M |
| F-M114 | /warehouse-mode | warehouse-mode/warehouse-mode-view.tsx:569, 598 | INP | 2 selects `text-sm` | `text-base md:text-sm min-h-11` | S |
| F-M115 | Globale Bausteine | components/ui/button.tsx:25–34 | TCH | siehe Querschnitt: Größen h-9/h-7/h-6/size-8/size-7/size-6 ohne `pointer-coarse:`/`max-md:`-Anhebung | Variante/`max-md:min-h-11` | S |
| F-M116 | Globale Bausteine | components/ui/tabs.tsx:28, 66 | OVF, TCH | `TabsList` `w-fit h-8`, Trigger `nowrap`, kein Scroll (betrifft F-M11, F-M51, F-M105, admin) | scrollbar + mobile Höhe | S |
| F-M117 | Globale Bausteine | components/ui/dialog.tsx:64, 75 | DLG, TCH | zentriert (Ziel Bottom-Sheet); Schließen-Button `icon-sm` 28 px. `sheet.tsx`:76 ebenso, kein Drag-Handle, kein Safe-Area-Padding am Boden | T17-Baustein `components/ui/responsive-dialog.tsx` aus Muster von `zones-panel.tsx` | M |
| F-M118 | Globale Bausteine | components/ui/input.tsx:11 | TCH | mobil `h-10` (40 px), unter 44 px. Dazu die `text-sm`-Überschreibung (F-M45) | `h-11 md:h-8` | S |
| F-M119 | Globale Bausteine | components/ui/select.tsx:41, 53, 86 | INP, TCH | Radix-Trigger `text-sm`, `size="sm"` h-7, Items `py-1 text-sm` (unused in (app), latent) | `text-base md:text-sm`, Items `min-h-11` | S |
| F-M120 | Globale Bausteine | components/search/command-palette.tsx:156–163 | INP | Suchfeld `h-12 text-sm` (14 px): iOS zoomt beim Öffnen (Autofokus). Ohne `type="search"`/`enterKeyHint`/`autoComplete="off"`/`autoCapitalize` | `text-base md:text-sm` | S |
| F-M121 | Globale Bausteine | components/search/command-palette.tsx:139–140, 185 | DLG, TCH | eigenes Overlay (`pt-[12vh]`, Ergebnisliste `max-h-[60vh]`, vh statt dvh, Tastatur); Ergebniszeilen `py-2 text-sm` (ca. 36 px) | mobil Vollbild/oben verankert, `dvh`, `min-h-11` | M |
| F-M122 | Globale Bausteine | components/layout/tenant-switcher.tsx:106, 108 | TCH | Pager `size="icon"` 32 px (der Rest dieses Popovers ist 44 px) | `size-11` mobil | S |
| F-M123 | Globale Bausteine | components/layout/notification-bell.tsx:158 | TCH | "Alle als gelesen" `px-2 py-1 text-xs` | `min-h-11` | S |
| F-M124 | Globale Bausteine | components/ui/dialog.tsx:110 (DialogFooter) | DLG | `-mx-4 -mb-4`-Footer wird in App-Dialogen nirgends genutzt, jedes Formular baut sein eigenes `flex justify-end` | im neuen Baustein sticky Footer vorsehen | S |

## Anhang: Dialog-Inventar

Radix-`DialogContent`, zentriert (14):
1. `edi/edi-view.tsx`:274 EDI-Nachricht-Detail
2. `settings/settings-view.tsx`:265 Versand-Profil-Formular
3. `settings/edi-tab.tsx`:480 Partner-Postfach-Formular
4. `settings/api-keys-tab.tsx`:223 Neuer API-Key
5. `suppliers/suppliers-view.tsx`:202 Neuer Lieferant
6. `suppliers/supplier-detail-modal.tsx`:71 Lieferanten-Detail
7. `articles/article-detail-modal.tsx`:210 Artikel-Detail
8. `articles/article-detail-modal.tsx`:553 Lieferant zuordnen
9. `articles/articles-view.tsx`:248 Neuer Artikel
10. `admin/admin-view.tsx`:283 Tenant-Funktionen
11. `admin/admin-view.tsx`:368 Funktionsprofil
12. `orders/order-detail-modal.tsx`:114 Bestelldetail
13. `stock/stock-view.tsx`:327 Lagerplatz-Formular
14. `stock/zones-panel.tsx`:373 Zonen-Formular (nur ab md; darunter Sheet, Zeile 383, schon erledigt)

Handgebaute Overlays ohne Radix (7, höchste Priorität, weil ohne Focus-Trap/Escape):
15. `orders/receive-modal.tsx`:75 Wareneingang buchen
16. `stock/inventory-modal.tsx`:63 Inventur
17. `settings/webhooks-tab.tsx`:326 Neuer Webhook
18. `settings/webhooks-tab.tsx`:447 Letzte Auslieferungen
19. `suppliers/supplier-detail-modal.tsx`:515 Neuer API-Key (Lieferant)
20. `warehouse-mode/warehouse-mode-view.tsx`:551 Bestand korrigieren
21. `components/search/command-palette.tsx`:139 globale Suche (`role="dialog"`)

Bereits ok (kein Fund): `mobile-nav.tsx` (Sheet von links), alle Popover/Dropdowns in `components/layout` (mit `max-w-[calc(100vw-1rem)]`).

## Anhang: Zusatz

- 19 Stellen mit natives `confirm()`/`alert()`, z. B. `settings-view.tsx`:68, `edi-tab.tsx`:108/130/205/214, `webhooks-tab.tsx`:84/96, `api-keys-tab.tsx`:81, `supplier-detail-modal.tsx`:212/221/387, `article-detail-modal.tsx`:155/514/521, `admin-view.tsx`:136, `zones-panel.tsx`:177, `stock-view.tsx`:111. Sie blockieren im PWA-Standalone und sind nicht gestaltbar. Eigener Bestätigungsdialog wäre sinnvoll (T17).
- `suppliers-view.tsx`:144–149: klickbare `Card` mit `onClick` (kein Button/Link).
- `order-detail-modal.tsx`:206–208: `<a>` umschließt `<Button>`.
- Referenzen bereits vorhanden: `stock/zones-panel.tsx`:94, 371–391 (Dialog/Sheet per `useMediaQuery`), `stock/zone-form.tsx` (`h-11 md:h-8`, `size-5 md:size-4`, `min-h-11`).
- `components/warehouse/*` und `(app)/layout.tsx` ohne Fund.
