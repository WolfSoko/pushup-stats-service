export default {
  '*': ['oxlint --fix', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.html': 'eslint',
};
