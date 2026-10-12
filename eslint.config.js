const js = require('@eslint/js');

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

const jestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly',
};

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  URLSearchParams: 'readonly',
  prompt: 'readonly',
  confirm: 'readonly',
  FormData: 'readonly',
  Option: 'readonly',
  alert: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
};

module.exports = [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...nodeGlobals, ...jestGlobals } },
  },
  
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
];
