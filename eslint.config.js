import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1. Ignorer les dossiers non concernés (notamment le backend Rust)
  { ignores: ['dist', 'src-tauri', 'node_modules', '**/*.d.ts'] },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      // Désactive les règles ESLint qui entreraient en conflit avec Prettier
      eslintConfigPrettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // 2. Configuration des Plugins
    plugins: {
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'prettier': prettier,
    },
    // 3. Configuration des Règles
    rules: {
      // --- Règles Prettier ---
      'prettier/prettier': 'error', // Signale les erreurs de formatage comme des erreurs ESLint

      // --- Règles React ---
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/jsx-uses-react': 'off', // Pas nécessaire avec React 17+
      'react/react-in-jsx-scope': 'off', // Pas nécessaire avec React 17+
      'react/prop-types': 'off', // On utilise TypeScript, donc pas besoin de PropTypes

      // --- Règles TypeScript ---
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', // Ignore les arguments commençant par "_"
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn', // Avertit si on utilise 'any' (mauvaise pratique)

      // --- Règles Générales ---
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Avertit sur les console.log (laissés par erreur)
    },
    settings: {
      react: {
        version: 'detect', // Détecte automatiquement la version de React installée
      },
    },
  },
);