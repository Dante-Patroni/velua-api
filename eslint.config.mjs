import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "docs/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      eqeqeq: ["error", "always"],
      "require-await": "error",
      "no-return-await": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["tests/**/*.js", "**/*.test.js"],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      "require-await": "off",
    },
  },

  {
    files: ["src/**/*.js"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
            MethodDefinition: true,
          },
        },
      ],
      "jsdoc/require-description": ["error", { descriptionStyle: "tag" }],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/check-tag-names": ["error", { definedTags: ["openapi"] }],
      "jsdoc/check-param-names": "error",
    },
  },
  {
    files: ["src/repositories/*Repository.js"],
    rules: {
      "require-await": "off",
    },
  },
  prettier,
];
