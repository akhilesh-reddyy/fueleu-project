/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  // Resolve paths matching the import aliases used in domain/application layers
  moduleNameMapper: {
    "^../src/core/domain/domain$":           "<rootDir>/src/core/domain/domain.ts",
    "^../src/core/application/application$": "<rootDir>/src/core/application/application.ts",
    "^../src/adapters/inbound/http/http$":   "<rootDir>/src/adapters/inbound/http/http.ts",
  },

  // Pick up both unit and integration test files
  testMatch: [
    "**/*.test.ts",
    "**/*.integration.test.ts",
  ],

  // ts-jest config: strict mode, same tsconfig as production
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        module: "CommonJS",
        target: "ES2020",
      },
    }],
  },

  // Coverage report for domain + application layers only
  collectCoverageFrom: [
    "src/core/**/*.ts",
    "!src/**/*.d.ts",
  ],

  coverageThresholds: {
    global: {
      branches:  80,
      functions: 90,
      lines:     90,
      statements: 90,
    },
  },

  // Fail fast in CI
  bail: 1,

  // Verbose output shows each test name
  verbose: true,
};
