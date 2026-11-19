/**
 * "13 anos de experiência" a partir do ano em que o professor começou a dar
 * aula. Puro, para a página pública (servidor) e a prévia do perfil
 * (navegador) mostrarem o mesmo texto.
 */
export function experienceText(teachingSince: number | null, currentYear: number): string | null {
  if (teachingSince === null) return null;
  const years = currentYear - teachingSince;
  if (years <= 0) return 'Começou a dar aula este ano';
  return years === 1 ? '1 ano de experiência' : `${years} anos de experiência`;
}
