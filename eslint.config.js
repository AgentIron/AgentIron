import solid from "eslint-plugin-solid/configs/typescript";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    ...solid,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "tsconfig.json",
      },
    },
  },
  {
    ignores: ["dist/", "src-tauri/", "node_modules/"],
  },
];
