/**
 * Minimal EDIFACT toolkit (UN/EDIFACT syntax version 3) — enough for the
 * ORDERS/ORDRSP flows we speak. Uses the standard service characters and
 * honours an explicit UNA header on inbound messages.
 *
 * Segment model: `{ tag, elements }` where `elements[i][j]` is component j of
 * data element i (elements start AFTER the tag).
 */

export type EdiSegment = {
  tag: string;
  elements: string[][];
};

export type ServiceChars = {
  component: string; // default ":"
  element: string;   // default "+"
  decimal: string;   // default "."
  release: string;   // default "?"
  segment: string;   // default "'"
};

export const DEFAULT_SERVICE_CHARS: ServiceChars = {
  component: ":",
  element: "+",
  decimal: ".",
  release: "?",
  segment: "'",
};

/** Escape one component value for emission (release char doubles itself). */
export function escapeComponent(value: string, sc: ServiceChars = DEFAULT_SERVICE_CHARS): string {
  let out = "";
  for (const ch of value) {
    if (ch === sc.release || ch === sc.component || ch === sc.element || ch === sc.segment) {
      out += sc.release + ch;
    } else if (ch === "\n" || ch === "\r") {
      out += " "; // newlines are not representable inside a segment
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Build one segment string. Elements may be a plain string (single component)
 * or a component array. Trailing empty elements are trimmed, embedded empty
 * components are kept (positional semantics).
 */
export function seg(
  tag: string,
  elements: Array<string | Array<string | undefined> | undefined>,
  sc: ServiceChars = DEFAULT_SERVICE_CHARS,
): string {
  const rendered = elements.map((el) => {
    if (el === undefined) return "";
    const comps = Array.isArray(el) ? el : [el];
    // trim trailing empty components inside the element
    let last = comps.length - 1;
    while (last > 0 && (comps[last] === undefined || comps[last] === "")) last--;
    return comps
      .slice(0, last + 1)
      .map((c) => escapeComponent(c ?? "", sc))
      .join(sc.component);
  });
  let last = rendered.length - 1;
  while (last >= 0 && rendered[last] === "") last--;
  const body = rendered.slice(0, last + 1).join(sc.element);
  return body.length > 0 ? `${tag}${sc.element}${body}${sc.segment}` : `${tag}${sc.segment}`;
}

/** Split `raw` into segment strings, honouring the release character. */
function splitWithRelease(raw: string, separator: string, release: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === release && i + 1 < raw.length) {
      cur += ch + raw[i + 1];
      i++;
      continue;
    }
    if (ch === separator) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function unescape(value: string, sc: ServiceChars): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === sc.release && i + 1 < value.length) {
      out += value[i + 1];
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

export type ParsedInterchange = {
  serviceChars: ServiceChars;
  segments: EdiSegment[];
  /** UNB envelope, when present. */
  envelope: {
    syntax?: string;
    senderId?: string;
    senderQualifier?: string;
    recipientId?: string;
    recipientQualifier?: string;
    date?: string;
    time?: string;
    interchangeRef?: string;
  } | null;
  /** UNH…UNT message blocks. */
  messages: Array<{
    type: string;           // e.g. "ORDERS"
    messageRef: string;     // UNH element 1
    segments: EdiSegment[]; // inclusive UNH and UNT
  }>;
};

/**
 * Tokenize a raw EDIFACT interchange. Accepts an optional UNA header; skips
 * whitespace/newlines between segments. Throws on structurally empty input.
 */
export function parseInterchange(raw: string): ParsedInterchange {
  let input = raw.replace(/^﻿/, "").trimStart();
  const sc: ServiceChars = { ...DEFAULT_SERVICE_CHARS };

  if (input.startsWith("UNA") && input.length >= 9) {
    sc.component = input[3];
    sc.element = input[4];
    sc.decimal = input[5];
    sc.release = input[6];
    sc.segment = input[8];
    input = input.slice(9);
  }

  const rawSegments = splitWithRelease(input, sc.segment, sc.release)
    .map((s) => s.replace(/^[\s\r\n]+/, ""))
    .filter((s) => s.length > 0);

  if (rawSegments.length === 0) throw new Error("Leere EDIFACT-Nachricht");

  const segments: EdiSegment[] = rawSegments.map((rawSeg) => {
    const elements = splitWithRelease(rawSeg, sc.element, sc.release);
    const tag = elements.shift() ?? "";
    return {
      tag: tag.trim(),
      elements: elements.map((el) =>
        splitWithRelease(el, sc.component, sc.release).map((c) => unescape(c, sc)),
      ),
    };
  });

  const unb = segments.find((s) => s.tag === "UNB");
  const envelope = unb
    ? {
        syntax: unb.elements[0]?.[0],
        senderId: unb.elements[1]?.[0],
        senderQualifier: unb.elements[1]?.[1],
        recipientId: unb.elements[2]?.[0],
        recipientQualifier: unb.elements[2]?.[1],
        date: unb.elements[3]?.[0],
        time: unb.elements[3]?.[1],
        interchangeRef: unb.elements[4]?.[0],
      }
    : null;

  const messages: ParsedInterchange["messages"] = [];
  let current: { type: string; messageRef: string; segments: EdiSegment[] } | null = null;
  for (const s of segments) {
    if (s.tag === "UNH") {
      current = {
        messageRef: s.elements[0]?.[0] ?? "",
        type: s.elements[1]?.[0] ?? "UNKNOWN",
        segments: [s],
      };
      continue;
    }
    if (current) {
      current.segments.push(s);
      if (s.tag === "UNT") {
        messages.push(current);
        current = null;
      }
    }
  }
  if (current) messages.push(current); // unterminated message — keep for diagnostics

  return { serviceChars: sc, segments, envelope, messages };
}

/** First matching segment of a message block. */
export function findSeg(segments: EdiSegment[], tag: string): EdiSegment | undefined {
  return segments.find((s) => s.tag === tag);
}

/** All matching segments of a message block. */
export function findSegs(segments: EdiSegment[], tag: string): EdiSegment[] {
  return segments.filter((s) => s.tag === tag);
}
