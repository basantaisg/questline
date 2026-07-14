// Vercel serverless entry for the NestJS API.
//
// Deliberately plain JS requiring the tsc-built output: Vercel compiles
// TypeScript functions with esbuild, which does not support
// emitDecoratorMetadata, and Nest's DI container needs that metadata.
// Building with `nest build` (tsc) first keeps the metadata intact.
const { createServer } = require('../dist/src/serverless');

module.exports = async (req, res) => {
  const app = await createServer();
  return app(req, res);
};
