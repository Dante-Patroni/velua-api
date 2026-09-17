module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/migrations/**",
    "!src/seeders/**",
    "!src/docs/**",
    "!src/config/**",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
  verbose: true,
};
