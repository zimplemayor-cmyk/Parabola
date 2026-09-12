import nextConfig from "eslint-config-next";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    ignores: ["contracts/**", ".next/**", "node_modules/**"],
  },
];

export default config;
