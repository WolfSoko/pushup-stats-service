export * from './logic';
export * from './public-profile';
// `og-render` is intentionally NOT re-exported here. It pulls in
// satori + @resvg/resvg-wasm (~15 MB + WASM init), and re-exporting from
// the shared barrel would force every other Cloud Function (leaderboards,
// motivation, push, etc.) to eagerly load those modules at boot — blowing
// up cold-start latency and making any renderer load failure crash unrelated
// triggers. Import `renderProfileOg` directly from `./profile/og-render`
// in the one place that needs it.
