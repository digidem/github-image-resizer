var test = require('tape');
var request = require('request');
var createImageSizeStream = require('image-size-stream');
var Octokat = require('octokat');
var dotenv = require('dotenv');
var ngrok = require('ngrok');

dotenv.load();

var tempRepo = 'test' + Date.now();

process.env.S3_BUCKET = 'digidem-test';
process.env.VALID_REPOS = 'digidem-test/' + tempRepo;
process.env.WATCH_FOLDER = 'assets';
process.env.IMAGE_SIZES = [200,600,1600];
process.env.GITHUB_SECRET = 'test';
process.env.BLITLINE_SECRET = 'test';

var app = require('../app');

var port = process.env.PORT || 8080;

var octo = new Octokat({
  token: process.env.GITHUB_TOKEN
});

var hostname, testImage, server;

function setup() {
    test('setup server', function(t) {
        server = app.listen(port);
        ngrok.connect(port, function(err, url) {
            t.error(err, 'successfully set up test server');
            hostname = process.env.HOSTNAME = url;
            console.log(hostname);
            t.end();
        });
    });
    test('Create temporary test repo', function(t) {
        octo.user.repos.create({ name: tempRepo, auto_init: true }, t.end);
    });
    test('Setup webhook', function(t) {
        octo.repos('digidem-test', tempRepo).hooks.create({
            name: 'web',
            active: true,
            config: {
                url: hostname + '/hooks/github',
                content_type: 'json',
                secret: process.env.GITHUB_SECRET,
                insecure_ssl: '1'
            }
        }, t.end);
    });
    test('Download test image', function(t) {
        request({ url: "https://farm6.staticflickr.com/5595/15103964698_67fae4c535_k_d.jpg", encoding: null }, function(err, res, body) {
            t.error(err);
            testImage = body;
            t.end();
        });
    });
}

function teardown() {
    test('Close server', function(t) {
        server.close(t.end);
    });
    test('Disconnect ngrok', function(t) {
        ngrok.disconnect();
        t.end();
    });
    test('Delete temporary test repo', function(t) {
        octo.repos('digidem-test', tempRepo).remove(t.end);
    });
}

setup();

test('New image on Github is resized', function(t) {
    t.test('Create image on Github', function(st) {
        octo.repos('digidem-test', tempRepo).contents('assets/test-image.jpg').add({
            message: 'Add image to repo',
            content: testImage.toString('base64')
        }, st.pass);
        t.skip('Waiting 20 seconds for everything to process');
        setTimeout(t.end, 20000);
    });
    t.test('Check resized image is on Github', function(st) {
        var imageSizeStream = createImageSizeStream();

        imageSizeStream.on('size', function(dimensions) {
            st.equal(dimensions.width, 200, 'image now on Github is right size');
            st.end();
        });

        request('https://github.com/digidem-test/' + tempRepo + '/raw/master/assets/test-image.jpg').pipe(imageSizeStream);
    });
});

teardown();
