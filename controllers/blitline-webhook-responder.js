var queue = require('async').queue;

module.exports = function(options) {
  options = options || {};

  // This makes it easier to mock, not sure this is the prettiest way to do this.
  var copyToGithub = options.copyToGithub || require('../helpers/copy-to-github');

  // We copy files to Github one at a time, otherwise we loose where our HEAD is
  // and we get problems.
  var q = queue(copyToGithub, 1);

  return function blitlineWebhookResponder(req, res) {
    // These headers are set in the task sent to Blitline.
    var repo = req.headers['x-blitline-origin-repo'];
    var branch = req.headers['x-blitline-origin-branch'];
    var results = req.body.results;

    var loresImage;

    if (!results.images || !results.images.length) return res.status(200).send('No images returned');
    if (!repo || !branch) return res.status(200).end();

    // Select the smallest image from the returns results.
    results.images.forEach(function(image) {
      if (!loresImage || image.meta.width < loresImage.meta.width)
        loresImage = image;
    });

    // Copy the smallest image to github (overwriting the original)
    q.push({
      branch: branch,
      repo: repo,
      filename: loresImage.image_identifier.replace(/(.*)-\d+(\.jpg)$/, '$1$2'),
      url: loresImage.s3_url,
      commitPrefix: '[RESIZE-WEBHOOK] '
    }, function(err) {
      if (err) console.error(err);
    });

    // Close the connection
    res.status(202).end();
  };
};
