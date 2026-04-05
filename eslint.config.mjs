import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vite.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // auth must NOT depend on data-access (decoupled via ports)
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: ['scope:models', 'scope:testing'],
            },
            // motivation must NOT depend on auth (userId passed as param)
            {
              sourceTag: 'scope:motivation',
              onlyDependOnLibsWithTags: ['scope:models'],
            },
            // data-access depends only on models
            {
              sourceTag: 'scope:data-access',
              onlyDependOnLibsWithTags: ['scope:models'],
            },
            // reminders depends on data-access and motivation (NOT auth)
            {
              sourceTag: 'scope:reminders',
              onlyDependOnLibsWithTags: [
                'scope:models',
                'scope:data-access',
                'scope:motivation',
                'scope:testing',
              ],
            },
            // quick-add depends on models (+ testing for specs)
            {
              sourceTag: 'scope:quick-add',
              onlyDependOnLibsWithTags: ['scope:models', 'scope:testing'],
            },
            // ads is isolated
            {
              sourceTag: 'scope:ads',
              onlyDependOnLibsWithTags: ['scope:models'],
            },
            // testing can depend on anything (test utilities)
            {
              sourceTag: 'scope:testing',
              onlyDependOnLibsWithTags: [
                'scope:models',
                'scope:data-access',
                'scope:auth',
              ],
            },
            // cloud-functions depends on models only
            {
              sourceTag: 'scope:cloud-functions',
              onlyDependOnLibsWithTags: ['scope:models'],
            },
            // models has no dependencies
            {
              sourceTag: 'scope:models',
              onlyDependOnLibsWithTags: [],
            },
            // app can depend on everything
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:auth',
                'scope:data-access',
                'scope:models',
                'scope:reminders',
                'scope:quick-add',
                'scope:ads',
                'scope:motivation',
                'scope:testing',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
