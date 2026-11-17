import { serveStudentWaitlistExport } from '@/domain/student-waitlist';
import { siteDeps } from '@/server/app';

export const dynamic = 'force-dynamic';

/** Planilha dos alunos que pediram aviso da abertura; mesma senha da planilha dos professores. */
export async function GET(req: Request) {
  return serveStudentWaitlistExport(siteDeps(), req.headers.get('authorization'));
}
