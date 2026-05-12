export default {
  '*': ['npx eslint --fix', 'prettier --write --ignore-unknown'],
  'web/src/locale/messages.xlf': ['node tools/src/sync-xliff-translations.js'],
};
