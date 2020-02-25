var copyToGithub = require('../helpers/copy-to-github')
var test = require('tape')
var request = require('request')
var Octokat = require('octokat')
var dotenv = require('dotenv')
var bufferEqual = require('buffer-equal')
var tmp = require('tmp')
var fs = require('fs')

dotenv.load()

var octo = new Octokat({
  token: process.env.GITHUB_TOKEN
})

var tempRepo = 'test' + Date.now()

var testFile = {
  url: 'http://images.digital-democracy.org/logos/logo-hivos.jpg',
  tmpPath: tmp.tmpNameSync()
}

function setup () {
  test('Create temporary test repo', function (t) {
    t.plan(1)
    octo.user.repos.create({ name: tempRepo, auto_init: true }, t.error)
  })
  test('Get test file contents', function (t) {
    request({ url: testFile.url, encoding: null }, function (err, res, body) {
      t.error(err)
      fs.writeFileSync(testFile.tmpPath, body)
      testFile.content = body
      t.end()
    })
  })
}

function teardown () {
  test('Delete temporary test repo', function (t) {
    octo.repos('digidem-test', tempRepo).remove(t.end)
  })
}

setup()

test('Copies file from url to github', function (t) {
  var copyTask = {
    repo: 'digidem-test/' + tempRepo,
    branch: 'master',
    commitPrefix: '[RESIZE-WEBHOOK] ',
    destPath: 'folder/logo.png',
    localPath: testFile.tmpPath,
    token: process.env.GITHUB_TOKEN
  }

  copyToGithub(copyTask, function (err) {
    t.error(err)
    octo.repos('digidem-test', tempRepo).contents(copyTask.destPath).fetch(function (err, info) {
      t.error(err)
      t.ok(bufferEqual(Buffer.from(info.content, 'base64'), testFile.content), 'file in github matches original')
      t.end()
    })
  })
})

teardown()
