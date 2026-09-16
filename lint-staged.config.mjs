export default {
  '*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}': 'oxlint --fix',
  '*.html': 'eslint',
  '*': 'oxfmt --no-error-on-unmatched-pattern',
};
