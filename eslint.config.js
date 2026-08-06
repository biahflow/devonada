const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

module.exports = [
  { ignores: ['node_modules/**', 'backend/**', '.expo/**', 'dist/**', '*.config.js'] },
  ...expoConfig,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Guardrail: valor monetário é centavo inteiro. `any` costuma ser a porta
      // de entrada de um float vindo do backend sem ninguém perceber.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
