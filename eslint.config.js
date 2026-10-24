const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  { ignores: ["dist/**", ".expo/**"] },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "import/no-unresolved": "off",
    },
  },
]);
