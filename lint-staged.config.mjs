export default {
  '*': ['npx eslint --fix', 'prettier --write --ignore-unknown'],
  'web/src/locale/messages.xlf': ['python3 tools/src/sync-xliff.py'],
};
