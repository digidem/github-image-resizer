var router = require('express').Router();

var verifyBlitlineWebhook = require('../middlewares/blitline-middleware')({
  secret: process.env.BLITLINE_SECRET
});

var BlitlineWebhookResponder = require('../controllers/blitline-webhook-responder');

router.use(verifyBlitlineWebhook);

router.post('/', BlitlineWebhookResponder());

module.exports = router;
