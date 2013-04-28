var Resource = require('deployd/lib/resource');
var HttpUtil = require('deployd/lib/util/http');
var formidable = require('formidable');
var ossAPI = require('./lib/client');
var fs = require('fs');
var util = require('util');
var path = require('path');

function OSSBucket (name, options) {
  Resource.apply(this, arguments);
  if (this.config.bucket && this.config.accessKeyId && this.config.accessKeySecret) {
    var ossOptions = {};
    ossOptions.accessKeyId = this.config.accessKeyId;
    ossOptions.accessKeySecret = this.config.accessKeySecret;
    oss = new ossAPI.ossClient(ossOptions);
  } else {
    throw new Error('oss config missing');
  }
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
  if (request.method === "POST" || request.method === "PUT" || request.method === 'GET') {
    oss.putObject(this.config.bucket, Date.now().toString(), __dirname + '/oss.js', function (err, result) {
      if (err) {
        return context.done(null, {
          statusCode: 500,
          message: 'upload failed'
        })
      } else {
        return context.done(null, {
          statusCode: 200,
          message: 'upload success',
          fileName: ''
        })
      }
    })
  } else if (request.method === "GET") {
    //todo:重定向到阿里云
    var url = 'http://' + bucket.config.bucket + '.oss.aliyuncs.com/' + domin.url.split('/')[2];
    HttpUtil.redirect(context.res ,url);
  } else if (request.method === "DELETE") {
    return context.done(null, {
      statusCode: 200,
      message: 'delete success'
    })
  } else {
    return context.done(null, {
      statusCode: 404,
      message: 'unknow'
    })
  }
}

module.exports = OSSBucket;
