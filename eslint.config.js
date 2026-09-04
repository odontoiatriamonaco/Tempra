// Tempra v1.0.0 — 2026-09-04 14:30

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      // 'latest' e non 2023: i test del catalogo usano gli import attributes
      // (`with { type: 'json' }`), che espree riconosce solo da ES2025.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Con il transform JSX automatico di Vite non serve importare React.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Spec 1.3: nessuna richiesta di rete a runtime. Il lint è il primo
      // controllo, il test Playwright di 10.6 è quello definitivo.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Nessuna chiamata di rete a runtime (spec 1.3).' },
      ],
    },
  },

  {
    // Il service worker precachea gli asset dell'app: lì `fetch` è legittimo,
    // ed è comunque limitato all'origin dalla CSP di vercel.json.
    files: ['tests/**/*.{js,jsx}', 'scripts/**/*.mjs', '*.config.js', 'sw.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off' },
  },

  {
    // `sw.js` è un modello: i due segnaposto vengono sostituiti alla build dal
    // plugin in vite.config.js, che conosce i nomi definitivi degli asset.
    files: ['sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, __PRECACHE__: 'readonly' },
    },
    rules: { 'no-restricted-globals': 'off' },
  },
];
