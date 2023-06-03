import path from 'node:path'
import fs from 'graceful-fs'

import stripBom from 'strip-bom-string'

import {
  unixStylePath,
  getCommentFormatter
} from '#utils'

import rootDebug from '#debug'

const debug = rootDebug.spawn('write:internals')

export default function internals (destination, options) {
  function sourceRoot (file) {
    const sourceMap = file.sourceMap

    if (typeof options.sourceRoot === 'function') {
      sourceMap.sourceRoot = options.sourceRoot(file)
    } else {
      sourceMap.sourceRoot = options.sourceRoot
    }

    if (sourceMap.sourceRoot === null) {
      sourceMap.sourceRoot = undefined
    }
  }

  function mapSources (file) {
    // NOTE: make sure source mapping happens after content has been loaded
    if (options.mapSources && typeof options.mapSources === 'function') {
      file.sourceMap.sources = file.sourceMap.sources.map((filePath) => options.mapSources(filePath, file))
      return
    }

    file.sourceMap.sources = file.sourceMap.sources.map(function (filePath) {
      // keep the references files like ../node_modules within the sourceRoot

      if (options.mapSourcesAbsolute === true) {
        if (!file.dirname) {
          filePath = path.join(file.base, filePath).replace(file.cwd, '')
        } else {
          filePath = path.resolve(file.dirname, filePath).replace(file.cwd, '')
        }
      }

      return unixStylePath(filePath)
    })
  }

  function loadContent (file) {
    const sourceMap = file.sourceMap
    if (options.includeContent) {
      sourceMap.sourcesContent = sourceMap.sourcesContent || []

      // load missing source content
      for (let i = 0; i < sourceMap.sources.length; i++) {
        if (!sourceMap.sourcesContent[i]) {
          const sourcePath = path.resolve(file.base, sourceMap.sources[i])
          try {
            sourceMap.sourcesContent[i] = stripBom(fs.readFileSync(sourcePath, 'utf8'))
          } catch {
            debug(() => 'source file not found: ' + sourcePath)
          }
        }
      }
    } else {
      delete sourceMap.sourcesContent
    }
  }

  function mapDestinationPath (file, stream) {
    const sourceMap = file.sourceMap

    let comment
    const commentFormatter = getCommentFormatter(file)

    if (destination === undefined || destination === null) {
      // encode source map into comment
      const base64Map = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
      comment = commentFormatter('data:application/json;charset=' + options.charset + ';base64,' + base64Map)
    } else {
      let mapFile = path.join(destination, file.relative) + '.map'
      // custom map file name
      if (options.mapFile && typeof options.mapFile === 'function') {
        mapFile = options.mapFile(mapFile)
      }

      const sourceMapPath = path.join(file.base, mapFile)

      // if explicit destination path is set
      if (options.destination) {
        const destSourceMapPath = path.join(file.cwd, options.destination, mapFile)
        const destFilePath = path.join(file.cwd, options.destination, file.relative)
        sourceMap.file = unixStylePath(path.relative(path.dirname(destSourceMapPath), destFilePath))
        if (sourceMap.sourceRoot === undefined) {
          sourceMap.sourceRoot = unixStylePath(path.relative(path.dirname(destSourceMapPath), file.base))
        } else if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
          sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(destSourceMapPath), file.base), sourceMap.sourceRoot))
        }
      } else {
        // best effort, can be incorrect if options.destination not set
        sourceMap.file = unixStylePath(path.relative(path.dirname(sourceMapPath), file.path))
        if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
          sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(sourceMapPath), file.base), sourceMap.sourceRoot))
        }
      }

      const sourceMapFile = file.clone(options.clone || { deep: false, contents: false })
      sourceMapFile.path = sourceMapPath
      sourceMapFile.contents = Buffer.from(JSON.stringify(sourceMap))
      sourceMapFile.stat = {
        isFile () { return true },
        isDirectory () { return false },
        isBlockDevice () { return false },
        isCharacterDevice () { return false },
        isSymbolicLink () { return false },
        isFIFO () { return false },
        isSocket () { return false }
      }

      stream.push(sourceMapFile)

      let sourceMapPathRelative = path.relative(path.dirname(file.path), sourceMapPath)

      if (options.sourceMappingURLPrefix) {
        let prefix = ''

        if (typeof options.sourceMappingURLPrefix === 'function') {
          prefix = options.sourceMappingURLPrefix(file)
        } else {
          prefix = options.sourceMappingURLPrefix
        }

        sourceMapPathRelative = prefix + path.join('/', sourceMapPathRelative)
      }

      comment = commentFormatter(unixStylePath(sourceMapPathRelative))

      if (options.sourceMappingURL && typeof options.sourceMappingURL === 'function') {
        comment = commentFormatter(options.sourceMappingURL(file))
      }
    }

    // append source map comment
    if (options.addComment) {
      file.contents = Buffer.concat([file.contents, Buffer.from(comment)])
    }
  }

  return {
    sourceRoot,
    loadContent,
    mapSources,
    mapDestinationPath
  }
};
