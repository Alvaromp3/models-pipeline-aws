const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  watchman: false,
  maxWorkers: 1,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: path.join(__dirname, 'test'),
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
};
