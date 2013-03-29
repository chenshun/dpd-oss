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
OSSBucket.events = ['get', 'put'];

OSSBucket.prototype.clientGeneration = true;
OSSBucket.prototype.handle = function (context, next) {
  console.log(context);
}
