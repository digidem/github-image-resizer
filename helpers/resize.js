var parallelLimit = require('run-parallel-limit')
var sharp = require('sharp')
var tmp = require('tmp')
var fs = require('fs')
var path = require('path')
var request = require('request')
var AWS = require('aws-sdk')
var mkdirp = require('mkdirp')
var debug = require('debug')('image-resizer:resize')
var queue = require('queue')({
  concurrency: 1,
  autostart: true
})
tmp.setGracefulCleanup()

var s3 = new AWS.S3()

debug('Checking credentials')
AWS.config.getCredentials(function (err) {
  if (err) console.log(err.stack)
  // credentials not loaded
  else {
    debug('Access key:', AWS.config.credentials.accessKeyId)
    debug('Secret access key:', AWS.config.credentials.secretAccessKey.slice(0, 5))
  }
})

// var CONTENT_TYPES = ['image/jpeg', 'image/png']
var RESIZE_CONCURRENCY = 1
var UPLOAD_CONCURRENCY = 20
var DEFAULT_QUALITY = 80

module.exports = function (filename, repo, bucketName, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = {}
  }
  options = options || {}
  var sizes = (options.sizes || []).map(Number)
  var branch = options.branch || 'master'

  var quality = Math.min(Math.max(1, options.quality), 100) || DEFAULT_QUALITY

  if (!repo) {
    return cb(new Error('must specify repo name'))
  }

  if (!bucketName) {
    return cb(new Error('must specify S3 bucket name'))
  }

  if (!sizes.length) {
    console.warn('no sizes specified')
    return cb()
  }

  // This makes it easier to mock, not sure this is the prettiest way to do this.
  var copyToGithub = options.copyToGithub || require('../helpers/copy-to-github')

  var githubUrl = 'https://github.com/' + repo + '/raw/' + branch + '/' + filename

  tmp.dir({unsafeCleanup: true, keep: true}, function (err, dirpath, cleanup) {
    if (err) return cb(err)
    var subdir = path.parse(filename).dir
    mkdirp(path.join(dirpath, subdir), function (err) {
      if (err) return cb(err)
      onTmp(dirpath, cleanup)
    })
  })

  function onTmp (dirpath, cleanup) {
    var filepath = path.join(dirpath, filename)
    var req = request.get(githubUrl)
    req
      .on('error', done)
      .on('response', function (res) {
        if (res.statusCode !== 200) {
          debug('file not found')
          req.abort()
          done(new Error('NotFound'))
        }
      })
      .pipe(fs.createWriteStream(filepath))
      .on('error', done)
      .on('finish', function () {
        debug('downloaded file:', filename, filepath)
        queue.push(createResizeTask(filepath, onResize))
      })

    function onResize (err, results) {
      debug('Resize done, uploading to S3')
      if (err) return done(err)
      s3Upload(results, dirpath, function (err) {
        if (err) return done(err)
        debug('uploaded %s all sizes to S3', results, dirpath)
        githubUpload(results, dirpath, done)
      })
    }

    function done (err) {
      if (err) debug('Error', err)
      cleanup()
      cb(err)
    }
  }

  function createResizeTask (filepath, done) {
    return function (_cbo) {
      var tasks = sizes.map(function (size) {
        return function (_cbi) {
          var outFilepath = createName(filepath, size)
          debug('resize', filepath, outFilepath, size)
          resize(filepath, outFilepath, size, _cbi)
        }
      })
      if (options.retina) {
        tasks = tasks.concat(sizes.map(function (size) {
          return function (_cbi) {
            var outFilepath = createName(filepath, size, true)
            debug('resize retina', filepath, outFilepath, size)
            resize(filepath, outFilepath, size * 2, _cbi)
          }
        }))
      }
      parallelLimit(tasks, RESIZE_CONCURRENCY, function (err, results) {
        _cbo()
        done(err, results)
      })
    }
  }

  function s3Upload (results, basedir, done) {
    var tasks = results.map(function (info) {
      return function (_cb) {
        var params = {
          Key: path.relative(basedir, info.filepath),
          ACL: 'public-read',
          Bucket: bucketName,
          Body: fs.createReadStream(info.filepath),
          ContentLength: info.size,
          ContentType: 'image/' + info.format,
          CacheControl: 'public, max-age=31557600' // One Year
        }
        s3.headObject({Key: params.Key, Bucket: params.Bucket}, function (err) {
          if (!err) return done(new Error('File `' + params.Key + '` already exists'))
          debug('Uploading %s to S3', params.Key)
          s3.upload(params, _cb)
        })
      }
    })
    parallelLimit(tasks, UPLOAD_CONCURRENCY, done)
  }

  function githubUpload (results, basedir, done) {
    var smallest = results.sort(function (a, b) {
      return a.maxDim - b.maxDim
    })[0]
    var task = {
      localPath: smallest.filepath,
      destPath: filename,
      repo: repo,
      branch: branch,
      commitPrefix: '[RESIZE-WEBHOOK] '
    }
    copyToGithub(task, done)
  }

  function resize (filepath, outFilepath, size, cb) {
    sharp(filepath)
      .resize(size, size)
      .max() // Preserving aspect ratio, resize the image to fit within `w` & `h`
      .withoutEnlargement() // Do not enlarge images smaller than `w` & `h`
      .rotate() // Rotate image according to EXIF metadata (e.g. images from phones)
      .jpeg({
        quality: quality,
        force: false // Don't force jpeg, use input format
      })
      .toFile(outFilepath, function (err, info) {
        info.filepath = outFilepath
        info.maxDim = size
        debug('created size %s for image %s', size, filename)
        cb(err, info)
      })
  }
}

function createName (filepath, size, retina) {
  var postfix = retina ? '@2x' : ''
  var parsed = path.parse(filepath)
  return path.join(parsed.dir, parsed.name + '-' + size + postfix + parsed.ext)
}
