var express = require('express');
var BlitlineWebhookResponder = require('../controllers/blitline-webhook-responder');
var request = require('supertest');
var test = require('tape');
var bodyParser = require('body-parser');
var app = express();

app.use(bodyParser.json());

test('Ignores webhooks with no images', function(t) {
    var payload = require('./fixtures/blitline-payloads/invalid-payload.json');

    app.post('/', BlitlineWebhookResponder());

    request(app)
        .post('/')
        .send(payload)
        .expect(200, 'No images returned')
        .end(function(err) {
            t.error(err, 'ignored');
            t.end();
        });
});

test('Sends task to copy smallest image returned to Github', function(t) {
    var payload = require('./fixtures/blitline-payloads/valid-payload.json');
    var expectedTask = require('./fixtures/github-copy-task.json');
    var app = express();

    app.use(bodyParser.json());

    app.post('/', BlitlineWebhookResponder({ copyToGithub: copyToGithubMock }));

    function copyToGithubMock(task) {
        t.deepEqual(task, expectedTask, 'Sent correct task');
        t.end();
    }

    request(app)
        .post('/')
        .send(payload)
        .set('x-blitline-origin-repo', 'digidem-test/test')
        .set('x-blitline-origin-branch', 'master')
        .expect(202, '')
        .end(function(err) {
            t.error(err, 'responded 202');
        });
});
