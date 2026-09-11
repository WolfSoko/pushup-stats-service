import type { ExerciseGroupKind } from './profile-view.model';

/**
 * Every fixed string on the public profile, in one place.
 *
 * The page component owns loading, visibility switches and the photo
 * upload; a 30-line block of captions on top of that made it hard to see
 * what the class actually does. Static data, so the size rule does not
 * apply here.
 */
export const PROFILE_LABELS = {
  privateTitle: $localize`:@@publicProfile.private.title:Dein Profil ist noch privat`,
  privateBody: $localize`:@@publicProfile.private.body:Niemand außer dir kann es sehen. Tippe unten bei einem Element auf das Symbol und wähle „Für alle zeigen“, um dein Profil teilen zu können.`,
  week: $localize`:@@publicProfile.week:Diese Woche`,
  month: $localize`:@@publicProfile.month:Dieser Monat`,
  exercises: $localize`:@@publicProfile.exercises:Übungen`,
  heatmap: $localize`:@@publicProfile.heatmap:Wann trainiert wird`,
  recent: $localize`:@@publicProfile.recent:Letzte Übungen`,
  heatmapAria: $localize`:@@publicProfile.heatmap.aria:Trainingsverteilung über Wochentage und Tageszeit`,
  memberSince: $localize`:@@publicProfile.memberSince:Dabei seit`,
  notFoundTitle: $localize`:@@publicProfile.notFound.title:Profil nicht gefunden`,
  notFoundBody: $localize`:@@publicProfile.notFound.body:Dieses Profil existiert nicht oder wurde nicht öffentlich freigegeben.`,
  errorTitle: $localize`:@@publicProfile.error.title:Profil konnte nicht geladen werden`,
  errorBody: $localize`:@@publicProfile.error.body:Bitte versuche es später erneut.`,
  retry: $localize`:@@publicProfile.retry:Erneut versuchen`,
  home: $localize`:@@publicProfile.toHome:Zur Startseite`,
  stats: $localize`:@@publicProfile.stats:Statistik`,
  total: $localize`:@@publicProfile.total:Gesamte Reps`,
  streak: $localize`:@@publicProfile.streak:Aktuelle Streak`,
  days: $localize`:@@publicProfile.days:Aktive Tage`,
  entries: $localize`:@@publicProfile.entries:Einträge`,
  bestSet: $localize`:@@publicProfile.bestSet:Bester Einzel-Eintrag`,
  bestDay: $localize`:@@publicProfile.bestDay:Bester Tag`,
  shareAria: $localize`:@@publicProfile.share.aria:Profil teilen`,
  achievements: $localize`:@@publicProfile.achievements:Trainingsplan-Erfolge`,
  share: $localize`:@@publicProfile.share:Teilen`,
  cta: $localize`:@@publicProfile.cta:Selbst tracken – pushup-stats.com`,
  ownerTitle: $localize`:@@publicProfile.owner.title:Nur für dich sichtbar`,
  ownerHint: $localize`:@@publicProfile.owner.hint:Tippe bei einem Element auf das Symbol, um festzulegen, wer es sieht: alle, nur deine Freunde, oder niemand. Diesen Bereich und die Symbole sehen nur du.`,
  legendPublic: $localize`:@@publicProfile.owner.legend.public:Für alle sichtbar, die deinen Profil-Link haben.`,
  legendFriends: $localize`:@@publicProfile.owner.legend.friends:Nur für Freunde, die deine Anfrage bestätigt haben.`,
  legendOff: $localize`:@@publicProfile.owner.legend.off:Für niemanden – nur du siehst es, hier abgeblendet dargestellt.`,
  /** The preview picker: whose view of the profile is on screen. */
  previewGroup: $localize`:@@publicProfile.owner.preview.group:Ansicht wählen`,
  previewOwner: $localize`:@@publicProfile.owner.preview.owner:Bearbeiten`,
  previewFriend: $localize`:@@publicProfile.owner.preview.friend:Als Freund`,
  previewPublic: $localize`:@@publicProfile.owner.preview:Als Besucher`,
  previewLocked: $localize`:@@publicProfile.owner.preview.locked:Die Besucher-Ansicht gibt es erst, wenn dein Profil öffentlich ist.`,
  previewNoteFriend: $localize`:@@publicProfile.owner.preview.noteFriend:So sieht dein Profil für Freunde aus, die deine Anfrage bestätigt haben.`,
  previewNotePublic: $localize`:@@publicProfile.owner.preview.notePublic:So sieht dein Profil für alle aus, die deinen Profil-Link haben.`,
  photoEdit: $localize`:@@publicProfile.owner.photoEdit:Profilbild ändern`,
  /** Current audience of one element, for the switch's tooltip. */
  visibilityPublic: $localize`:@@publicProfile.owner.visibility.public:Für alle sichtbar`,
  visibilityFriends: $localize`:@@publicProfile.owner.visibility.friends:Nur für Freunde sichtbar`,
  visibilityOff: $localize`:@@publicProfile.owner.visibility.off:Für niemanden sichtbar`,
  /** What the next tap does. */
  visibilityNextFriends: $localize`:@@publicProfile.owner.visibility.nextFriends:Tippen: nur Freunde`,
  visibilityNextOff: $localize`:@@publicProfile.owner.visibility.nextOff:Tippen: ausblenden`,
  visibilityNextPublic: $localize`:@@publicProfile.owner.visibility.nextPublic:Tippen: für alle zeigen`,
} as const;

export const EXERCISE_GROUP_LABELS: Readonly<
  Record<ExerciseGroupKind, string>
> = {
  reps: $localize`:@@publicProfile.exercises.reps:Stückübungen`,
  time: $localize`:@@publicProfile.exercises.time:Zeitübungen`,
  distance: $localize`:@@publicProfile.exercises.distance:Streckenübungen`,
  weight: $localize`:@@publicProfile.exercises.weight:Gewichtsübungen`,
};

export const WEEKDAY_LABELS: Readonly<Record<string, string>> = {
  Mo: $localize`:@@weekday.short.mon:Mo`,
  Di: $localize`:@@weekday.short.tue:Di`,
  Mi: $localize`:@@weekday.short.wed:Mi`,
  Do: $localize`:@@weekday.short.thu:Do`,
  Fr: $localize`:@@weekday.short.fri:Fr`,
  Sa: $localize`:@@weekday.short.sat:Sa`,
  So: $localize`:@@weekday.short.sun:So`,
};
