var express = require('express');
var app     = express();

var githubWebhook = require('./routes/github-webhook');
var blitlineWebhook = require('./routes/blitline-webhook');

app.use('/hooks/github', githubWebhook);
app.use('/hooks/blitline', blitlineWebhook);

module.exports = app;
