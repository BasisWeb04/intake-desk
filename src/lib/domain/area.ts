import type { Place } from "./types";
import { editDistance } from "../engine/fuzzy";

/** Fictional city and service area. Codes use the 99990-99999 range so none match a real ZIP. */
export const CITY_NAME = "Port Calloway";

interface AreaEntry {
  name: string;
  code: string | null;
  inArea: boolean;
  /** Extra spellings accepted as a whole-word match. */
  aliases: string[];
}

export const AREA: readonly AreaEntry[] = [
  { name: "Alder Flats", code: "99991", inArea: true, aliases: ["alder"] },
  { name: "Brassmill", code: "99992", inArea: true, aliases: ["brass mill"] },
  { name: "Cinder Hollow", code: "99993", inArea: true, aliases: ["cinder"] },
  { name: "Dovecote Park", code: "99994", inArea: true, aliases: ["dovecote"] },
  { name: "Estuary Bend", code: "99995", inArea: true, aliases: ["estuary"] },
  { name: "Foxglove Terrace", code: "99996", inArea: true, aliases: ["foxglove"] },
  { name: "Gantry Yard", code: "99997", inArea: true, aliases: ["gantry"] },
  { name: "Harrow Glen", code: "99998", inArea: true, aliases: ["harrow"] },
  // Neighbouring places outside the area, so the decline path has something concrete to match.
  { name: "Kestrel Point", code: "99990", inArea: false, aliases: ["kestrel"] },
  { name: "Lantern Bay", code: "99999", inArea: false, aliases: [] },
  { name: "North Quarry", code: null, inArea: false, aliases: [] },
];

export const SERVICE_NEIGHBORHOODS = AREA.filter((a) => a.inArea);

function toPlace(entry: AreaEntry): Place {
  return { name: entry.name, code: entry.code, inArea: entry.inArea };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Allowed typo distance grows with the length of the name. */
function tolerance(length: number): number {
  if (length >= 10) return 2;
  if (length >= 6) return 1;
  return 0;
}

/** Finds the first known place mentioned in free text, by code, exact name, alias or near spelling. */
export function findPlaceInText(text: string): Place | null {
  const codeMatch = text.match(/\b9999\d\b/);
  if (codeMatch) {
    const byCode = AREA.find((a) => a.code === codeMatch[0]);
    if (byCode) return toPlace(byCode);
  }
  const norm = ` ${normalize(text)} `;
  for (const entry of AREA) {
    const spellings = [entry.name.toLowerCase(), ...entry.aliases];
    if (spellings.some((s) => norm.includes(` ${s} `))) return toPlace(entry);
  }
  const tokens = normalize(text).split(" ").filter(Boolean);
  for (const entry of AREA) {
    const target = entry.name.toLowerCase();
    const words = target.split(" ").length;
    for (let i = 0; i + words <= tokens.length; i++) {
      const candidate = tokens.slice(i, i + words).join(" ");
      if (candidate[0] !== target[0]) continue;
      if (editDistance(candidate, target) <= tolerance(target.length)) return toPlace(entry);
    }
  }
  return null;
}

/** Resolves a value an extractor proposed (a name or a code) to a known place. */
export function resolvePlace(value: string): Place | null {
  return findPlaceInText(value);
}

export function referralMessage(place: Place): string {
  return (
    `Thanks for reaching out. ${place.name} is outside the area Copperline Plumbing & Drain serves, ` +
    `so we cannot book this job. Your state plumbing licensing board keeps a searchable list of ` +
    `licensed plumbers by town, which is the quickest way to find someone who covers ${place.name}.`
  );
}
