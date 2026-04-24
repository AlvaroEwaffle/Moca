import { describe, expect, it } from 'vitest';
import {
  extractContactData,
  hasMeaningfulBusinessName,
} from '../services/contactDataExtractor.service';

describe('contactDataExtractor', () => {
  it('extracts email, phone, and business name from lead messages', () => {
    const extracted = extractContactData(
      'Mi negocio se llama Ewaffle. Mi correo es alvaro@ewaffle.cl y mi telefono es +56 9 2011 5198.'
    );

    expect(extracted.emails).toEqual(['alvaro@ewaffle.cl']);
    expect(extracted.phones).toEqual(['+56 9 2011 5198']);
    expect(extracted.businessNames).toEqual(['Ewaffle']);
  });

  it('ignores generic or invalid business names', () => {
    expect(hasMeaningfulBusinessName('mi negocio')).toBe(false);
    expect(hasMeaningfulBusinessName('no tengo')).toBe(false);
    expect(hasMeaningfulBusinessName('alvaro@ewaffle.cl')).toBe(false);
    expect(hasMeaningfulBusinessName('https://ewaffle.cl')).toBe(false);
    expect(hasMeaningfulBusinessName('Ewaffle')).toBe(true);
  });
});
