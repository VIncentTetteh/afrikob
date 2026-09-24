import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Underscore marks a deliberately discarded binding (destructuring a
      // secret away, or an unused positional argument).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-e2e/**",
      ".next-verify/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
];

export default eslintConfig;
