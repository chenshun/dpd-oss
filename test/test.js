var request = require('request');

var urlObject = {
  protocol: 'http',
  hostname: 'localhost',
  port: '2403',
  pathname: '/'
}

var url = require('url').format(urlObject);

var options = {
  method: 'POST',
  json: false,
  url: '',
}

describe('test dpd-oss\n', function () {
  it('GET', function (done) {
    console.log(url);
    done();
  })
  it('POST', function (done) {
    done();
  })
  it('DELETE', function (done) {
    done();
  })
  it('PUT', function (done) {
    done();
  })
})
