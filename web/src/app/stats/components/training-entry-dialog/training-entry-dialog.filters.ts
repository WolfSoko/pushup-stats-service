import { PushupTypeOption } from './training-entry-dialog.models';

// Autocomplete filters for the pushup-mode type/source inputs. An exact match
// keeps the full list so the dropdown still offers every option after a pick.
export function filterStringOptions(
  value: string | null | undefined,
  options: ReadonlyArray<string>
): string[] {
  const needle = (value ?? '').toLowerCase().trim();
  if (!needle) return [...options];
  if (options.some((opt) => opt.toLowerCase() === needle)) return [...options];
  return options.filter((opt) => opt.toLowerCase().includes(needle));
}

export function filterPushupTypeOptions(
  value: string | null | undefined,
  options: ReadonlyArray<PushupTypeOption>
): PushupTypeOption[] {
  const needle = (value ?? '').toLowerCase().trim();
  if (!needle) return [...options];
  const exact = options.some(
    (opt) =>
      opt.value.toLowerCase() === needle || opt.label.toLowerCase() === needle
  );
  if (exact) return [...options];
  return options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(needle) ||
      opt.value.toLowerCase().includes(needle)
  );
}
