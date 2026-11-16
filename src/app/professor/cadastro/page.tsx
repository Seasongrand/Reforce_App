import { requireTeacher } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function TeacherProfilePage() {
  await requireTeacher();
  return <h1 className="text-2xl font-semibold">Seu perfil</h1>;
}
