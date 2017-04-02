// By default the resizer will just save to s3 with the filename,
// but we want to include the folder/path to match Github

var url = require('url')
var path = require('path')

module.exports = function (repo, branch) {
  return function (imageUrl, size) {
    var urlRoot = 'https://github.com/' + repo + '/raw/' + branch + '/'
    var pathname

    if (imageUrl.indexOf(urlRoot) === 0) {
      pathname = imageUrl.substr(urlRoot.length)
    } else {
      pathname = url.parse(imageUrl).pathname
    }

    var ext = path.extname(pathname)
    var basename = pathname.replace(new RegExp('\\' + ext + '$'), '')

    if (size) {
      return basename + '-' + size + ext
    } else {
      return basename + ext
    }
  }
}
