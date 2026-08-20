const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

module.exports = [
  { ignores: ['node_modules/**', 'backend/**', '.expo/**', 'dist/**', '*.config.js'] },
  ...expoConfig,
  ...tseslint.configs.recommended,
  {
    // Setup e testes rodam em Node sob jest: globais de teste e require() são
    // o idioma correto ali, não uma exceção sendo aberta no código do app.
    // `**/*.test.js` cobre `scripts/`, que é ferramenta de linha de comando em
    // node puro — fora do tsconfig e sem transpilador, por isso em JS.
    files: ['jest.setup.js', '**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { jest: 'readonly', require: 'readonly' } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
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
