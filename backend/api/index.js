// Vercel Serverless Function entry point
// Imports the compiled NestJS app from dist/serverless.js (built by nest build)
const handler = require('../dist/serverless').default;
module.exports = handler;
