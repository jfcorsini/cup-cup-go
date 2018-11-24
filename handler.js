'use strict';

const awsServerlessExpress = require('aws-serverless-express');
const app = require('./src/index');

const server = awsServerlessExpress.createServer(app);

module.exports = {
  app: (event, context) => awsServerlessExpress.proxy(server, event, context),
};
