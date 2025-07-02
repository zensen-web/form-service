import babel from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'

export default [
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/form-service.umd.js',
        format: 'umd',
        name: 'FormService',
        sourcemap: true
      }
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      })
    ]
  },
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/form-service.umd.min.js',
        format: 'umd',
        name: 'FormService',
        sourcemap: true
      }
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      }),
      terser()
    ]
  },
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/form-service.esm.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      })
    ]
  },
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/form-service.esm.min.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**'
      }),
      terser()
    ]
  }
]