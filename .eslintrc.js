module.exports = {
  'env': {
    'browser': true,
    'es6': true,
  },
  'extends': [
    'eslint:recommended',
  ],
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
    'Plotly': 'readonly'
  },
  'parserOptions': {
    'ecmaVersion': 11,
  },
  'rules': {
  },
};
