'use client';

import { useEffect, useState } from 'react';
import { shortWhen } from '@/lib/profile-days';

/** "Ter, 18 de nov · 15:00" no fuso de quem vê (começa no do professor, para não divergir na hidratação). */
export function LocalWhen({ iso, teacherTz }: { iso: string; teacherTz: string }) {
  const [tz, setTz] = useState(teacherTz);
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return <>{shortWhen(iso, tz)}</>;
}
