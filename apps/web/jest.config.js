// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS is required for Jest config files.
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@zindagi/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@zindagi/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
    "^@zindagi/database$": "<rootDir>/../../packages/database/src/index.ts",
    "^@zindagi/database/(.*)$": "<rootDir>/../../packages/database/src/$1",
    "^@zindagi/validators$": "<rootDir>/../../packages/validators/src/index.ts",
    "^@zindagi/validators/(.*)$": "<rootDir>/../../packages/validators/src/$1",
  },
};

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  // next/jest's default transformIgnorePatterns excludes jose (ESM-only) from
  // transformation; replace it so SWC transforms jose instead of leaving it
  // as untransformed ESM (needed for the mobile-jwt edge-case tests).
  config.transformIgnorePatterns = ["/node_modules/(?!(jose)/)"];
  return config;
};
