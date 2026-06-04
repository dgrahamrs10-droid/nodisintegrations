import { NextRequest, NextResponse } from 'next/server';

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
  Cost?: string;
  Power?: string;
  HP?: string;
}

export async function GET(req: NextRequest) {
  const set = req.nextUrl.searchParams.get('set');
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? '';

  if (!set) {
    return NextResponse.json({ error: 'set parameter required' }, { status: 400 });
  }

  const res = await fetch(`https://api.swu-db.com/cards/${set}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Failed to fetch set ${set}` }, { status: 502 });
  }

  const raw = await res.json();
  // Handle both { data: [...] } and direct array responses
  const allCards: SWUCard[] = raw.data ?? raw ?? [];

  let cards = allCards.filter((c: SWUCard) => c.VariantType === 'Normal');
  if (query) {
    cards = cards.filter((c: SWUCard) => c.Name.toLowerCase().includes(query));
  }

  return NextResponse.json(cards);
}
