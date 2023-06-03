import {
  Transform
} from 'node:stream'
import PluginError from 'plugin-error'

import {
  PLUGIN_NAME,
  unixStylePath
} from '#utils'

import initInternals from './internals.mjs'

function getTransformFor (destination, options) {
  return function transform (file, encoding, callback) {
    if (file.isNull() || !file.sourceMap) {
      this.push(file)
      return callback()
    }

    if (file.isStream()) {
      return callback(new PluginError(PLUGIN_NAME, 'Streaming not supported'))
    }

    const internals = initInternals(destination, options)

    // fix paths if Windows style paths
    file.sourceMap.file = unixStylePath(file.relative)

    internals.sourceRoot(file)
    internals.loadContent(file)
    internals.mapSources(file)
    internals.mapDestinationPath(file, this)

    this.push(file)
    return callback()
  }
}

/**
 * Write the source map
 *
 * @param destination Destination file path for the source map
 * @param options To configure the way the source map is written
 */
export default function write (destination, options) {
  if (typeof destination !== 'string' && !options) {
    options = destination
    destination = undefined
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

  const transform = getTransformFor(destination, options)

  return new Transform({ transform, objectMode: true })
}
