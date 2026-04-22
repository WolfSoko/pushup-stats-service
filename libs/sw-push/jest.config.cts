module.exports = {
  displayName: 'sw-push',
  preset: '../../jest.preset.js',
  coverageDirectory: '../../coverage/libs/sw-push',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|mjs|js)$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  coverageReporters: ['text-summary', 'html', 'json-summary'],
};
