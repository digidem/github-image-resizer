var Hubfs = require('hubfs.js')
var debug = require('debug')('image-resizer:copy-to-github')
var fs = require('fs')
/**
 * Copies a file from localPath and writes it to github repo
 * `task.repo` with filename `destPath`
 * @private
 * @param {Object} task
 * @param {String} task.localPath filepath for the file to copy
 * @param {String} task.destPath filename (and path e.g.
 * `/my_folder/my_file.txt`) to save on Github
 * @param {String} task.repo Github full repo name with slash `user/repo`
 * @param {String} task.commitPrefix Prefix for commit message
 * @param {String} [task.token] Github token, optional, will default to env GITHUB_TOKEN
 * @param {String} [branch] Github branch, defaults to master
 * @param {Function} callback called with (err)
 */
function copyToGithub (task, callback) {
  var opts = {
    auth: {
      token: task.token || process.env.GITHUB_TOKEN
    },
    owner: task.repo.split('/')[0],
    repo: task.repo.split('/')[1]
  }

  var hubfs = new Hubfs(opts)
  var branch = task.branch || 'master'
  var commitMsg = (task.commitPrefix || '') + 'Updating file ' + task.destPath

  debug('getting image:', task.localPath)

  fs.readFile(task.localPath, onGetFile)

  function onGetFile (err, data) {
    if (err) return callback(err)
    debug('writing resized image to repo %s branch %s', task.repo, branch)

    var writeOptions = {
      message: commitMsg,
      branch: branch
    }

    hubfs.writeFile(task.destPath, data, writeOptions, function (err) {
      if (err) return callback(err)
      debug('Wrote file %s to Github', task.destPath)
      callback()
    })
  }
}

module.exports = copyToGithub
