var request = require('request');
var express = require('express');
var app     = express();
var queue   = require('async').queue;
var debug   = require('debug')('github-image-webhook');

var Github  = require('github-api');
var github  = new Github({
  token: process.env.GITHUB_TOKEN,
  auth: "oauth"
});

var parseGithub = require('./lib/github-middleware')({
  secret: process.env.GITHUB_SECRET
});

var parseBlitline = require('./lib/blitline-middleware')({
  secret: process.env.BLITLINE_SECRET
});

var resize = require('./lib/blitline-resizer')({
  blitlineAppId: process.env.BLITLINE_APP_ID,
  postbackUrl: process.env.HOSTNAME.replace(/^\/$/,'') + '/hooks/blitline',
  s3Bucket: process.env.S3_BUCKET
});

var VALID_REPOS = process.env.VALID_REPOS.split(/\s?,\s?/)
  , WATCH_FOLDER = process.env.WATCH_FOLDER || ''
  , IMAGE_SIZES = process.env.IMAGE_SIZES.split(/\s?,\s?/)
  , IMAGE_REGEX = /.*\.(jpg|jpeg|png|tif|tiff|gif)$/
  , COMMIT_ID   = '[RESIZE-API]';

// Remove preceding slash and add trailing slash to watch folder
WATCH_FOLDER = WATCH_FOLDER.replace(/^\//, '').replace(/([^\/])$/,'$1/');

var q = queue(copyToGithub, 1);

app.post('/hooks/github/*', parseGithub, function(req, res) {
  // Only respond to github push events
  if (req.headers['x-github-event'] != 'push') return res.status(200).end();

  var payload = req.body
    , repo    = payload.repository.full_name
    , branch  = payload.ref.split('/').pop()
    , files;

  debug('New push from branch %s on repo %s', branch, repo);
  if (VALID_REPOS.indexOf(repo) === -1) {
    debug('Warning: repo %s tried to push, but is not a valid repo', repo);
    return res.status(403).send('Not authorised for this repo');
  }
  if (req.params[0] !== branch) {
    debug('branch %s does not match, ignoring', branch);
    return res.status(200).end();
  }

  images = getChangedFiles(payload.commits, IMAGE_REGEX);
  
  if (!images.length) {
    debug('No updated images detected');
    return res.status(200).end();
  }

  debug('Detected new images:\n', images.join('\n'));

  var options = {
    images: images,
    sizes: IMAGE_SIZES,
    repo: repo,
    branch: branch,
  };

  resize(options, function(err, data) {
    if (err) return console.error('Error:', err.message);
    debug('Blitline job response:', data);
  });

  // Close the connection
  res.status(202).end();
});

app.post('/hooks/blitline', parseBlitline, function(req, res) {
  var reponame = req.headers['x-blitline-origin-repo'];
  var branch = req.headers['x-blitline-origin-branch'];

  var images = req.body.results.images.filter(function(image) {
    return (/.*-lo\.jpg$/).test(image.image_identifier);
  });

  if (!images.length) return debug('No matching images');

  q.push({
    branch: branch,
    reponame: reponame,
    imageId: images[0].image_identifier.replace(/(.*)-lo(\.jpg)$/, '$1$2'),
    imageUrl: images[0].s3_url
  }, function(err) {
    if (err) console.error(err);
  });

  // Close the connection
  res.status(202).end();
});

// Start server
var port = process.env.PORT || 8080;
app.listen(port);
console.log('Listening on port %s', port);

function copyToGithub(task, callback) {
  var repo = github.getRepo(task.reponame.split('/')[0], task.reponame.split('/')[1]);
  var commitMsg = COMMIT_ID + ' replace ' + task.imageId + ' with lo-res version';
  
  var options = {
    headers: {
      'User-Agent': 'github-image-webhook',
    },
    encoding: null,
    url: task.imageUrl
  };

  debug('getting image:', options.url);

  request.get(options, function onGetImage(err, response, data) {
    if (err) return callback(err);
    debug('writing resized image to repo %s branch %s', task.reponame, task.branch);
    repo.write(task.branch, task.imageId, data, commitMsg, function(err) {
      if (err) return callback(err);
      debug('Written lo-res image %s to Github', task.imageId);
      callback();
    });
  });
}

// The Github push event returns an array of commits.
// Each commit object has an array of added, modified and deleted files.
// getChangedFiles() returns a list of all the added and modified files
// excluding any files which are subsequently removed.
function getChangedFiles(commits, matchRegex) {
  return commits
    .reduce(function(previousCommit, currentCommit) {
      if (currentCommit.message.indexOf(COMMIT_ID) > -1) return previousCommit;
      return previousCommit
        .concat(currentCommit.modified)
        .concat(currentCommit.added)
        .filter(function(value) {
          return currentCommit.removed.indexOf(value) === -1;
        });
    }, [])
    .filter(function(value, i, arr) {
      return arr.indexOf(value) >= i && matchRegex.test(value) && value.indexOf(WATCH_FOLDER) === 0;
    });
}
