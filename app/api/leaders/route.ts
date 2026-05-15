import { NextResponse } from 'next/server';

const SWUAPI = 'https://api.swuapi.com';

// All main sets that contain leaders. Fetched in parallel to avoid
// swuapi's implicit default filtering (unfiltered endpoint omits older sets).
const LEADER_SETS = [
  'SOR', 'SHD', 'TWI', 'JTL', 'LOF', 'SEC', 'LAW', 'IBH', 'TS26',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLeadersForSet(setCode: string): Promise<any[]> {
  const url = `${SWUAPI}/cards?set=${setCode}&type=Leader&limit=100`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json.cards) ? json.cards : [];
}

export async function GET() {
  try {
    const perSet = await Promise.all(LEADER_SETS.map(fetchLeadersForSet));
    const raw = perSet.flat();

    // Keep only Standard (non-variant) versions of Leader cards
    const data = raw
      .filter((c) => c.type === 'Leader' && c.variant_type === 'Standard')
      .map((c) => ({
        // Normalised to the shape the client expects
        Type: 'Leader',
        VariantType: 'Normal',
        Set: (c.set_code ?? '') as string,
        Number: (c.card_number ?? '') as string,
        Name: (c.name ?? '') as string,
        Subtitle: (c.subtitle ?? '') as string,
        Aspects: Array.isArray(c.aspects) ? c.aspects : [],
        Rarity: (c.rarity ?? 'Common') as string,
        FrontArt: (c.front_image_url ?? '') as string,
        BackArt: (c.back_image_url ?? '') as string,
        FrontText: (c.front_text ?? '') as string,
        EpicAction: (c.epic_action ?? '') as string,
      }));

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
