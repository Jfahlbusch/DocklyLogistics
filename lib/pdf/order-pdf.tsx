import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const NAVY = "#0F2A44";
const GOLD = "#C9A24B";
const STONE_500 = "#78716C";
const STONE_200 = "#E7E5E4";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1C1917" },
  brandBar: { backgroundColor: NAVY, height: 6 },
  brandBarGold: { backgroundColor: GOLD, height: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, marginBottom: 32 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandSquare: { width: 36, height: 36, backgroundColor: NAVY, color: GOLD, fontSize: 24, fontFamily: "Times-Bold", textAlign: "center", paddingTop: 4 },
  brandTitle: { fontSize: 16, color: NAVY, fontFamily: "Times-Bold", marginBottom: 2 },
  brandSub: { fontSize: 8, color: STONE_500, letterSpacing: 2, textTransform: "uppercase" },
  metaBox: { textAlign: "right" },
  metaLabel: { fontSize: 8, color: STONE_500, letterSpacing: 1.5, textTransform: "uppercase" },
  metaValue: { fontSize: 11, color: NAVY, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  addressBlock: { flexDirection: "row", gap: 16, marginBottom: 32 },
  addressCol: { flex: 1 },
  addressTitle: { fontSize: 9, color: STONE_500, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  addressLine: { fontSize: 10, marginBottom: 1 },
  table: { borderTopWidth: 1, borderTopColor: STONE_200, marginTop: 8 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: STONE_200, paddingVertical: 8, backgroundColor: "#FAFAF9" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: STONE_200, paddingVertical: 8 },
  th: { fontSize: 8, color: STONE_500, letterSpacing: 1.2, textTransform: "uppercase" },
  td: { fontSize: 10 },
  colSku: { width: "20%" },
  colName: { width: "40%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "12%", textAlign: "right" },
  colTotal: { width: "13%", textAlign: "right" },
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalsBox: { width: "40%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: STONE_500 },
  totalValue: { fontSize: 11, color: NAVY, fontFamily: "Helvetica-Bold" },
  notes: { marginTop: 24, padding: 12, backgroundColor: "#FAFAF9", borderRadius: 4 },
  notesTitle: { fontSize: 8, color: STONE_500, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, borderTopWidth: 1, borderTopColor: STONE_200, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: STONE_500 },
});

export type OrderPdfData = {
  orderNo: string;
  createdAt: Date;
  currency: string;
  notes: string | null;
  total: string;            // pre-formatted decimal
  sender: {
    fromName: string;
    fromEmail?: string;
    signature?: string;
  };
  supplier: {
    name: string;
    contactName?: string | null;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
  };
  items: Array<{
    sku: string;
    name: string;
    qtyOrderUnit: number;
    orderUnit: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  hashShort: string;
};

export function OrderPdf({ data }: { data: OrderPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandBar} fixed />
        <View style={styles.brandBarGold} fixed />

        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandSquare}>D</Text>
            <View>
              <Text style={styles.brandTitle}>{data.sender.fromName ?? "DocklyLogistics"}</Text>
              <Text style={styles.brandSub}>Bestellschein</Text>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Bestell-Nr.</Text>
            <Text style={styles.metaValue}>{data.orderNo}</Text>
            <Text style={styles.metaLabel}>Datum</Text>
            <Text style={styles.metaValue}>{data.createdAt.toLocaleDateString("de-DE")}</Text>
          </View>
        </View>

        <View style={styles.addressBlock}>
          <View style={styles.addressCol}>
            <Text style={styles.addressTitle}>Absender</Text>
            <Text style={styles.addressLine}>{data.sender.fromName}</Text>
            {data.sender.fromEmail && <Text style={styles.addressLine}>{data.sender.fromEmail}</Text>}
          </View>
          <View style={styles.addressCol}>
            <Text style={styles.addressTitle}>Empfänger</Text>
            <Text style={styles.addressLine}>{data.supplier.name}</Text>
            {data.supplier.contactName && <Text style={styles.addressLine}>z.Hd. {data.supplier.contactName}</Text>}
            {data.supplier.street && <Text style={styles.addressLine}>{data.supplier.street}</Text>}
            {(data.supplier.postalCode || data.supplier.city) && (
              <Text style={styles.addressLine}>{[data.supplier.postalCode, data.supplier.city].filter(Boolean).join(" ")}</Text>
            )}
            {data.supplier.country && <Text style={styles.addressLine}>{data.supplier.country}</Text>}
            {data.supplier.email && <Text style={styles.addressLine}>{data.supplier.email}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colSku]}>SKU</Text>
            <Text style={[styles.th, styles.colName]}>Bezeichnung</Text>
            <Text style={[styles.th, styles.colQty]}>Menge</Text>
            <Text style={[styles.th, styles.colPrice]}>EK</Text>
            <Text style={[styles.th, styles.colTotal]}>Summe</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colSku]}>{it.sku}</Text>
              <Text style={[styles.td, styles.colName]}>{it.name}</Text>
              <Text style={[styles.td, styles.colQty]}>{it.qtyOrderUnit} × {it.orderUnit}</Text>
              <Text style={[styles.td, styles.colPrice]}>{it.unitPrice}</Text>
              <Text style={[styles.td, styles.colTotal]}>{it.lineTotal}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Summe netto</Text>
              <Text style={styles.totalValue}>{data.total} {data.currency}</Text>
            </View>
          </View>
        </View>

        {data.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Notiz</Text>
            <Text style={styles.td}>{data.notes}</Text>
          </View>
        )}

        {data.sender.signature && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.td}>{data.sender.signature}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DocklyLogistics — Bestellschein {data.orderNo}</Text>
          <Text style={styles.footerText}>Hash: {data.hashShort}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderOrderPdfBuffer(data: OrderPdfData): Promise<Buffer> {
  const stream = await pdf(<OrderPdf data={data} />).toBuffer();
  // @react-pdf returns a NodeJS Readable; collect into Buffer
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c as Buffer));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
