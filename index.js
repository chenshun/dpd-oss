var Resource = require('deployd/lib/resource');
var HttpUtil = require('deployd/lib/util/http');
var formidable = require('formidable');
var fs = require('fs');
var util = require('util');
var path = require('path');

function OSSBucket (name, options) {
  Resource.apply(this, arguments);
  if (this.config.bucket && this.config.key && this.config.secret) {
    //todo:配置处理
    this.client = {
      bucket: this.config.bucket,
      key: this.config.key,
      secret: this.config.secret
    }
  }
}
util.inherits(OSSBucket, Resource);
module.exports = OSSBucket;
OSSBucket.label = "OSSBucket";
OSSBucket.events = ['upload', 'get', 'delete'];
OSSBucket.basicDashboard = {
  setting: [
    {
      name: 'bucket',
      type: 'string'
    }, {
      name: 'key',
      type: 'string'
    }, {
      name: 'secret',
      type: 'string'
    }
  ]
}

OSSBucket.prototype.clientGeneration = true;
OSSBucket.prototype.handle = function (context, next) {
  var request = context.req;
  var bucket = this;
  var domin = {
    url: context.url
  }
  //if (!request.internal) return context.done('禁止客户端访问');
  //if (!this.client) return context.done('missing oss configuration');

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
    if (context.res.internal) return next(); // This definitely has to be HTTP

    if (this.events.get) {
      this.events.get.run(context, domain, function(err) {
        if (err) return context.done(err);
        bucket.get(context, next);
      })
    } else {
      this.get(context, next);
    }
  } else if (request.method === "DELETE") {
    if (this.events['delete']) {
      this.events['delete'].run(context, domain, function(err) {
        if (err) return context.done(err);
        bucket.del(context, next);
      })
    } else {
      this.del(context, next);
    }
  } else {
    next();
  }
}

OSSBucket.prototype.uploadFile = function (filename, filesize, mime, stream, callback) {
  var bucket = this;
  var headers = {
    'Content-Type': mime,
    'Content-Length': filesize
  }

  this.client.putStream(stream, filename, headers, function (err, response) {
    if (err) return context.done(err);
    if (response.statusCode !== 200) {
      bucket.readStream(response, function (err, message) {
        callback(err || message);
      })
    } else {
      callback();
    }
  })
}

OSSBucket.prototype.upload = function (context, next) {
  var bucket = this;
  var request = context.req;
  var headers = {
    'Content-Length': request.headers['content-length'],
    'Content-Type': request.headers['content-type']
  }

  this.client.putStream(request, context.url, headers, function (err, response) {
    if (err) return context.done(err);
    if (response.statusCode !== 200) {
      bucket.readStream(response, function (err, message) {
        context.done(err || message);
      })
    } else {
      context.done();
    }
  })
  request.resume();
}

OSSBucket.prototype.get = function (context, next) {
  //get请求直接重定向到阿里云
  var bucket = this;
  var url = 'http://' + this.config.bucket + '.oss.aliyuncs.com/' + context.url;

  HttpUtil.redirect(context.res, url);
}

OSSBucket.prototype.del = function (context, next) {
  var bucket = this;
  this.client.deleteFile(context.url, function (err, response) {
    if (err) context.done(err);
    if (response.statusCode !== 200) {
      bucket.readStream(response, function (err, message) {
        context.done(err || message);
      })
    } else {
      context.done();
    }
  })
}

OSSBucket.prototype.readStream = function (stream, callback) {
  var buffer = '';
  stream.on('data', function (data) {
    buffer += data;
  }).on('end', function () {
    callback(null, buffer);
  }).on('error', function (err) {
    callback(err);
  })
}
