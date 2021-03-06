var fs = require('fs');
var path = require('path');
var util = require('util');
var crypto = require('crypto');

var xml2js = require('xml2js');
var request = require('request');
var mimetypes = require('mime');
var step = require('step');

function OssClient (options) {
  this._accessKeyId = options.accessKeyId;
  this._accessKeySecret = options.accessKeySecret;
  this._host = options.host || "oss.aliyuncs.com";
  this._port = options.port || "8080";
  this._timeout = 30000000;
};
/*
get the Authorization header
"Authorization: OSS " + accessKeyId + ":" + base64(hmac-sha1(METHOD + "\n"
+ CONTENT-MD5 + "\n"
+ CONTENT-TYPE + "\n"
+ DATE + "\n"
+ CanonicalizedOSSHeaders
+ Resource))
*/
OssClient.prototype.getSign = function (method, contentType, contentMd5, date, metas, resource) {
  var params = [
    method,
    contentType || '',
    contentMd5 || '',
    date
  ]
  // sort the metas
  if (metas) {
    var metaSorted = Object.keys(metas).sort();
    for(var i = 0, len = metaSorted.length; i < len; i++) {
      var k = metaSorted[i];
      params.push(k.toLowerCase() + ':' + metas[k]);
    }
  }
  params.push(resource);
  debug(params);
  var basicString = crypto.createHmac('sha1', this._accessKeySecret);
  basicString.update(params.join('\n'));
  return 'OSS ' + this._accessKeyId + ':' + basicString.digest('base64');
}
OssClient.prototype.getResource = function (ossParams) {
  var resource = '';
  if (typeof ossParams['bucket'] === 'string') {
     resource = '/' + ossParams['bucket'];
  }
  if (typeof ossParams['object'] === 'string') {
    resource = resource + '/' + ossParams['object'];
  }
  if (typeof ossParams['isAcl'] === 'boolean') {
     resource = resource + '?acl';
  }
  if (typeof ossParams['isGroup'] === 'boolean') {
     resource = resource + '?group';
  }
  return resource;
}
OssClient.prototype.getUrl = function (ossParams) {
  var url = 'http://' + this._host + ':' + this._port;
  var params = [];
  if (typeof ossParams['bucket'] === 'string') {
    url = url + '/' + ossParams['bucket'];
  }
  if (typeof ossParams['object'] === 'string') {
    url = url + '/' + ossParams['object'];
  }
  if (typeof ossParams['prefix'] === 'string') {
    params.push('prefix=' + ossParams['prefix']);
  }
  if (typeof ossParams['marker'] === 'string') {
    params.push('marker=' + ossParams['marker']);
  }
  if (typeof ossParams['maxKeys'] === 'string' || typeof ossParams['maxKeys'] === 'number') {
    params.push('max-keys=' + ossParams['maxKeys']);
  }
  if (typeof ossParams['delimiter'] === 'string') {
    params.push('delimiter='+ ossParams['delimiter']);
  }
  if (params.length > 0) {
    url = url + '?' + params.join('&');
  }
  if (typeof ossParams['isAcl'] === 'boolean') {
    url = url + '?acl';
  }
  if (typeof ossParams['isGroup'] === 'boolean') {
    url = url + '?group';
  }
  return url;
}
OssClient.prototype.fillHeaders = function(headers, method, metas, ossParams) {
  var date = new Date().toGMTString();
  headers.Date = date;
  if (ossParams.isGroup) {
    headers['content-type'] = "txt/xml";
  }
  if (ossParams.userMetas) {
    metas = metas || {};
    for (i in ossParams.userMetas) {
      metas[i] = ossParams.userMetas[i];
    }
  }
  for (var i in metas) {
    headers[i] = metas[i];
  }
  var resource = this.getResource(ossParams);
  headers['Authorization'] = this.getSign(method, headers['content-Md5'], headers['content-type'], date, metas, resource);
}
OssClient.prototype.getHeaders = function (method, metas, ossParams, callback) {
  var headers = {};
  var _this = this;
  if (ossParams.srcFile) {
    headers['content-type'] = mimetypes.lookup(path.extname(ossParams.srcFile));
    step(function loadFile() {
      fs.stat(ossParams.srcFile, this.parallel());
      fs.readFile(ossParams.srcFile, this.parallel());
    }, function fillLocalFileData(error, stat, fileData) {
      if (error) {
        callback(error);
        return;
      }
      headers['content-Length'] = stat.size;
      var md5 = crypto.createHash('md5');
      md5.update(fileData);
      headers['content-Md5'] = md5.digest('hex');
      _this.fillHeaders(headers, method, metas, ossParams);
      callback(null, headers);
    })
  } else {
    _this.fillHeaders(headers, method, metas, ossParams);
    callback(null, headers);
  }
}
OssClient.prototype.doRequest = function (method, metas, ossParams, callback) {
  var _this = this;
  step (function getHeaders() {
    _this.getHeaders(method, metas, ossParams, this);
  }, function readyGo(error, headers) {
    if(!headers) return;
    var options = {};
    options.method = method;
    options.url = _this.getUrl(ossParams);
    options.headers = headers;
    options.timeout = _this._timeout;

    debug(ossParams);
    debug(options);

    if (ossParams.isGroup) {
      options.body = _this.getObjectGroupPostBody(ossParams.bucket, ossParams.objectArray);
    }
    var req = request(options, function (error, response, body) {
      if (error && callback) return callback(error);
      if (response.statusCode != 200 && response.statusCode != 204) {
        var e = new Error(body);
        e.code = response.statusCode;
        if (callback) callback(e);
      } else {
        // if we should write the body to a file, we will do it later
        if (body && !ossParams.dstFile) {
          var parser = new xml2js.Parser();
          parser.parseString(body, function(error, result) {
            callback(error, result);
          });
        } else {
          if (method == 'HEAD') callback(error, response.headers);
        }
      }
    })
    //put a file to oss
    if (ossParams.srcFile) {
      var rstream = fs.createReadStream(ossParams.srcFile);
      rstream.pipe(req);
      req.on('end', callback);
    }
    //get a object from oss and save as a file
    if (ossParams.dstFile) {
      var wstream = fs.createWriteStream(ossParams.dstFile);
      req.pipe(wstream);
      req.on('end', callback);
    }
  })
}
OssClient.prototype.createBucket = function (bucket, acl, callback) {
  if (!bucket || !acl) {throw new Error('error arguments');}
  var method = 'PUT';
  var metas = {'X-OSS-ACL': acl};
  var ossParams = {
    bucket: bucket
  }
  this.doRequest(method, metas, ossParams, callback);
}
OssClient.prototype.listBucket = function (callback) {
  var method = 'GET';
  var ossParams = {
    bucket: ''
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.deleteBucket = function (bucket, callback) {
  if (!bucket) {throw new Error('error arguments');}
  var method = 'DELETE';
  var ossParams = {
    bucket: bucket
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.getBucketAcl = function (bucket, callback) {
  if (!bucket) {throw new Error('error arguments');}
  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    isAcl: true
  }
  this.doRequest(method, null, ossParams, callback);
}
/*
set bucket acl
@param bucket {String}
@param acl {String} 'private' or 'public-read' or 'public-read-write'
@param callback {Function}
*/
OssClient.prototype.setBucketAcl = function (bucket, acl, callback) {
  if (!bucket || !acl) {throw new Error('error arguments');}
  var method = 'PUT';
  var metas = {'X-OSS-ACL': acl};
  var ossParams = {
      bucket: bucket
  }
  this.doRequest(method, metas, ossParams, callback);
}
OssClient.prototype.putObject = function (bucket, object, srcFile, callback) {
  if (!bucket || !object || !srcFile) {throw new Error('error arguments');}
  var method = 'PUT';
  var ossParams = {
    bucket: bucket,
    object: object,
    srcFile: srcFile
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.copyObject = function (bucket, dstObject, srcObject, callback) {
  if (!bucket || !dstObject || !srcObject) {throw new Error('error arguments');}
  var method = 'PUT';
  var ossParams = {
    bucket: bucket,
    object: dstObject
  }
  var metas = { 'x-oss-copy-source': '/' + bucket + '/' + srcObject };
  this.doRequest(method, metas, ossParams, callback);
}
OssClient.prototype.deleteObject = function (bucket, object, callback) {
  if (!bucket || !object) {throw new Error('error arguments');}
  var method = 'DELETE';
  var ossParams = {
    bucket: bucket,
    object: object
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.getObject = function (bucket, object, dstFile, callback) {
  if (!bucket || !object || !dstFile) {throw new Error('error arguments');}
  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    object: object,
    dstFile: dstFile
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.headObject = function (bucket, object, callback) {
  if (!bucket || !object) {throw new Error('error arguments');}
  var method = 'HEAD';
  var ossParams = {
    bucket: bucket,
    object: object
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.listObject = function (bucket, callback) {
  if (!bucket) {throw new Error('error arguments');}
  var method = 'GET';
  var ossParams = {
    bucket: bucket
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.getObjectEtag = function (object) {
  var md5 = crypto.createHash('md5');
  md5.update(fs.readFileSync(object));
  return md5.digest('hex').toUpperCase();
}
OssClient.prototype.getObjectGroupPostBody = function (bucket, objectArray, callback) {
  var xml = '<CreateFileGroup>';
  var index = 0;
  for (i in objectArray) {
    index++;
    var etag = this.getObjectEtag(objectArray[i]);
    xml += '<Part>';
    xml += '<PartNumber>' + index + '</PartNumber>';
    xml += '<PartName>' + objectArray[i] + '</PartName>';
    xml += '<ETag>' + etag + '</ETag>';
    xml += '</Part>';
  }
  xml += '</CreateFileGroup>';
  return xml;
}
OssClient.prototype.createObjectGroup = function (bucket, objectGroup, objectArray, callback) {
  if (!bucket || !objectGroup || !objectArray) {throw new Error('error arguments');}
  var method = 'POST';
  var ossParams = {
    bucket: bucket,
    object: objectGroup,
    objectArray: objectArray,
    isGroup: true
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.getObjectGroup = function (bucket, objectGroup, dstFile, callback) {
  if (!bucket || !objectGroup || !dstFile) {throw new Error('error arguments');}
  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    object: objectGroup,
    isGroup: true,
    dstFile: dstFile
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.getObjectGroupIndex = function (bucket, objectGroup, callback) {
  if (!bucket || !objectGroup) {throw new Error('error arguments');}
  var method = 'GET';
  var ossParams = {
    bucket: bucket,
    object: objectGroup
  }
  var metas = {'X-OSS-FILE-GROUP': ''};
  this.doRequest(method, metas, ossParams, callback);
}
OssClient.prototype.headObjectGroup = function (bucket, objectGroup, callback) {
  if (!bucket || !objectGroup) {throw new Error('error arguments');}
  var method = 'HEAD';
  var ossParams = {
    bucket: bucket,
    object: objectGroup
  }
  this.doRequest(method, null, ossParams, callback);
}
OssClient.prototype.deleteObjectGroup = function (bucket, objectGroup, callback) {
  if (!bucket || !objectGroup) {throw new Error('error arguments');}
  var method = 'DELETE';
  var ossParams = {
    bucket: bucket,
    object: objectGroup
  }
  this.doRequest(method, null, ossParams, callback);
}
var debugLevel = process.env['NODE_DEBUG_OSSCLIENT'] ? 1 : 0;

function debug (x) {
  if (debugLevel > 0) console.log(x);
}

exports.ossClient = OssClient;
