# github-image-resizer

[![Build Status](https://travis-ci.org/digidem/github-image-resizer.svg?branch=master)](https://travis-ci.org/digidem/github-image-resizer)

Resizes images pushed to Github and saves them to S3, replacing the original on Github with a lo-res version

## Why?

Responsive images for a static site.

We use [jekyll](http://jekyllrb.com/), a static site generator, for [our website](http://www.digital-democracy.org/) and we edit it with [Prose](http://prose.io/). Prose is a web app that connects directly to Github and allows somebody to edit markdown on Github without needing to use git or the command line.

Prose includes functionality to upload images to Github with a post. The problem is that our website is responsive, and we do not want to use the full-resolution image on smaller devices. There are online services to dynamically resize images on each request, but they cost money, and don't match the static site mentality.

Our solution is to convert each image to multiple sizes when we first upload it, then we replace the original image with a lo-res version that will load on initial page load. We then check the screen size of the website when it loads and load the correct sized image to replace the placeholder.

## Installation

1. Setup an account with [Blitline](http://www.blitline.com/) which is free for 2hrs of processing a month, which is a lot of resizing images.

2. Create an [Amazon S3 bucket](http://docs.aws.amazon.com/AmazonS3/latest/gsg/CreatingABucket.html) for your images.

3. Make sure [Blitline has permissions](https://www.blitline.com/docs/s3_permissions) to write to your S3 bucket.

4. Deploy this server to Heroku by clicking the button below. Copy the `GITHUB_SECRET` - you will need that for setting up the Github webhook.

    [![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

5. [Create a webhook](https://developer.github.com/webhooks/creating/) on your Github repo. Payload Url should be `https://YOUR_APP_ID.herokuapp.com`, Content Type should be `application/json`, Secret should be the same as the `GITHUB_SECRET` environment variable on your Heroku App. You should just send the `push` event. Set your webhook to active.

That's it (what do you mean "that's it"? that's a whole bunch of work!). When you make a push to Github that includes an image that matches `/.+\.(jpg|jpeg|png|tif|tiff|gif)$/` then you will get a bunch of different sized images in your S3 bucket, and the original will be replaced with a lo-res version in your repo.

## Testing

You will need to set a `BLITLINE_APP_ID` environment variable and a `GITHUB_TOKEN` for a testing account. Tests will create a temporary repo (named `temp` + current date stamp) and then delete it after tests complete.

```sh
npm install
npm test
```
