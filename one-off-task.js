var debug = require('debug')('github-image-webhook');

var resize = require('./lib/blitline-resizer')({
  blitlineAppId: process.env.BLITLINE_APP_ID,
  postbackUrl: process.env.HOSTNAME.replace(/^\/$/, '') + '/hooks/blitline',
  s3Bucket: process.env.S3_BUCKET
});

var VALID_REPOS = process.env.VALID_REPOS.split(/\s?,\s?/),
  WATCH_FOLDER = process.env.WATCH_FOLDER || '',
  IMAGE_SIZES = process.env.IMAGE_SIZES.split(/\s?,\s?/),
  IMAGE_REGEX = /.*\.(jpg|jpeg|png|tif|tiff|gif)$/,
  COMMIT_ID = '[RESIZE-API]';

// Remove preceding slash and add trailing slash to watch folder
WATCH_FOLDER = WATCH_FOLDER.replace(/^\//, '').replace(/([^\/])$/, '$1/');

var repo = 'digidem/digital-democracy.org';
var branch = 'gh-pages';

var images = [
  "assets/rafael-achuar-monitor.jpg"
];

if (images.length) {
  debug('Detected new images:\n', images.join('\n'));
} else {
  debug('No updated images detected');
}

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
