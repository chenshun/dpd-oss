var Resource = require('deployd/lib/resource');
var HttpUtil = require('deployd/lib/util/http');
var formidable = require('formidable');
var ossApi = require('./lib/client');
var fs = require('fs');
var util = require('util');
var path = require('path');

var option = {};
var oss;

function OSSBucket (name, options) {
  Resource.apply(this, arguments);
  if (this.config.bucket && this.config.accessKeyId && this.config.accessKeySecret) {
    option.accessId = this.config.accessKeyId;
    option.accessKey = this.config.accessKeySecret;
    oss = new ossApi.OssClient(option);
    oss.putObject(bucketName, filename, localfilepath, function (err, result) {

    })
  }
}

util.inherits(OSSBucket, Resource);

OSSBucket.label = "OSSBucket";
OSSBucket.defaultPath = "/files";
OSSBucket.events = ['upload', 'delete'];
OSSBucket.basicDashboard = {
  settings: [{
    name: 'Bucket',
    type: 'text'
  }, {
    name: 'AccessKeyId',
    type: 'text'
  }, {
    name: 'AccessKeySecret',
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

  if (!this.client) return context.done('配置为空');

  if (request.method === "POST" && !request.internal && request.headers['content-type'].indexOf('multipart/form-data') === 0) {
    var form = new formidable.IncomingForm();
    var remaining = 0;
    var files = [];
    var error;

    var uploadedFile = function (err) {
      if (err) {
        error = err;
        return context.done(err);
      } else if (!err) {
        remaining--;
        if (remaining <= 0) {
          if (request.headers.referer) {
            HttpUtil.redirect(context.res, request.headers.referer || '/');
          } else {
            context.done(null, files);
          }
        }
      }
    }

    form.parse(request).on('file', function (name, file) {
      remaining++;
      if (bucket.events.upload) {
        bucket.events.upload.run(context, {
          url: context.url,
          fileSize: file.size,
          fileName: file.filename
        }, function (err) {
          if (err) return uploadedFile(err);
          bucket.uploadFile(file.filename, file.size, file.mime, fs.createReadStream(file.path), uploadedFile);
        })
      } else {
        bucket.uploadFile(file.filename, file.size, file.mime, fs.createReadStream(file.path), uploadedFile);
      }
    }).on('error', function (err) {
      context.done(err);
      error = err;
    })
    request.resume();
    return ;
  }

  if (request.method === "POST" || request.method === "PUT") {
    domain.fileSize = context.req.headers['content-length'];
    domain.fileName = path.basename(context.url);
    if (this.events.upload) {
      this.events.upload.run(context, domain, function(err) {
        if (err) return context.done(err);
        bucket.upload(context, next);
      })
    } else {
      this.upload(context, next);
    }
  } else if (request.method === "GET") {
  } else if (request.method === "DELETE") {
  } else {
    next();
  }
}

module.exports = OSSBucket;
