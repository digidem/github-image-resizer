var copyToGithub = require('../helpers/copy-to-github');
var test = require('tape');
var request = require('request');
var Octokat = require('octokat');
var dotenv = require('dotenv');
var bufferEqual = require('buffer-equal');

dotenv.load();

var octo = new Octokat({
  token: process.env.GITHUB_TOKEN
});

var tempRepo = 'test' + Date.now();

var testFile = {
    url: 'https://s3.amazonaws.com/digidem-test/logo.png'
};

function setup() {
    test('Create temporary test repo', function(t) {
        octo.user.repos.create({ name: tempRepo, auto_init: true }, t.end);
    });
    test('Get test file contents', function(t) {
        request({ url: testFile.url, encoding: null }, function(err, res, body) {
            t.error(err);
            testFile.content = body;
            t.end();
        });
    });
}

function teardown() {
    test('Delete temporary test repo', function(t) {
        octo.repos('digidem-test', tempRepo).remove(t.end);
    });
}

setup();

test('Copies file from url to github', function(t) {
    var copyTask = {
        repo: 'digidem-test/' + tempRepo,
        branch: 'master',
        commitPrefix: '[RESIZE-WEBHOOK] ',
        filename: 'folder/logo.png',
        url: testFile.url,
        token: process.env.GITHUB_TOKEN
    };

    copyToGithub(copyTask, function(err) {
        t.error(err);
        octo.repos('digidem-test', tempRepo).contents('folder/logo.png').fetch(function(err, info) {
            t.ok(bufferEqual(new Buffer(info.content, 'base64'), testFile.content), 'file in github matches original');
            t.end();
        });
    });
});


teardown();
