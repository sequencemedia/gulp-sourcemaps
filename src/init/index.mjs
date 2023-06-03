// import debug from '../debug').spawn('init';

import through from 'through2'
import path from 'path'
import * as acorn from 'acorn'
import {
  SourceMapGenerator
} from 'source-map'
import css from 'css'
import PluginError from 'plugin-error'
import initInternals from './index.internals.mjs'
import debug from '../debug.mjs'
import { PLUGIN_NAME, unixStylePath } from '../utils.mjs'

const log = debug.spawn('init')

/**
 * Initialize source mapping chain
 */
export default function init (options) {
  function sourceMapInit (file, encoding, callback) {
    // pass through if file is null or already has a source map
    if (file.isNull() || file.sourceMap) {
      this.push(file)

      console.log('CALLBACK (3)')
      return callback()
    }

    if (file.isStream()) {
      console.log('CALLBACK (2)')

      return callback(new PluginError(PLUGIN_NAME, 'Streaming not supported'))
    }

    if (options === undefined) {
      options = {}
    }

    log(function () {
      return options
    })

    let fileContent = file.contents.toString()
    let sourceMap, preExistingComment
    const internals = initInternals(options, file, fileContent)

    if (options.loadMaps) {
      const result = internals.loadMaps()
      sourceMap = result.map
      fileContent = result.content
      preExistingComment = result.preExistingComment
    }

    if (!sourceMap && options.identityMap) {
      log(() => '**identityMap option is deprecated, update to use sourcemap.identityMap stream**')
      log(function () {
        return 'identityMap'
      })
      const fileType = path.extname(file.path)
      const source = unixStylePath(file.relative)
      const generator = new SourceMapGenerator({ file: source })

      if (fileType === '.js') {
        const tokenizer = acorn.tokenizer(fileContent, { locations: true })
        while (true) {
          const token = tokenizer.getToken()
          if (token.type.label === 'eof') {
            break
          }
          const mapping = {
            original: token.loc.start,
            generated: token.loc.start,
            source
          }
          if (token.type.label === 'name') {
            mapping.name = token.value
          }
          generator.addMapping(mapping)
        }
        generator.setSourceContent(source, fileContent)
        sourceMap = generator.toJSON()
      } else if (fileType === '.css') {
        log('css')
        const ast = css.parse(fileContent, { silent: true })
        log(function () {
          return ast
        })
        const registerTokens = function (ast) {
          if (ast.position) {
            generator.addMapping({ original: ast.position.start, generated: ast.position.start, source })
          }

          function logAst (key, ast) {
            log(function () {
              return 'key: ' + key
            })
            log(function () {
              return ast[key]
            })
          }

          for (const key in ast) {
            logAst(key, ast)
            if (key !== 'position') {
              if (Object.prototype.toString.call(ast[key]) === '[object Object]') {
                registerTokens(ast[key])
              } else if (Array.isArray(ast[key])) {
                log(function () {
                  return '@@@@ ast[key] isArray @@@@'
                })
                for (let i = 0; i < ast[key].length; i++) {
                  registerTokens(ast[key][i])
                }
              }
            }
          }
        }
        registerTokens(ast)
        generator.setSourceContent(source, fileContent)
        sourceMap = generator.toJSON()
      }
    }

    if (!sourceMap) {
      // Make an empty source map
      sourceMap = {
        version: 3,
        names: [],
        mappings: '',
        sources: [unixStylePath(file.relative)],
        sourcesContent: [fileContent]
      }
    } else if (preExistingComment !== null && typeof preExistingComment !== 'undefined') {
      sourceMap.preExistingComment = preExistingComment
    }

    sourceMap.file = unixStylePath(file.relative)
    file.sourceMap = sourceMap

    this.push(file)

    console.log('CALLBACK (1)')

    callback()
  }

  return through.obj(sourceMapInit)
}
