import { NextResponse } from 'next/server';

const SWUAPI  = 'https://api.swuapi.com';
const SWUDB   = 'https://api.swu-db.com/cards/search?q=type%3Aleader&format=json';

// All main sets that contain leaders. Fetched in parallel to avoid
// swuapi's implicit default filtering (unfiltered endpoint omits older sets).
const LEADER_SETS = [
  'SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'SEC', 'LAW', 'IBH', 'TS26',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSwuapiSet(setCode: string): Promise<any[]> {
  const res = await fetch(
    `${SWUAPI}/cards?set=${setCode}&type=Leader&limit=100`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.cards) ? json.cards : [];
}

// Normalise card number to a plain integer string so keys match across
// APIs: swu-db returns "008", swuapi returns "8" — both become "8".
function normNum(n: string | number | null | undefined): string {
  const i = parseInt(String(n ?? '0'), 10);
  return isNaN(i) ? '0' : String(i);
}

// Returns a map of "SET-NUMBER" → swu-db card object (for ability text)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSwudbTextMap(): Promise<Map<string, any>> {
  const res = await fetch(SWUDB, { next: { revalidate: 3600 } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();
  if (!res.ok) return map;
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cards: any[] = json.data ?? [];
  for (const c of cards) {
    if (c.Type === 'Leader' && c.VariantType === 'Normal') {
      map.set(`${c.Set}-${normNum(c.Number)}`, c);
    }
  }
  return map;
}

export async function GET() {
  try {
    // Run all requests in parallel: one per set from swuapi + swu-db text lookup
    const [swudbMap, ...perSet] = await Promise.all([
      fetchSwudbTextMap(),
      ...LEADER_SETS.map(fetchSwuapiSet),
    ]);

    const raw = perSet.flat();

    // Keep only Standard (non-variant) versions
    const data = raw
      .filter((c) => c.type === 'Leader' && c.variant_type === 'Standard')
      .map((c) => {
        // Match to swu-db by Set + normalised card number to retrieve ability text
        const key = `${(c.set_code ?? '').toUpperCase()}-${normNum(c.card_number)}`;
        const db = swudbMap.get(key);
        return {
          Type: 'Leader',
          VariantType: 'Normal',
          Set: (c.set_code ?? '') as string,
          Number: (c.card_number ?? '') as string,
          Name: (c.name ?? '') as string,
          Subtitle: (c.subtitle ?? '') as string,
          // Aspects + Traits from swuapi — correct alignment data
          Aspects: Array.isArray(c.aspects) ? c.aspects : [],
          Traits: Array.isArray(c.traits) ? c.traits : [],
          Rarity: (c.rarity ?? 'Common') as string,
          // Images from swuapi
          FrontArt: (c.front_image_url ?? '') as string,
          BackArt: (c.back_image_url ?? '') as string,
          // Ability text from swu-db (swuapi leaves front_text null for leaders)
          FrontText: (db?.FrontText ?? '') as string,
          EpicAction: (db?.EpicAction ?? c.epic_action ?? '') as string,
        };
      });

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
