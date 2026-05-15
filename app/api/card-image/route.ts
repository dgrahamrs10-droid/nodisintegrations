import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set(['cdn.swu-db.com', 'cdn.starwarsunlimited.com']);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });

  let hostname: string;
  try { hostname = new URL(url).hostname; }
  catch { return NextResponse.json({ error: 'invalid url' }, { status: 400 }); }

  if (!ALLOWED_HOSTS.has(hostname)) {
    return NextResponse.json({ error: 'disallowed host' }, { status: 400 });
  }

  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) {
    return NextResponse.json({ error: 'upstream error', status: res.status }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
