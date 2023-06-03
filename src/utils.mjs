import path from 'path'
import {
  detectNewlineGraceful
} from 'detect-newline'
import debug from './debug.mjs'

export function unixStylePath (filePath) {
  return filePath.split(path.sep).join('/')
}

export const PLUGIN_NAME = '@sequencemedia/gulp-sourcemaps'

export const urlRegex = /^(https?|webpack(-[^:]+)?):\/\//

const log = debug.spawn('utils')

/*
So reusing the same ref for a regex (with global (g)) is from a poor decision in js.
See http://stackoverflow.com/questions/10229144/bug-with-regexp-in-javascript-when-do-global-search

So we either need to use a new instance of a regex everywhere.
*/
export function sourceMapUrlRegEx () {
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
    log(function () {
      return 'preExistingComment commentFormatter ' + commentFormatter.name
    })
  } else {
    commentFormatter = (commentFormatters[extension] || commentFormatter).bind(undefined, newline, newline)
  }

  log(function () {
    return 'commentFormatter ' + commentFormatter.name
  })
  return commentFormatter
}

export function getInlinePreExisting (fileContent) {
  if (sourceMapUrlRegEx().test(fileContent)) {
    log(() => 'has preExisting')
    return fileContent.match(sourceMapUrlRegEx())[0]
  }
}

export function exceptionToString (exception) {
  return exception.message || ''
}
