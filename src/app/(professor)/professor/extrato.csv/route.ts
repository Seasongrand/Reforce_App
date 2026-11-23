import { statementCsv, teacherStatement } from '@/domain/teachers/statement';
import { appDeps } from '@/server/app';
import { currentSubject } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Planilha do extrato do mês (?mes=AAAA-MM), só para o professor logado. */
export async function GET(req: Request): Promise<Response> {
  const teacherId = await currentSubject('teacher');
  if (!teacherId) return new Response('Entre na sua conta de professor.', { status: 401 });
  const month = new URL(req.url).searchParams.get('mes') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response('Mês inválido.', { status: 400 });
  const csv = statementCsv(await teacherStatement(appDeps().db, teacherId, month));
  return new Response(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="extrato-reforce-${month}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
