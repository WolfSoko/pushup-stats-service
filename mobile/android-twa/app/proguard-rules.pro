# R8 keep rules for the TWA wrapper.
#
# Empty on purpose: every class the app owns (Application, LauncherActivity,
# DelegationService) is referenced from AndroidManifest.xml and kept by the
# manifest keep rules AGP generates; androidbrowserhelper ships its own
# consumer rules in the AAR. The file still has to exist — AGP 9 sets
# android.proguard.failOnMissingFiles=true, so a declared but missing
# proguardFiles entry fails the build.
