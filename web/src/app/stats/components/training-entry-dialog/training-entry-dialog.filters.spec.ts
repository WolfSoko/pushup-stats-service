import {
  filterPushupTypeOptions,
  filterStringOptions,
} from './training-entry-dialog.filters';
import { PushupTypeOption } from './training-entry-dialog.models';

const SOURCES = ['web', 'whatsapp'];
const TYPES: PushupTypeOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'diamond', label: 'Diamant' },
  { value: 'wide', label: 'Breit' },
];

describe('training-entry-dialog.filters', () => {
  describe('filterStringOptions', () => {
    it('should return all options for empty/blank input', () => {
      // given / when / then
      expect(filterStringOptions('', SOURCES)).toEqual(SOURCES);
      expect(filterStringOptions('   ', SOURCES)).toEqual(SOURCES);
      expect(filterStringOptions(null, SOURCES)).toEqual(SOURCES);
      expect(filterStringOptions(undefined, SOURCES)).toEqual(SOURCES);
    });

    it('should return the full list when the input exactly matches an option (case-insensitive)', () => {
      // given — an exact pick should still offer every option in the dropdown
      // when / then
      expect(filterStringOptions('WEB', SOURCES)).toEqual(SOURCES);
    });

    it('should substring-filter case-insensitively for a partial input', () => {
      // given / when / then
      expect(filterStringOptions('what', SOURCES)).toEqual(['whatsapp']);
      expect(filterStringOptions('APP', SOURCES)).toEqual(['whatsapp']);
    });

    it('should return an empty list when nothing matches', () => {
      // given / when / then
      expect(filterStringOptions('xyz', SOURCES)).toEqual([]);
    });
  });

  describe('filterPushupTypeOptions', () => {
    it('should return all options for empty/blank input', () => {
      // given / when / then
      expect(filterPushupTypeOptions('', TYPES)).toEqual(TYPES);
      expect(filterPushupTypeOptions('  ', TYPES)).toEqual(TYPES);
      expect(filterPushupTypeOptions(null, TYPES)).toEqual(TYPES);
    });

    it('should return the full list when the input exactly matches a value or label', () => {
      // given — exact match by value
      expect(filterPushupTypeOptions('diamond', TYPES)).toEqual(TYPES);
      // given — exact match by localized label (case-insensitive)
      expect(filterPushupTypeOptions('diamant', TYPES)).toEqual(TYPES);
    });

    it('should match on either label or value for a partial input', () => {
      // given — partial label
      expect(filterPushupTypeOptions('Brei', TYPES)).toEqual([
        { value: 'wide', label: 'Breit' },
      ]);
      // given — partial value
      expect(filterPushupTypeOptions('stand', TYPES)).toEqual([
        { value: 'standard', label: 'Standard' },
      ]);
    });

    it('should return an empty list when neither label nor value matches', () => {
      // given / when / then
      expect(filterPushupTypeOptions('zzz', TYPES)).toEqual([]);
    });
  });
});
