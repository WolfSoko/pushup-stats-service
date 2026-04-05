module.exports = {
  displayName: 'cloud-functions',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/data-store/functions',
  coverageReporters: ['text-summary', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
