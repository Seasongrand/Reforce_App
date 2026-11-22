/** Foto do professor, ou as iniciais quando ainda não há foto aprovada. */
export function TeacherPhoto({ photoUrl, name, size }: { photoUrl: string | null; name: string; size: number }) {
  const style = { width: size, height: size, borderRadius: Math.round(size / 4) };
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={`Foto de ${name}`} width={size} height={size} style={style} className="flex-none object-cover" />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <div
      role="img"
      aria-label={`Iniciais de ${name}`}
      style={{ ...style, fontSize: Math.round(size / 3) }}
      className="flex flex-none items-center justify-center bg-site-line font-display tracking-tight font-normal text-indigo-600"
    >
      {initials}
    </div>
  );
}
