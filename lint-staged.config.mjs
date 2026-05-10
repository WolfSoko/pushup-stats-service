export default {
  '*': ['npx eslint --fix', 'prettier --write --ignore-unknown'],
  'web/src/locale/messages.xlf': () => [
    'node tools/src/sync-xlf-translations.js',
    'git add web/src/locale',
  ],
};
