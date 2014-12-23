var Blitline = require('simple_blitline_node');
var blitline = new Blitline();
var validator = require('validator');
var extend = require('xtend');
var url = require('url');

var lowresSize = 200;

var BlitlineResizer = function(settings) {
  if (typeof settings != 'object')
    throw new TypeError('must provide an options object');

  if (typeof settings.blitlineAppId != 'string')
    throw new TypeError('must provide a \'blitlineAppId\' option');

  if (!validator.isURL(settings.postbackUrl))
    throw new TypeError('must provide a valid URL for \'postbackUrl\'');

  if (typeof settings.s3Bucket != 'string')
    throw new TypeError('must provide a \'s3Bucket\' option');

  function resize(options, callback) {
    if (typeof options != 'object')
      return callback(new TypeError('must provide an options object'));

    if (!(options.images instanceof Array))
      return callback(new TypeError('must provide an array of images'));

    if (typeof options.repo != 'string')
      return callback(new TypeError('must provide a \'repo\' option'));

    if (typeof options.sizes != 'number' && !(options.sizes instanceof Array))
      return callback(new TypeError('must provide a size or array of sizes'));

    if (!(options.sizes instanceof Array)) options.sizes = [options.sizes];

    options.branch = options.branch || 'master';

    var headers = {
      "X-Blitline-Signature": process.env.BLITLINE_SECRET,
      "X-Blitline-Origin-Repo": options.repo,
      "X-Blitline-Origin-Branch": options.branch
    };

    var jobDefaults = {
      "application_id": settings.blitlineAppId,
      "postback_url": settings.postbackUrl,
      "retry_postback": false,
      "postback_headers": headers,
      "v": 1.21,
    };

    options.images.forEach(function(filename) {
      var imageUrl = 'https://raw.githubusercontent.com/' + options.repo +
        '/' + options.branch + '/' + filename;
      var imageId = filename.substr(0, filename.lastIndexOf('.')) ||
        filename;
      
      var job = extend({ src: imageUrl, functions: [] }, jobDefaults);

      options.sizes.forEach(function(size) {
        job.functions = job.functions.concat(resizeJson(imageId, size, true));
      });

      var lowres = resizeJson(imageId, lowresSize)[0];
      var id = lowres.save.image_identifier.replace('-' + lowresSize + '.jpg', '-lo.jpg');
      lowres.save.image_identifier = lowres.save.s3_destination.key = id;
      job.functions.push(lowres);

      blitline.addJob(job);
    });

    blitline.postJobs(callback);
  }

  // Creates resize function job parameters for Blitline
  // Returns an array
  // If 'retina' is true returns a second function to 
  // create the image at double resolution.
  function resizeJson(fileId, width, retina) {
    var filename = fileId + '-' + width + '.jpg';

    var fn = [{
      "name": "resize_to_fit",
      "params": {
        "width": width,
        "only_shrink_larger": true
      },
      "save": saveJson(filename)
    }];

    if (retina) {
      filename = fileId + '-' + width + '@2x.jpg';

      fn.push({
        "name": "resize_to_fit",
        "params": {
          "width": width * 2,
          "only_shrink_larger": true
        },
        "save": saveJson(filename)
      });
    }

    return fn;
  }

  // Creates AWS S3 job parameters for Blitline
  function saveJson(filename) {
    return {
      "image_identifier": filename,
      "s3_destination": {
        "bucket": settings.s3Bucket,
        "key": filename,
        "headers": {
          "Cache-Control": "max-age=31536000, public",
          "Content-type": "image/jpeg"
        }
      }
    };
  }

  return resize;
};

module.exports = BlitlineResizer;
