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
  //if (!request.internal) {return context.done('禁止客户端访问');}
  //if (!this.client) {return context.done('missing oss configuration');}

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
          if (err) {return uploadedFile(err);}
          bucket.uploadFile(file.filename, file.size, file.mime, fs.createReadStream(file.path), uploadedFile);
        });
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

  if (req.method === "POST" || req.method === "PUT") {

    domain.fileSize = ctx.req.headers['content-length'];
    domain.fileName = path.basename(ctx.url);

    if (this.events.upload) {
      this.events.upload.run(ctx, domain, function(err) {
        if (err) return ctx.done(err);
        bucket.upload(ctx, next);
      });
    } else {
      this.upload(ctx, next);
    }

  } else if (req.method === "GET") {
    if (ctx.res.internal) return next(); // This definitely has to be HTTP

    if (this.events.get) {
      this.events.get.run(ctx, domain, function(err) {
        if (err) return ctx.done(err);
        bucket.get(ctx, next);
      });
    } else {
      this.get(ctx, next);
    }

  } else if (req.method === "DELETE") {

    if (this.events['delete']) {
      this.events['delete'].run(ctx, domain, function(err) {
        if (err) return ctx.done(err);
        bucket.del(ctx, next);
      });
    } else {
      this.del(ctx, next);
    }
  } else {
    next();
  }
}

OSSBucket.prototype.uploadFile = function (filename, filesize, mime, stream, fn) {
  var bucket = this;
  var headers = {
    'Content-Type': mime,
    'Content-Length': filesize
  }

  this.client.putStream(stream, filename, headers, function (err, res) {
    if (err) return {context.done(err);}
    if (res.statusCode !== 200) {
      bucket.readStream(res, function (err, message) {
        fn(err || message);
      })
    } else {
      fn();
    }
  })
}

OSSBucket.prototype.upload = function (context, next) {
  var bucket = this;
  var request = context.req;
  var headers = {
    'Content-Length': request.headers['content-length'],
    'Content-Type': request.headers['content-type'];
  }

  this.client.putStream(request, context.url, headers, function (err, res) {
    if (err) {return context.done(err);}
    if (res.statusCode !== 200) {
      bucket.readStream(res, function (err, message) {
        context.done(err || message);
      })
    } else {
      context.done();
    }
  })
  request.resume();
}

OSSBucket.prototype.get = function (context, next) {
 var bucket = this;
 var url = 'http://oss.aliyuncs.com/' + this.config.bucket + context.url;

 HttpUtil.redirect(context.res, url);
}

OSSBucket.prototype.del = function (context, next) {
  var bucket = this;
  this.client.deleteFile(context.url, function (err, res) {
    if (err) context.done(err);
    if (res.statusCode !== 200) {
      bucket.readStream(res, function (err, message) {
        context.done(err || message);
      })
    } else {
      context.done();
    }
  })
}

OSSBucket.prototype.readStream = function (stream, fn) {
  var buffer = '';
  stream.on('data', function (data) {
    buffer += data;
  }).on('end', function () {
    fn(null, buffer);
  }).on('error', function (err) {
    fn(err);
  })
}
