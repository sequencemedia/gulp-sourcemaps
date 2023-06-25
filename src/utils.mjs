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

const cssCommentFormatter = (preLine, newLine, url) => `${preLine}/*# sourceMappingURL=${url} */${newLine}`
const jsCommentFormatter = (preLine, newLine, url) => `${preLine}//# sourceMappingURL=${url}${newLine}`
const cjsCommentFormatter = (...args) => jsCommentFormatter(...args)
const mjsCommentFormatter = (...args) => jsCommentFormatter(...args)
const defaultCommentFormatter = () => ''

const COMMENT_FORMATTERS = new Map([
  ['css', cssCommentFormatter],
  ['js', jsCommentFormatter],
  ['cjs', cjsCommentFormatter],
  ['mjs', mjsCommentFormatter]
])

export function getCommentFormatter (file) {
  const extension = file.relative.split('.').pop()
  const fileContents = file.contents.toString()
  const newLine = detectNewlineGraceful(fileContents || '')

  let commentFormatter

  if (file.sourceMap.preExistingComment) {
    commentFormatter = (COMMENT_FORMATTERS.get(extension) ?? defaultCommentFormatter).bind(undefined, '', newLine)
  } else {
    commentFormatter = (COMMENT_FORMATTERS.get(extension) ?? defaultCommentFormatter).bind(undefined, newLine, newLine)
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
