import type { Geocoder } from './types';

/** Alguns CEPs reais de São Paulo e do Rio, com coordenadas aproximadas. */
const KNOWN: Record<string, { lat: number; lng: number }> = {
  '01310100': { lat: -23.5614, lng: -46.6559 }, // Av. Paulista
  '01001000': { lat: -23.5503, lng: -46.6339 }, // Praça da Sé
  '04538133': { lat: -23.5868, lng: -46.6815 }, // Itaim Bibi
  '05508010': { lat: -23.5613, lng: -46.7307 }, // Cidade Universitária
  '02012000': { lat: -23.5185, lng: -46.6244 }, // Santana
  '22041001': { lat: -22.9711, lng: -43.1863 }, // Copacabana (RJ)
};

export const onlyDigits = (cep: string) => cep.replace(/\D/g, '');

export class FakeGeocoder implements Geocoder {
  readonly name = 'fake';
  async cepToLatLng(cep: string) {
    return KNOWN[onlyDigits(cep)] ?? null;
  }
}
