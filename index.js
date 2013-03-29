var Resource = require('deployd/lib/resource');
var Http = require('deployd/lib/util/http');
var fs = require('fs');
var util = require('util');
var path = require('path');

function OSSBucket (name, options) {
  Resource.apply(this, arguments);
}
util.inherits(OSSBucket, Resource);
module.exports = OSSBucket;
OSSBucket.label = "OSSBucket";
OSSBucket.events = ['get', 'put', 'post', 'delete'];
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

OSSBucket.prototype.clientGeneration = false;
OSSBucket.prototype.handle = function (context, next) {
  var request = context.req;
  var bucket = this;
  var domin = {
    url: context.url
  }

  if (request.internal) {
    if (request.method === 'PUT') {
      console.log('oss put');
    } else if (request.method === 'DELETE') {
      console.log('oss delete');
    } else if (request.method === 'POST') {
      console.log('oss post');
    } else if (request.method === 'GET') {
      console.log('oss get');
    } else {
      console.log('oss unknow');
    }
  } else {
    console.log('oss unvalid');
  }
}
OSSBucket.prototype.get = function (context, next) {
 var bucket = this;
 console.log(bucket);
}
