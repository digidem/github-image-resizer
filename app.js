var express = require('express')
var app = express()

var githubWebhook = require('./routes/github-webhook')

app.use('/hooks/github', githubWebhook)

module.exports = app
