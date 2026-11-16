/**
 * Etapa 1 do formulário da lista de espera, conferida na tela antes de
 * avançar. Espelha as regras e as mensagens de `joinTeacherWaitlist`
 * (src/domain/waitlist.ts), que continua sendo quem decide: este módulo roda
 * no navegador e não pode importar código do servidor.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type Step1Field = 'name' | 'email' | 'phone' | 'city' | 'state';

const MESSAGES: Record<Step1Field, string> = {
  name: 'informe seu nome completo',
  email: 'e-mail inválido',
  phone: 'telefone inválido: informe DDD e número',
  city: 'informe sua cidade',
  state: 'UF inválida',
};

export function step1Errors(v: Record<Step1Field, string>): Partial<Record<Step1Field, string>> {
  const errors: Partial<Record<Step1Field, string>> = {};
  const name = v.name.trim();
  if (name.length < 3 || name.length > 120) errors.name = MESSAGES.name;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim().toLowerCase())) errors.email = MESSAGES.email;
  if (v.phone.trim() && !parsePhoneNumberFromString(v.phone, 'BR')?.isValid()) errors.phone = MESSAGES.phone;
  const city = v.city.trim();
  if (city.length < 2 || city.length > 80) errors.city = MESSAGES.city;
  if (!/^[A-Z]{2}$/.test(v.state.trim().toUpperCase())) errors.state = MESSAGES.state;
  return errors;
}

const STEP1_MESSAGES = new Set(Object.values(MESSAGES));

/** Em que etapa do formulário está o campo de que o servidor reclamou. */
export function stepOfServerError(message: string): 1 | 2 {
  return STEP1_MESSAGES.has(message) ? 1 : 2;
}
