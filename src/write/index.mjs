import {
  Transform
} from 'node:stream'
import PluginError from 'plugin-error'

import {
  PLUGIN_NAME,
  unixStylePath
} from '#utils'

import getFileTransformers from './get-file-transformers.mjs'

const STREAMING_NOT_SUPPORTED_MESSAGE = 'Streaming not supported'
const DEFAULT_OPTIONS = {
  includeContent: true,
  addComment: true,
  charset: 'utf8'
}

function getTransformFor (destination, options) {
  return function transform (file, encoding, done) {
    if (file.isNull() || !file.sourceMap) {
      this.push(file)
      return done()
    }

    if (file.isStream()) {
      return done(new PluginError(PLUGIN_NAME, STREAMING_NOT_SUPPORTED_MESSAGE))
    }

    const {
      sourceRoot,
      loadContent,
      mapSources,
      mapDestinationPath
    } = getFileTransformers(destination, options)

    // fix paths if Windows style paths
    file.sourceMap.file = unixStylePath(file.relative)

    sourceRoot(file)
    loadContent(file)
    mapSources(file)
    mapDestinationPath(file, this)

    this.push(file)

    return done()
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

  const transform = getTransformFor(destination, { ...DEFAULT_OPTIONS, ...options })

  return new Transform({ transform, objectMode: true })
}
