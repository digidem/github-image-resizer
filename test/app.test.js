var test = require('tape')
var request = require('request')
var createImageSizeStream = require('image-size-stream')
var Octokat = require('octokat')
var dotenv = require('dotenv')
var ngrok = require('ngrok')
var AWS = require('aws-sdk')

dotenv.load()

var s3 = new AWS.S3()

AWS.config.getCredentials(function (err) {
  if (err) console.log(err.stack)
  // credentials not loaded
  else {
    console.log('Access key:', AWS.config.credentials.accessKeyId)
    console.log('Secret access key:', AWS.config.credentials.secretAccessKey.slice(0, 5))
  }
})

var tempRepo = 'test' + Date.now()

var bucket = process.env.S3_BUCKET = 'digidem-test'
process.env.VALID_REPOS = 'digidem-test/' + tempRepo
process.env.WATCH_FOLDER = 'assets'
process.env.IMAGE_SIZES = [200, 600, 1600]
process.env.GITHUB_SECRET = 'test'

var app = require('../app')

var port = process.env.PORT || 8080

var octo = new Octokat({
  token: process.env.GITHUB_TOKEN
})

var hostname, testImage, server

function setup () {
  test('setup server', function (t) {
    server = app.listen(port, () => {
      ngrok.connect(port).then(url => {
        hostname = process.env.HOSTNAME = url
        t.pass('Setup ngrok tunnel: ' + hostname)
        t.end()
      }).catch(err => {
        t.fail(err)
        t.end()
      })
    })
  })
  test('Create temporary test repo', function (t) {
    octo.user.repos.create({ name: tempRepo, auto_init: true }, t.end)
  })
  test('Setup webhook', function (t) {
    octo.repos('digidem-test', tempRepo).hooks.create({
      name: 'web',
      active: true,
      config: {
        url: hostname + '/hooks/github',
        content_type: 'json',
        secret: process.env.GITHUB_SECRET,
        insecure_ssl: '1'
      }
    }, t.end)
  })
  test('Download test image', function (t) {
    request({ url: 'https://farm6.staticflickr.com/5595/15103964698_67fae4c535_k_d.jpg', encoding: null }, function (err, res, body) {
      t.error(err)
      testImage = body
      t.end()
    })
  })
}

function teardown () {
  test('Close server', function (t) {
    server.close(t.end)
  })
  test('Disconnect ngrok', function (t) {
    ngrok.kill().then(t.end, t.end)
  })
  test('Delete temporary test repo', function (t) {
    octo.repos('digidem-test', tempRepo).remove(t.end)
  })
  test('Delete files from s3 temp bucket', function (t) {
    s3.listObjects({ Bucket: bucket }, function (err, data) {
      if (err) return t.end(err)
      var keys = data.Contents.map(function (v) {
        return v.Key
      })
      s3.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: keys.map(Key => ({ Key }))
        }
      }, function (err, data) {
        t.error(err, 'Deleted objects')
        t.end()
      })
    })
  })
}

setup()

test('New image on Github is resized', function (t) {
  t.test('Create image on Github', function (st) {
    octo.repos('digidem-test', tempRepo).contents('assets/test-image.jpg').add({
      message: 'Add image to repo',
      content: testImage.toString('base64')
    }, st.pass)
    st.skip('Waiting 30 seconds for everything to process')
    setTimeout(st.end, 30000)
  })
  // Test is not reading updated version, caching issue? probably need to use oktokit to read it.
  t.skip('Check resized image is on Github', function (st) {
    var imageSizeStream = createImageSizeStream()

    imageSizeStream.on('size', function (dimensions) {
      st.equal(dimensions.width, 200, 'image now on Github is right size')
      st.end()
    })
    const githubUrl = 'https://raw.githubusercontent.com/digidem-test/' + tempRepo + '/master/assets/test-image.jpg?' + Date.now()
    console.log('Checking image:', githubUrl)
    request(githubUrl, { headers: { 'Cache-Control': 'no-cache' } }).pipe(imageSizeStream)
  })
  t.test('Creates retina version of image', function (st) {
    var imageSizeStream = createImageSizeStream()

    imageSizeStream.on('size', function (dimensions) {
      st.equal(dimensions.width, 400, 'retina version is correct size')
      st.end()
    }).on('error', st.end)

    request('https://s3.amazonaws.com/' + bucket + '/assets/test-image-200@2x.jpg').pipe(imageSizeStream)
  })
  t.end()
})

teardown()
