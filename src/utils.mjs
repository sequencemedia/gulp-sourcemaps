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
  css: function cssCommentFormatter (preLine, newline, url) {
    return preLine + '/*# sourceMappingURL=' + url + ' */' + newline
  },
  js: function jsCommentFormatter (preLine, newline, url) {
    return preLine + '//# sourceMappingURL=' + url + newline
  },
  default: function defaultFormatter () {
    return ''
  }
}

export function getCommentFormatter (file) {
  const extension = file.relative.split('.').pop()
  const fileContents = file.contents.toString()
  const newline = detectNewlineGraceful(fileContents || '')

  let commentFormatter = commentFormatters.default

  if (file.sourceMap.preExistingComment) {
    commentFormatter = (commentFormatters[extension] || commentFormatter).bind(undefined, '', newline)
  } else {
    commentFormatter = (commentFormatters[extension] || commentFormatter).bind(undefined, newline, newline)
  }

  return commentFormatter
}

export function getInlinePreExisting (fileContent) {
  if (getSourceMappingURLPattern().test(fileContent)) {
    return fileContent.match(getSourceMappingURLPattern())[0]
  }
}

export function exceptionToString (exception) {
  return exception.message || ''
}
