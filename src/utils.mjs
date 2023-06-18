import path from 'node:path'
import {
  detectNewlineGraceful
} from 'detect-newline'

export function unixStylePath (filePath) {
  return filePath.split(path.sep).join('/')
}

export const PLUGIN_NAME = '@sequencemedia/gulp-sourcemaps'

export const URL_PATTERN = /^(https?|webpack(-[^:]+)?):\/\//

/*
So reusing the same ref for a regex (with global (g)) is from a poor decision in js.
See http://stackoverflow.com/questions/10229144/bug-with-regexp-in-javascript-when-do-global-search

So we either need to use a new instance of a regex everywhere.
*/
export function getSourceMappingURLPattern () {
  return /\/\/# sourceMappingURL=.*/g
}

const commentFormatters = {
  css (preLine, newLine, url) {
    return preLine + '/*# sourceMappingURL=' + url + ' */' + newLine
  },
  js (preLine, newLine, url) {
    return preLine + '//# sourceMappingURL=' + url + newLine
  },
  default () {
    return ''
  }
}

export function getCommentFormatter (file) {
  const extension = file.relative.split('.').pop()
  const fileContents = file.contents.toString()
  const newLine = detectNewlineGraceful(fileContents || '')

  let commentFormatter = commentFormatters.default

  if (file.sourceMap.preExistingComment) {
    commentFormatter = (commentFormatters[extension] || commentFormatter).bind(undefined, '', newLine)
  } else {
    commentFormatter = (commentFormatters[extension] || commentFormatter).bind(undefined, newLine, newLine)
  }

  return commentFormatter
}

export function getInlinePreExisting (fileContent) {
  if (getSourceMappingURLPattern().test(fileContent)) {
    return fileContent.match(getSourceMappingURLPattern()).shift()
  }
}

export function exceptionToString (exception) {
  return exception.message || ''
}
