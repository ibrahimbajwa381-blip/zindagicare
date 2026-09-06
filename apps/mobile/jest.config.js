/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  clearMocks: true,
  testTimeout: 15000,
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-safe-area-context|react-native-screens|react-native-reanimated|react-native-worklets)",
  ],
  moduleNameMapper: {
    "^@/test-utils/(.*)$": "<rootDir>/tests/mocks/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@app/(.*)$": "<rootDir>/app/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/test-results/"],
  collectCoverageFrom: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}", "!**/*.d.ts"],
};
