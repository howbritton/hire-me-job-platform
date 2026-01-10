module.exports = {
  env: {
      es6: true,
      node: true,
  },
  parserOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
  },
  extends: [
      "eslint:recommended",
      "google",
  ],
  rules: {
      "no-restricted-globals": ["error", "name", "length"],
      "prefer-arrow-callback": "error",
      "quotes": ["error", "double", {"allowTemplateLiterals": true}],
      "max-len": ["error", {
          "code": 70,
          "ignoreUrls": true,
          "ignoreStrings": true,
          "ignoreTemplateLiterals": true,
          "ignoreComments": true
      }],
      "indent": ["error", 2],  // Google style uses 2 spaces
      "object-curly-spacing": ["error", "always"],
      "semi": ["error", "always"]
  },
  overrides: [
      {
          files: ["**/*.spec.*"],
          env: {
              mocha: true,
          },
          rules: {},
      },
  ],
  globals: {},
};
