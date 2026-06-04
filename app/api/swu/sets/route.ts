import { NextResponse } from 'next/server';

interface SWUSet {
  setId: string;
  fullName: string;
  numberCards: number;
  maxElement: string;
  releaseDate?: string;
  parentSetId?: string;
}

export async function GET() {
  const res = await fetch('https://api.swu-db.com/sets', {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch sets' }, { status: 502 });
  }

  const data = await res.json();
  const mainSets = (data as SWUSet[])
    .filter(s => !s.parentSetId && s.numberCards >= 50)
    .sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

  return NextResponse.json(mainSets);
}
