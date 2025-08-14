const typescript = require('@rollup/plugin-typescript');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const postcss = require('rollup-plugin-postcss');

module.exports = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom'
  ],
  plugins: [
    nodeResolve(),
    postcss({
      extract: true, // Extract CSS to separate file
      minimize: true // Minify CSS
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false, // We'll generate declarations separately
      declarationMap: false
    })
  ]
};