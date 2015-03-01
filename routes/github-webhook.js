var router = require('express').Router();

var verifyGithubWebhook = require('github-webhook-middleware')({
    secret: process.env.GITHUB_SECRET
});

var GithubWebookResponder = require('../controllers/github-webhook-responder');

router.use(verifyGithubWebhook);

router.post('/*', GithubWebookResponder());

module.exports = router;
