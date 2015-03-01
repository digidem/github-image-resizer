var Github  = require('github-api');
var debug = require('debug')('image-resizer:copy-to-github');

var request = require('request').defaults({
  headers: {
    'User-Agent': 'github-image-webhook',
  },
  encoding: null
});

/**
 * Downloads a file from `options.url` and writes it to github repo
 * `options.repo` with filename `options.filename`
 * @private
 * @param {Object} options
 * @param {String} options.url url for the file to copy
 * @param {String} options.filename filename (and path e.g.
 * `/my_folder/my_file.txt`) to save on Github
 * @param {String} options.repo Github full repo name with slash `user/repo`
 * @param {Function} callback called with (err)
 */
function copyToGithub(options, callback) {
  var github  = new Github({
    token: options.token || process.env.GITHUB_TOKEN,
    auth: "oauth"
  });

  var repo = github.getRepo(options.repo.split('/')[0], options.repo.split('/')[1]);
  var branch = options.branch || master;
  var commitMsg = (options.commitPrefix || '') + 'Updating file ' + options.filename;

  debug('getting image:', options.url);

  request.get(options.url, onGetFile);

  function onGetFile(err, response, data) {
    if (err) return callback(err);
    debug('writing resized image to repo %s branch %s', options.repo, branch);
    repo.write(branch, options.filename, data, commitMsg, function(err) {
      if (err) return callback(err);
      debug('Written file %s to Github', options.filename);
      callback();
    });
  }
}

module.exports = copyToGithub;
