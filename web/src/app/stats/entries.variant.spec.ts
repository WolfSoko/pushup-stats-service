import { createVariantPatch, updateVariantPatch } from './entries.variant';

describe('createVariantPatch', () => {
  it('should map the pushup Typ onto variantId', () => {
    // given a pushup create payload carrying the dialog's "Typ"
    // when the variant patch is built
    const patch = createVariantPatch({ kind: 'pushup', type: 'diamond' });

    // then it targets the shared variantId field
    expect(patch).toEqual({ variantId: 'diamond' });
  });

  it('should omit an empty pushup Typ', () => {
    // given a pushup create payload with a blank Typ
    // when the variant patch is built
    // then nothing is written — a new entry has no variant to clear
    expect(createVariantPatch({ kind: 'pushup', type: '  ' })).toEqual({});
  });

  it('should pass an exercise variantId through', () => {
    // given an exercise create payload
    // when the variant patch is built
    // then the picked variant is kept
    expect(createVariantPatch({ kind: 'exercise', variantId: 'wide' })).toEqual(
      {
        variantId: 'wide',
      }
    );
  });
});

describe('updateVariantPatch', () => {
  it('should map the pushup Typ onto variantId', () => {
    // given a pushup update whose Typ changed
    // when the variant patch is built
    // then the new type reaches the variantId field
    expect(updateVariantPatch({ kind: 'pushup', type: 'wide' })).toEqual({
      variantId: 'wide',
    });
  });

  it('should turn a cleared pushup Typ into the null clear sentinel', () => {
    // given a pushup update whose Typ was emptied
    // when the variant patch is built
    // then `null` is emitted so the data-access layer deletes the field
    expect(updateVariantPatch({ kind: 'pushup', type: '' })).toEqual({
      variantId: null,
    });
  });

  it('should leave the variant untouched when no Typ is supplied', () => {
    // given a pushup update that carries no Typ at all
    // when the variant patch is built
    // then the field is omitted, so the stored variant survives
    expect(updateVariantPatch({ kind: 'pushup' })).toEqual({});
  });

  it('should forward the exercise clear sentinel', () => {
    // given an exercise update clearing its variant
    // when the variant patch is built
    // then the sentinel is preserved
    expect(updateVariantPatch({ kind: 'exercise', variantId: null })).toEqual({
      variantId: null,
    });
  });
});
