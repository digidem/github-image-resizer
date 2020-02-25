var parsePayload = require('parse-github-payload')
var defaults = require('defaults')
var debug = require('debug')('image-resizer:github-webhook')

require('dotenv').config()

var defaultOptions = {
  watchFolder: process.env.WATCH_FOLDER || '',
  imageRe: /.+\.(jpg|jpeg|png|tif|tiff)$/,
  sizes: process.env.IMAGE_SIZES ? process.env.IMAGE_SIZES.split(/\s?,\s?/) : [200, 800, 1200],
  validRepos: process.env.VALID_REPOS ? process.env.VALID_REPOS.split(/\s?,\s?/) : [],
  ignoreCommit: /^\[RESIZE-WEBHOOK]/,
  bucketName: process.env.S3_BUCKET,
  resize: require('../helpers/resize')
}

module.exports = function (options) {
  options = defaults(options, defaultOptions)

  if (options.watchFolder.length) {
    // add trailing slash if it is missing
    options.watchFolder += /\/$/.test(options.watchFolder) ? '' : '/'
    // remove preceding slash
    options.watchFolder = options.watchFolder.replace(/^\//, '')
  }

  var fileRe = new RegExp(options.watchFolder + options.imageRe.source)

  function _isValidRepo (repo) {
    return (options.validRepos.indexOf(repo) > -1)
  }

  return function githubWebookResponder (req, res) {
    // Only respond to github push events
    if (req.headers['x-github-event'] !== 'push') return res.status(200).end()

    var parseOptions = {
      matchName: fileRe,
      ignoreCommit: options.ignoreCommit
    }

    var payload = parsePayload(req.body, parseOptions)
    var files = payload._files.added_and_modified
    var repo = payload.repository.full_name
    var branch = payload.ref.split('/').pop()
    var reqBranch = req.params[0] || 'master'

    debug('New push from branch %s on repo %s', branch, repo)
    if (!_isValidRepo(repo)) {
      debug('Warning: repo %s tried to push, but is not a valid repo', repo)
      return res.status(403).send('Not authorised for this repo')
    }
    if (reqBranch !== branch) {
      debug('branch %s does not match, ignoring', branch)
      return res.status(200).send('branch ' + branch + ' does not match, ignoring')
    }

    if (!files.length) {
      debug('No updated images detected')
      return res.status(200).end('No updated images detected')
    }

    debug('Detected new images:\n', files.join('\n'))

    // Resize each file
    files.forEach(function (filename) {
      options.resize(filename, repo, options.bucketName, {sizes: options.sizes, branch: branch, retina: true}, function (err) {
        if (err) return console.error('Error:', err.message)
        debug('Resized image:', filename)
      })
    })

    // Close the connection
    res.status(202).end()
  }
}
