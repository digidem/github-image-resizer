var parsePayload = require('parse-github-payload')
var defaults = require('defaults')
var debug = require('debug')('image-resizer:github-webhook')
var blitelineResizer = require('blitline-resizer')

var createRenameFn = require('../helpers/github-image-renamer')

var defaultOptions = {
  watchFolder: process.env.WATCH_FOLDER || '',
  imageRe: /.+\.(jpg|jpeg|png|tif|tiff|gif)$/,
  sizes: process.env.IMAGE_SIZES ? process.env.IMAGE_SIZES.split(/\s?,\s?/) : [200, 800, 1200],
  validRepos: process.env.VALID_REPOS ? process.env.VALID_REPOS.split(/\s?,\s?/) : [],
  ignoreCommit: /^\[RESIZE-WEBHOOK]/
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

    // Get the github raw url for each file
    files = files.map(function (filename) {
      return 'https://github.com/' + repo + '/raw/' + branch + '/' + filename
    })

    var resizeTask = {
      retina: true,
      images: files,
      sizes: options.sizes,
      postbackHeaders: {
        'x-blitline-origin-repo': repo,
        'x-blitline-origin-branch': branch
      }
    }

    var resizer = options.resizer || blitelineResizer({
      blitlineAppId: process.env.BLITLINE_APP_ID,
      postbackUrl: process.env.HOSTNAME.replace(/^\/$/, '') + '/hooks/blitline',
      s3Bucket: process.env.S3_BUCKET,
      renamer: createRenameFn(repo, branch),
      secret: process.env.BLITLINE_SECRET
    })

    resizer(resizeTask, function (err, data) {
      if (err) return console.error('Error:', err.message)
      debug('Blitline job response:', data)
    })

    // Close the connection
    res.status(202).end()
  }
}
