/**
 * Shipped XP per rate unit for every catalog exercise — per rep, per
 * minute (`time`) or per kilometre (`distance-time`), see `xpRateUnit`.
 *
 * The anchor is one pushup = 1 XP; the rest are weighted by effort
 * relative to it. Admins override single values in `xpConfig/current`;
 * a guard test keeps this map in lock-step with `EXERCISE_CATALOG`.
 */
export const DEFAULT_XP_RATES: Readonly<Record<string, number>> = {
  pushup: 1,

  'abs.situps': 0.5,
  'abs.crunches': 0.3,
  'abs.legraises': 0.8,
  'abs.russiantwist': 0.3,
  'abs.mountainclimbers': 0.3,
  'core.mountainclimbers.time': 8,
  'core.deadbug': 0.5,
  'core.hollowhold': 10,
  'plank.standard': 8,

  'legs.squats': 0.6,
  'legs.jumpsquats': 1,
  'legs.calfraises': 0.2,
  'squat.wallsit': 6,
  'squat.boxjump': 1,

  'legs.glutebridge': 0.4,
  'hinge.singlelegRdl': 0.8,
  'hinge.goodmorning': 0.5,

  'legs.lunges': 0.7,
  'lunge.stepup': 0.6,

  'push.dips': 1.5,
  'push.benchdips': 0.8,
  'push.handstandhold': 15,

  'pull.pullups': 3,
  'pull.rows': 1.5,
  'pull.deadhang': 8,
  'pull.facepull': 0.5,

  'cardio.running': 60,
  'cardio.walking': 20,
  'cardio.hiking': 30,
  'cardio.nordicwalking': 25,
  'cardio.cycling': 15,
  'cardio.rowing': 50,
  'cardio.swimming': 150,
  'cardio.elliptical': 30,
  'cardio.inlineskating': 15,
  'cardio.crosscountryskiing': 40,
  'cardio.jumprope': 0.1,
  'cardio.burpees': 2,
  'cardio.jumpingjacks': 0.2,
  'cardio.highknees': 8,

  'mobility.stretching': 3,
  'mobility.yoga': 4,
  'mobility.foamrolling': 2,
  'mobility.dynamicwarmup': 4,
  'mobility.catcow': 0.2,
  'mobility.hipopener': 3,
};
