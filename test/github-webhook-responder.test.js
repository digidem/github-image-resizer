var express = require('express')
var request = require('supertest')
var test = require('tape')
var bodyParser = require('body-parser')
var app = express()

process.env.S3_BUCKET = 'digidem-test'

var GithubWebhookResponder = require('../controllers/github-webhook-responder')

var options = {
  watchFolder: 'assets',
  validRepos: ['digidem-test/test'],
  resizer: function () {}
}

app.use(bodyParser.json())

app.post('/*', GithubWebhookResponder(options))

test('Only responds to github push events', function (t) {
  var payload = require('./fixtures/github-payloads/ping-payload.json')

  request(app)
        .post('/')
        .set('x-github-event', 'ping')
        .send(payload)
        .expect(200, '')
        .end(function (err) {
          t.error(err, 'ignores ping payload')
          t.end()
        })
})

test('Rejects webhooks from unauthorized repos', function (t) {
  var payload = require('./fixtures/github-payloads/unauth-repo-payload.json')

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(403, 'Not authorised for this repo')
        .end(function (err) {
          t.error(err, 'Sent 403')
          t.end()
        })
})

test('Only responds to push events on master branch if webhook is on root url', function (t) {
  var payload = require('./fixtures/github-payloads/push-payload-branch.json')

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'branch patch does not match, ignoring')
        .end(function (err) {
          t.error(err, 'ignores push payload on patch branch')
          t.end()
        })
})

test('Only responds to push events on branch specified in url', function (t) {
  var payload = require('./fixtures/github-payloads/push-payload.json')

  request(app)
        .post('/patch')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'branch master does not match, ignoring')
        .end(function (err) {
          t.error(err, 'ignores push payload on master branch when url is /patch')
          t.end()
        })
})

test('Ignores push events with no files matching imageRegExp', function (t) {
  var payload = require('./fixtures/github-payloads/no-images-payload.json')

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function (err) {
          t.error(err, 'ignores push with no images')
          t.end()
        })
})

test('Ignores push events with images not in watch folder', function (t) {
  var payload = require('./fixtures/github-payloads/different-folder-payload.json')

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function (err) {
          t.error(err, 'ignored')
          t.end()
        })
})

test('Ignores commits with prefix', function (t) {
  var payload = require('./fixtures/github-payloads/prefix-payload.json')

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function (err) {
          t.error(err, 'ignored')
          t.end()
        })
})

test('Calls resizer with valid resize task', function (t) {
  var payload = require('./fixtures/github-payloads/push-payload.json')
  var filenames = ['assets/15103964698_67fae4c535_k_d.jpg', 'assets/14459663821_329233b70e_k_d.jpg']
  var app = express()

  t.plan(11)

  var options = {
    watchFolder: 'assets',
    validRepos: 'digidem-test/test',
    resize: function (filename, repo, bucketName, options, cb) {
      t.equal(filename, filenames.pop(), 'resize called with correct filename')
      t.equal(repo, 'digidem-test/test', 'resize called with correct repo')
      t.equal(bucketName, 'digidem-test', 'resize called with correct bucker')
      t.deepEqual(options, {sizes: options.sizes, branch: 'master'}, 'valid options')
      t.equal(typeof cb, 'function', 'called resizer with callback')
    },
    sizes: [ 200, 800, 1200 ]
  }

  app.use(bodyParser.json())

  app.post('/*', GithubWebhookResponder(options))

  request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(202, '')
        .end(function (err) {
          t.error(err, 'Got 202 response')
        })
})
