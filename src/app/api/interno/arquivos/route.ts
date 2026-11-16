import type { NextRequest } from 'next/server';
import { serveVerificationFile } from '@/domain/staff/files';
import { appDeps, now } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return serveVerificationFile(
    appDeps(),
    { staffId: await currentSubject('staff'), key: p.get('key') ?? '', exp: p.get('exp') ?? '', sig: p.get('sig') ?? '' },
    await now(),
  );
}
