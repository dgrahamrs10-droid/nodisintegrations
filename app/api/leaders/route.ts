import { NextResponse } from 'next/server';

const SWUAPI = 'https://api.swuapi.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllLeaders(): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  const limit = 200;

  do {
    const url = cursor
      ? `${SWUAPI}/cards?type=Leader&limit=${limit}&after=${cursor}`
      : `${SWUAPI}/cards?type=Leader&limit=${limit}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`swuapi error ${res.status}`);

    const json = await res.json();
    const cards: any[] = Array.isArray(json.cards) ? json.cards : [];
    all.push(...cards);

    cursor = json.pagination?.next_cursor ?? null;
    if (cards.length < limit) break;
  } while (cursor);

  return all;
}

export async function GET() {
  try {
    const raw = await fetchAllLeaders();

    // Keep only Standard (non-variant) versions of Leader cards
    const data = raw
      .filter((c) => c.type === 'Leader' && c.variant_type === 'Standard')
      .map((c) => ({
        // Normalized to the shape the client expects
        Type: 'Leader',
        VariantType: 'Normal',
        Set: c.set_code ?? '',
        Number: c.card_number ?? '',
        Name: c.name ?? '',
        Subtitle: c.subtitle ?? '',
        Aspects: Array.isArray(c.aspects) ? c.aspects : [],
        Rarity: c.rarity ?? 'Common',
        FrontArt: c.front_image_url ?? '',
        BackArt: c.back_image_url ?? '',
        FrontText: c.front_text ?? '',
        EpicAction: c.epic_action ?? '',
      }));

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
