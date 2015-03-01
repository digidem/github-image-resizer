var express = require('express');
var GithubWebhookResponder = require('../controllers/github-webhook-responder');
var request = require('supertest');
var test = require('tape');
var bodyParser = require('body-parser');
var app = express();

var options = {
    watchFolder: 'assets',
    validRepos: ['digidem-test/test'],
    resizer: function() {}
};

app.use(bodyParser.json());

app.post('/*', GithubWebhookResponder(options));

test('Only responds to github push events', function(t) {
    var payload = require('./fixtures/github-payloads/ping-payload.json');

    request(app)
        .post('/')
        .set('x-github-event', 'ping')
        .send(payload)
        .expect(200, '')
        .end(function(err, res) {
            t.error(err, 'ignores ping payload');
            t.end();
        });
});

test('Rejects webhooks from unauthorized repos', function(t) {
    var payload = require('./fixtures/github-payloads/unauth-repo-payload.json');

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(403, 'Not authorised for this repo')
        .end(function(err, res) {
            t.error(err, 'Sent 403');
            t.end();
        });
});

test('Only responds to push events on master branch if webhook is on root url', function(t) {
    var payload = require('./fixtures/github-payloads/push-payload-branch.json');

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'branch patch does not match, ignoring')
        .end(function(err, res) {
            t.error(err, 'ignores push payload on patch branch');
            t.end();
        });
});

test('Only responds to push events on branch specified in url', function(t) {
    var payload = require('./fixtures/github-payloads/push-payload.json');

    request(app)
        .post('/patch')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'branch master does not match, ignoring')
        .end(function(err, res) {
            t.error(err, 'ignores push payload on master branch when url is /patch');
            t.end();
        });
});

test('Ignores push events with no files matching imageRegExp', function(t) {
    var payload = require('./fixtures/github-payloads/no-images-payload.json');

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function(err, res) {
            t.error(err, 'ignores push with no images');
            t.end();
        });
});

test('Ignores push events with images not in watch folder', function(t) {
    var payload = require('./fixtures/github-payloads/different-folder-payload.json');

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function(err, res) {
            t.error(err, 'ignored');
            t.end();
        });
});

test('Ignores commits with prefix', function(t) {
    var payload = require('./fixtures/github-payloads/prefix-payload.json');

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(200, 'No updated images detected')
        .end(function(err, res) {
            t.error(err, 'ignored');
            t.end();
        });
});

test('Calls resizer with valid resize task', function(t) {
    var payload = require('./fixtures/github-payloads/push-payload.json');
    var resizeTask = require('./fixtures/resize-task.json');

    var app = express();

    var options = {
        watchFolder: 'assets',
        validRepos: 'digidem-test/test',
        resizer: function(task, cb) {
            t.deepEqual(task, resizeTask, 'valid task');
            t.equal(typeof cb, 'function', 'called resizer with callback');
        },
        sizes: [ 200, 800, 1200 ]
    };

    app.use(bodyParser.json());

    app.post('/*', GithubWebhookResponder(options));

    t.plan(3);

    request(app)
        .post('/')
        .set('x-github-event', 'push')
        .send(payload)
        .expect(202, '')
        .end(function(err, res) {
            t.error(err, 'Got 202 response');
        });
});
