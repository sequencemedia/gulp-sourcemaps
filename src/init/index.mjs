// import debug from '../debug').spawn('init';

import path from 'node:path'
import through from 'through2'
import * as acorn from 'acorn'
import {
  SourceMapGenerator
} from 'source-map'
import css from 'css'
import PluginError from 'plugin-error'

import {
  PLUGIN_NAME,
  unixStylePath
} from '#utils'

import initInternals from './internals.mjs'

function registerTokens (generator, ast, source) {
  if (ast.position) {
    generator.addMapping({ original: ast.position.start, generated: ast.position.start, source })
  }

  for (const key in ast) {
    if (key !== 'position') {
      const token = ast[key]
      if (Object.prototype.toString.call(token) === '[object Object]') {
        registerTokens(generator, token, source)
      } else if (Array.isArray(token)) {
        token.forEach((ast) => {
          registerTokens(generator, ast, source)
        })
      }
    }
  }
}

function getTransformFor (options) {
  return function transform (file, encoding, done) {
    if (file.isNull() || file.sourceMap) {
      this.push(file)
      return done()
    }

    if (file.isStream()) {
      return done(new PluginError(PLUGIN_NAME, 'Streaming not supported'))
    }

    let fileContent = file.contents.toString()
    let sourceMap
    let preExistingComment

    const internals = initInternals(options, file, fileContent)

    if (options.loadMaps) {
      const result = internals.loadMaps()
      sourceMap = result.map
      fileContent = result.content
      preExistingComment = result.preExistingComment
    }

    if (!sourceMap && options.identityMap) {
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
      } else {
        if (fileType === '.css') {
          const ast = css.parse(fileContent, { silent: true })

          registerTokens(generator, ast, source)

          generator.setSourceContent(source, fileContent)
          sourceMap = generator.toJSON()
        }
      }
    }

    if (!sourceMap) {
      sourceMap = {
        version: 3,
        names: [],
        mappings: '',
        sources: [unixStylePath(file.relative)],
        sourcesContent: [fileContent]
      }
    } else {
      if (preExistingComment) {
        sourceMap.preExistingComment = preExistingComment
      }
    }

    sourceMap.file = unixStylePath(file.relative)
    file.sourceMap = sourceMap

    this.push(file)
    return done()
  }
}

/**
 * Initialize source mapping chain
 */
export default function init (options = {}) {
  return through.obj(getTransformFor(options))
}
