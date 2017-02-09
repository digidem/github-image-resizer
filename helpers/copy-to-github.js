var Octokat  = require('octokat');
var Hubfs = require('hubfs.js');
var debug = require('debug')('image-resizer:copy-to-github');

var request = require('request').defaults({
  headers: {
    'User-Agent': 'github-image-webhook',
  },
  encoding: null
});

/**
 * Downloads a file from `task.url` and writes it to github repo
 * `task.repo` with filename `task.filename`
 * @private
 * @param {Object} task
 * @param {String} task.url url for the file to copy
 * @param {String} task.filename filename (and path e.g.
 * `/my_folder/my_file.txt`) to save on Github
 * @param {String} task.repo Github full repo name with slash `user/repo`
 * @param {Function} callback called with (err)
 */
function copyToGithub(task, callback) {
  var opts = {
    auth: {
      token: task.token || process.env.GITHUB_TOKEN
    },
    owner: task.repo.split('/')[0],
    repo: task.repo.split('/')[1]
  };

  var hubfs = new Hubfs(opts);
  var branch = task.branch || 'master';
  var commitMsg = (task.commitPrefix || '') + 'Updating file ' + task.filename;

  debug('getting image:', task.url);

  request.get(task.url, onGetFile);

  function onGetFile(err, response, data) {
    if (err) return callback(err);
    debug('writing resized image to repo %s branch %s', task.repo, branch);

    var writeOptions = {
      message: commitMsg,
      branch: branch
    };

    hubfs.writeFile(task.filename, data, writeOptions, function(err) {
      if (err) return callback(err);
      debug('Wrote file %s to Github', task.filename);
      callback();
    });
  }
}

module.exports = copyToGithub;
