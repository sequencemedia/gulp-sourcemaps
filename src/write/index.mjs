import through from 'through2'
import PluginError from 'plugin-error'
import internalsInit from './index.internals.mjs'
import {
  PLUGIN_NAME,
  unixStylePath
} from '../utils.mjs'
import debug from '../debug.mjs'

const log = debug.spawn('write')

/**
 * Write the source map
 *
 * @param options options to change the way the source map is written
 *
 */
export default function write (destPath, options) {
  log(() => 'destPath')
  log(() => destPath)

  log(() => 'original options')
  log(() => options)

  if (options === undefined && typeof destPath !== 'string') {
    options = destPath
    destPath = undefined
  }
  options = options || {}

  // set defaults for options if unset
  if (options.includeContent === undefined) {
    options.includeContent = true
  }
  if (options.addComment === undefined) {
    options.addComment = true
  }
  if (options.charset === undefined) {
    options.charset = 'utf8'
  }

  log(() => 'derrived options')
  log(() => options)

  const internals = internalsInit(destPath, options)

  function sourceMapWrite (file, encoding, callback) {
    if (file.isNull() || !file.sourceMap) {
      this.push(file)
      return callback()
    }

    if (file.isStream()) {
      return callback(new PluginError(PLUGIN_NAME, 'Streaming not supported'))
    }

    // fix paths if Windows style paths
    file.sourceMap.file = unixStylePath(file.relative)

    internals.setSourceRoot(file)
    internals.loadContent(file)
    internals.mapSources(file)
    internals.mapDestPath(file, this)

    this.push(file)
    return callback()
  }

  return through.obj(sourceMapWrite)
}
