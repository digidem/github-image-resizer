var createRenamerFn = require('../helpers/github-image-renamer')
var test = require('tape')

var renamer = createRenamerFn('digidem-test/test', 'master')

test('Correctly derives github path from url', function (t) {
  var input = 'https://github.com/digidem-test/test/raw/master/assets/14459663821_329233b70e_k_d.jpg'
  var expected = 'assets/14459663821_329233b70e_k_d-500.jpg'

  t.equal(renamer(input, 500), expected)
  t.end()
})
