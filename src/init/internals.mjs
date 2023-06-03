import path from 'node:path'
import fs from 'graceful-fs'

import convert from 'convert-source-map'
import stripBom from 'strip-bom-string'

import {
  URL_PATTERN,
  unixStylePath,
  exceptionToString,
  getInlinePreExisting
} from '#utils'

import rootDebug from '#debug'

const debug = rootDebug.spawn('init:internals')

function fixSources (sources, file) {
  // fix source paths and sourceContent for imported source map
  if (sources.map) {
    sources.map.sourcesContent = sources.map.sourcesContent || []
    sources.map.sources.forEach(function (source, i) {
      if (source.match(URL_PATTERN)) {
        sources.map.sourcesContent[i] = sources.map.sourcesContent[i] || null
        return
      }

      let absPath = path.resolve(sources.path, source)
      sources.map.sources[i] = unixStylePath(path.relative(file.base, absPath))

      if (!sources.map.sourcesContent[i]) {
        let sourceContent = null
        if (sources.map.sourceRoot) {
          if (sources.map.sourceRoot.match(URL_PATTERN)) {
            sources.map.sourcesContent[i] = null
            return
          }

          absPath = path.resolve(sources.path, sources.map.sourceRoot, source)
        }

        // if current file: use content
        if (absPath === file.path) {
          sourceContent = sources.content
        } else { // attempt load content from file
          try {
            sourceContent = stripBom(fs.readFileSync(absPath, 'utf8'))
          } catch {
            debug(() => 'warn: source file not found: ' + absPath)
          }
        }

        sources.map.sourcesContent[i] = sourceContent
      }
    })
    // remove source map comment from source
    file.contents = Buffer.from(sources.content, 'utf8')
  }
}

function getInlineSources (sources, options, file) {
  sources.preExistingComment = getInlinePreExisting(sources.content)

  // Try to read inline source map
  sources.map = convert.fromSource(sources.content, options.largeFile)

  if (!sources.map) {
    return sources
  }

  sources.map = sources.map.toObject()
  // sources in map are relative to the source file
  sources.path = path.dirname(file.path)
  if (!options.largeFile) {
    sources.content = convert.removeComments(sources.content)
  }
}

function getFileSources (sources, file) {
  // look for source map comment referencing a source map file
  const mapComment = convert.mapFileCommentRegex.exec(sources.content)
  let mapFile

  if (mapComment) {
    sources.preExistingComment = mapComment[1] || mapComment[2]
    mapFile = path.resolve(path.dirname(file.path), sources.preExistingComment)
    sources.content = convert.removeMapFileComments(sources.content)
    // if no comment try map file with same name as source file
  } else {
    mapFile = file.path + '.map'
  }

  // sources in external map are relative to map file
  sources.path = path.dirname(mapFile)

  try {
    sources.map = JSON.parse(stripBom(fs.readFileSync(mapFile, 'utf8')))
  } catch (e) {
    debug(() => 'warn: external source map not found or invalid: ' + mapFile + ' ' + exceptionToString(e))
  }
}

export default function internals (options, file, fileContent) {
  function loadMaps () {
    const sources = {
      path: '',
      map: null,
      content: fileContent,
      preExistingComment: null
    }

    getInlineSources(sources, options, file)

    if (!sources.map) {
      getFileSources(sources, file)
    }

    fixSources(sources, file)

    return sources
  }

  return {
    loadMaps
  }
};
