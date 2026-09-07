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
  privateBody: $localize`:@@publicProfile.private.body:Niemand außer dir kann es sehen. Schalte es in den Einstellungen frei, um es teilen zu können.`,
  privateCta: $localize`:@@publicProfile.private.cta:Profil öffentlich machen`,
  week: $localize`:@@publicProfile.week:Diese Woche`,
  month: $localize`:@@publicProfile.month:Dieser Monat`,
  exercises: $localize`:@@publicProfile.exercises:Übungen`,
  heatmap: $localize`:@@publicProfile.heatmap:Wann trainiert wird`,
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
  achievements: $localize`:@@publicProfile.achievements:Erfolge bei Liegestützen`,
  exercisesReps: $localize`:@@publicProfile.exercises.reps:Stückübungen`,
  exercisesTime: $localize`:@@publicProfile.exercises.time:Zeitübungen`,
  exercisesDistance: $localize`:@@publicProfile.exercises.distance:Streckenübungen`,
  share: $localize`:@@publicProfile.share:Teilen`,
  cta: $localize`:@@publicProfile.cta:Selbst tracken – pushup-stats.com`,
  ownerTitle: $localize`:@@publicProfile.owner.title:Nur für dich sichtbar`,
  ownerHint: $localize`:@@publicProfile.owner.hint:Tippe bei einem Element auf das Auge, um zu bestimmen, ob es auf deinem öffentlichen Profil erscheint. Diesen Bereich und die Augen-Symbole sehen nur du.`,
  legendVisible: $localize`:@@publicProfile.owner.legendVisible:Wird auf deinem öffentlichen Profil angezeigt.`,
  legendHidden: $localize`:@@publicProfile.owner.legendHidden:Ausgeblendet – nur du siehst es, hier abgeblendet dargestellt.`,
  previewAsVisitor: $localize`:@@publicProfile.owner.preview:Als Besucher ansehen`,
  photoEdit: $localize`:@@publicProfile.owner.photoEdit:Profilbild ändern`,
  hideElement: $localize`:@@publicProfile.owner.hideElement:Auf dem öffentlichen Profil ausblenden`,
  showElement: $localize`:@@publicProfile.owner.showElement:Auf dem öffentlichen Profil anzeigen`,
} as const;

export const WEEKDAY_LABELS: Readonly<Record<string, string>> = {
  Mo: $localize`:@@weekday.short.mon:Mo`,
  Di: $localize`:@@weekday.short.tue:Di`,
  Mi: $localize`:@@weekday.short.wed:Mi`,
  Do: $localize`:@@weekday.short.thu:Do`,
  Fr: $localize`:@@weekday.short.fri:Fr`,
  Sa: $localize`:@@weekday.short.sat:Sa`,
  So: $localize`:@@weekday.short.sun:So`,
};
