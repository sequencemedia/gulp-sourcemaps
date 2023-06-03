import fs from 'graceful-fs'
import path from 'path'
import stripBom from 'strip-bom-string'
import rootDebug from '../debug.mjs'
import {
  unixStylePath,
  getCommentFormatter
} from '../utils.mjs'

export default function (destPath, options) {
  const debug = rootDebug.spawn('write:internals')

  debug(() => 'options')
  debug(() => options)

  function setSourceRoot (file) {
    const debug = rootDebug.spawn('setSourceRoot')

    const sourceMap = file.sourceMap
    if (typeof options.sourceRoot === 'function') {
      debug(() => 'is function')
      sourceMap.sourceRoot = options.sourceRoot(file)
    } else {
      debug(() => 'from options')
      sourceMap.sourceRoot = options.sourceRoot
    }
    if (sourceMap.sourceRoot === null) {
      debug(() => 'undefined')
      sourceMap.sourceRoot = undefined
    }
  }

  function mapSources (file) {
    const debug = rootDebug.spawn('mapSources')

    // NOTE: make sure source mapping happens after content has been loaded
    if (options.mapSources && typeof options.mapSources === 'function') {
      debug(() => '**Option is deprecated, update to use sourcemap.mapSources stream**')
      debug(() => 'function')

      file.sourceMap.sources = file.sourceMap.sources.map(function (filePath) {
        return options.mapSources(filePath, file)
      })
      return
    }

    debug(() => 'file.path: ' + file.path)
    debug(() => 'file.cwd: ' + file.cwd)
    debug(() => 'file.base: ' + file.base)

    file.sourceMap.sources = file.sourceMap.sources.map(function (filePath) {
      // keep the references files like ../node_modules within the sourceRoot
      debug(() => 'filePath: ' + filePath)

      if (options.mapSourcesAbsolute === true) {
        debug(() => 'mapSourcesAbsolute')

        if (!file.dirname) {
          debug(() => '!file.dirname')
          filePath = path.join(file.base, filePath).replace(file.cwd, '')
        } else {
          debug(() => 'file.dirname: ' + file.dirname)
          filePath = path.resolve(file.dirname, filePath).replace(file.cwd, '')
        }
      }
      return unixStylePath(filePath)
    })
  }

  function loadContent (file) {
    const debug = rootDebug.spawn('loadContent')

    const sourceMap = file.sourceMap
    if (options.includeContent) {
      sourceMap.sourcesContent = sourceMap.sourcesContent || []

      // load missing source content
      for (let i = 0; i < sourceMap.sources.length; i++) {
        if (!sourceMap.sourcesContent[i]) {
          const sourcePath = path.resolve(file.base, sourceMap.sources[i])
          try {
            debug('No source content for "' + sourceMap.sources[i] + '". Loading from file.')
            sourceMap.sourcesContent[i] = stripBom(fs.readFileSync(sourcePath, 'utf8'))
          } catch (e) {
            debug('source file not found: ' + sourcePath)
          }
        }
      }
    } else {
      delete sourceMap.sourcesContent
    }
  }

  function mapDestPath (file, stream) {
    const debug = rootDebug.spawn('mapDestPath')
    const sourceMap = file.sourceMap

    let comment
    const commentFormatter = getCommentFormatter(file)

    if (destPath === undefined || destPath === null) {
      // encode source map into comment
      const base64Map = Buffer.from(JSON.stringify(sourceMap)).toString('base64')
      comment = commentFormatter('data:application/json;charset=' + options.charset + ';base64,' + base64Map)
    } else {
      let mapFile = path.join(destPath, file.relative) + '.map'
      // custom map file name
      if (options.mapFile && typeof options.mapFile === 'function') {
        mapFile = options.mapFile(mapFile)
      }

      const sourceMapPath = path.join(file.base, mapFile)

      // if explicit destination path is set
      if (options.destPath) {
        const destSourceMapPath = path.join(file.cwd, options.destPath, mapFile)
        const destFilePath = path.join(file.cwd, options.destPath, file.relative)
        sourceMap.file = unixStylePath(path.relative(path.dirname(destSourceMapPath), destFilePath))
        if (sourceMap.sourceRoot === undefined) {
          sourceMap.sourceRoot = unixStylePath(path.relative(path.dirname(destSourceMapPath), file.base))
        } else if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
          sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(destSourceMapPath), file.base), sourceMap.sourceRoot))
        }
      } else {
        // best effort, can be incorrect if options.destPath not set
        sourceMap.file = unixStylePath(path.relative(path.dirname(sourceMapPath), file.path))
        if (sourceMap.sourceRoot === '' || (sourceMap.sourceRoot && sourceMap.sourceRoot[0] === '.')) {
          sourceMap.sourceRoot = unixStylePath(path.join(path.relative(path.dirname(sourceMapPath), file.base), sourceMap.sourceRoot))
        }
      }

      const sourceMapFile = file.clone(options.clone || { deep: false, contents: false })
      sourceMapFile.path = sourceMapPath
      sourceMapFile.contents = Buffer.from(JSON.stringify(sourceMap))
      sourceMapFile.stat = {
        isFile: () => true,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isSymbolicLink: () => false,
        isFIFO: () => false,
        isSocket: () => false
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
      debug(() => 'destPath comment')
      comment = commentFormatter(unixStylePath(sourceMapPathRelative))

      if (options.sourceMappingURL && typeof options.sourceMappingURL === 'function') {
        debug(() => 'options.sourceMappingURL comment')
        comment = commentFormatter(options.sourceMappingURL(file))
      }
    }

    // append source map comment
    if (options.addComment) {
      file.contents = Buffer.concat([file.contents, Buffer.from(comment)])
    }
  }

  return {
    setSourceRoot,
    loadContent,
    mapSources,
    mapDestPath
  }
};
