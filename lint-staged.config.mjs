export default {
  'web/src/locale/messages.xlf': [
    () => 'node tools/src/sync-translations.mjs',
    () => 'git add web/src/locale/',
  ],
  '*': ['npx eslint --fix', 'prettier --write --ignore-unknown'],
};
