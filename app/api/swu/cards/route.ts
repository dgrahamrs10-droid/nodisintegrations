import { NextRequest, NextResponse } from 'next/server';

const SWUAPI = 'https://api.swuapi.com';

interface SWUCard {
  Set: string;
  Number: string;
  Name: string;
  Subtitle?: string;
  Type: string;
  Aspects: string[];
  Rarity: string;
  VariantType: string;
  FrontArt: string;
  BackArt?: string;
}

// Paginate through all cards for a set using swuapi cursor pagination.
// Sets like SOR have ~991 total records across all variant types;
// we fetch everything and filter to Standard in code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllCardsForSet(setCode: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  const limit = 200;

  do {
    const url: string = cursor
      ? `${SWUAPI}/cards?set=${setCode}&limit=${limit}&after=${cursor}`
      : `${SWUAPI}/cards?set=${setCode}&limit=${limit}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) break;

    const json = await res.json();
    const cards: any[] = Array.isArray(json.cards) ? json.cards : [];
    all.push(...cards);

    cursor = json.pagination?.next_cursor ?? null;
    if (cards.length < limit) break;
  } while (cursor);

  return all;
}

export async function GET(req: NextRequest) {
  const set = req.nextUrl.searchParams.get('set');
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? '';

  if (!set) {
    return NextResponse.json({ error: 'set parameter required' }, { status: 400 });
  }

  const raw = await fetchAllCardsForSet(set.toUpperCase());

  // Keep only Standard (non-variant) cards and normalise field names
  // to the shape the client SWUCard interface expects.
  let cards: SWUCard[] = raw
    .filter((c) => c.variant_type === 'Standard')
    .map((c) => ({
      Set:        (c.set_code        ?? '')        as string,
      Number:     (c.card_number     ?? '')        as string,
      Name:       (c.name            ?? '')        as string,
      Subtitle:   c.subtitle || undefined,
      Type:       (c.type            ?? '')        as string,
      Aspects:    Array.isArray(c.aspects) ? c.aspects : [],
      Rarity:     (c.rarity          ?? '')        as string,
      VariantType: 'Normal',
      FrontArt:   (c.front_image_url ?? '')        as string,
      BackArt:    c.back_image_url   || undefined,
    }));

  if (query) {
    cards = cards.filter(c => c.Name.toLowerCase().includes(query));
  }

  return NextResponse.json(cards);
}
