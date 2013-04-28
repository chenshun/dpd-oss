var Resource = require('deployd/lib/resource');
var HttpUtil = require('deployd/lib/util/http');
var formidable = require('formidable');
var ossApi = require('./lib/client');
var fs = require('fs');
var util = require('util');
var path = require('path');

function OSSBucket (name, options) {
  Resource.apply(this, arguments);
}

util.inherits(OSSBucket, Resource);

OSSBucket.label = "OSSBucket";
OSSBucket.defaultPath = "/kill-gbo";
OSSBucket.events = ['upload', 'delete'];
OSSBucket.basicDashboard = {
  settings: [{
    name: 'bucket',
    type: 'text'
  }, {
    name: 'accessKeyId',
    type: 'text'
  }, {
    name: 'accessKeySecret',
    type: 'textarea'
  }]
}

OSSBucket.prototype.clientGeneration = false;
OSSBucket.prototype.handle = function (context, next) {
  var request = context.req;
  var bucket = this;
  var domin = {
    url: context.url
  }
  if (this.config.bucket && this.config.accessKeyId && this.config.accessKeySecret) {
    var ossOptions = {};
    ossOptions.accessKeyId = this.config.accessKeyId;
    ossOptions.accessKeySecret = this.config.accessKeySecret;
    oss = new ossApi.OssClient(ossOptions);

    oss.putObject(this.config.bucket, Date.now().toString(), __dirname + '/index.js', function (err, result) {
      if (err) return console.log(err);
    })
  } else {
    return context.done('config wrong');
  }

  if (request.method === "POST" || request.method === "PUT") {
    return context.done('upload');
  } else if (request.method === "GET") {
    return context.done('hello get');
  } else if (request.method === "DELETE") {
    return context.done('hello delete');
  } else {
    return next();
  }
}

module.exports = OSSBucket;
