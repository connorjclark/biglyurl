// this is a delicate ecosystem
// built via adaptation of these articles:
// https://barryvanveen.nl/blog/26-how-to-bundle-and-compile-es2015-into-javascript
// https://duske.me/easy-es2015-compilation-with-rollup-js-and-gulp-js/

import gulp from 'gulp'
import rollup from 'rollup-stream'
import babel from 'gulp-babel'
import minify from 'gulp-minify'
import util from 'gulp-util'
import ghPages from 'gulp-gh-pages'
import buffer from 'vinyl-buffer'
import source from 'vinyl-source-stream'

// rollup plugins

// allows for json files to be copied to the bundle, without being processed
// by the pipeline as a JS file
// w/o this plugin, get error b/c package 'markovchain' requires its 'package.json':
// PARSE_ERROR: '../node_modules/markovchain/package.json'
// https://github.com/rollup/rollup-plugin-commonjs/issues/28#issuecomment-167934572
import json from 'rollup-plugin-json'

// Convert CommonJS modules to ES6, so they can be included in a Rollup bundle
// ex: module.exports = { default: 'foobar', __esModule: true } -> export default 'foobar'
import commonjs from 'rollup-plugin-commonjs'

// packs required resources in the bundle, can be pointed to node_modules to bundle the world
import nodeResolve from 'rollup-plugin-node-resolve'

// mocks out things like 'fs'
import builtins from 'rollup-plugin-node-builtins'

// need "Buffer" to be defined in the web
import globals from 'rollup-plugin-node-globals'

// copy static files to build folder
import copy from 'rollup-plugin-copy'

gulp.task('bundle', () => {
  return rollup({
    entry: './src/index.js',
    plugins: [
      json(),
      builtins(),
      nodeResolve({
        jsnext: true,
        main: true,
        globals: false,
        extensions: [ '.js', '.json', '.txt' ]  // Default: ['.js']
      }),
      commonjs({
        include: 'node_modules/**'
      }),
      globals(),
      copy({
        'index.html': 'dist/index.html',
        'trump.txt': 'dist/trump.txt',
        verbose: true
      })
    ],
    format: 'iife',
    moduleName: 'app'
  })
  .on('error', util.log)
  .pipe(source('index.js', './src'))
  .pipe(buffer())
  .pipe(babel())
  .pipe(minify({
    ext: {
      min: '.js'
    },
    ignoreFiles: ['-min.js']
  }))
  .pipe(gulp.dest('dist/js'))
})

gulp.task('deploy', function () {
  return gulp.src('./dist/**/*')
    .pipe(ghPages())
})
