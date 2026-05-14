import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch(
    'https://api.swu-db.com/cards/search?q=type%3Aleader&format=json',
    { next: { revalidate: 3600 } }, // cache for 1 hour
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
