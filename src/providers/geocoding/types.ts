/** CEP para coordenadas do centro do CEP (§3.2): serviço a escolher no protótipo. */
export interface Geocoder {
  readonly name: string;
  cepToLatLng(cep: string): Promise<{ lat: number; lng: number } | null>;
}
