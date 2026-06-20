import type { GoalScopeDescriptor, WeekdayOption } from './goals-page.models';

export const WEEKDAYS: readonly WeekdayOption[] = [
  { value: 1, label: $localize`:@@goals.weekday.short.mon:Mo` },
  { value: 2, label: $localize`:@@goals.weekday.short.tue:Di` },
  { value: 3, label: $localize`:@@goals.weekday.short.wed:Mi` },
  { value: 4, label: $localize`:@@goals.weekday.short.thu:Do` },
  { value: 5, label: $localize`:@@goals.weekday.short.fri:Fr` },
  { value: 6, label: $localize`:@@goals.weekday.short.sat:Sa` },
  { value: 0, label: $localize`:@@goals.weekday.short.sun:So` },
];

export const GOAL_SCOPES: readonly GoalScopeDescriptor[] = [
  {
    id: 'daily',
    icon: 'today',
    title: $localize`:@@goals.section.daily.title:Tagesziele`,
    subtitle: $localize`:@@goals.section.daily.subtitle:Was du an einzelnen Wochentagen schaffen willst.`,
  },
  {
    id: 'weekly',
    icon: 'date_range',
    title: $localize`:@@goals.section.weekly.title:Wochenziele`,
    subtitle: $localize`:@@goals.section.weekly.subtitle:Summen pro Übung über die ganze Woche.`,
  },
  {
    id: 'monthly',
    icon: 'calendar_month',
    title: $localize`:@@goals.section.monthly.title:Monatsziele`,
    subtitle: $localize`:@@goals.section.monthly.subtitle:Größere Ziele über den ganzen Monat verteilt.`,
  },
];
