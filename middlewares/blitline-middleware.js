var bodyParser = require('body-parser');

function verifyBlitlineWebhook(options) {
  if (typeof options != 'object')
    throw new TypeError('must provide an options object');

  if (typeof options.secret != 'string' || options.secret === '')
    throw new TypeError('must provide a \'secret\' option');

  var jsonParser = bodyParser.json({
    verify: function(req) {
      var sig = req.headers['x-blitline-signature'];

      if (!sig)
        throw new Error('No X-Blitline-Signature found on request');

      if (sig !== options.secret)
        throw new Error('X-Blitline-Signature does not match secret');
    }
  });

  return function blitlineParse(req, res, next) {
    jsonParser(req, res, function(err) {
      if (err) return next(err);

      // This cleans up malformed JSON in retried postbacks
      // Blitline for some reason prepends keys with ':'
      if (req.body[':results']) {
        req.body.results = req.body[':results'];
        delete req.body[':results'];
      }

      if (!req.body.results) next(err);

      for (var key in req.body.results) {
        if (key.slice(0,1) === ':') {
          req.body.results[key.slice(1)] = req.body.results[key];
          delete req.body.results[key];
        }
      }

      next();
    });
  };
}

module.exports = verifyBlitlineWebhook;
