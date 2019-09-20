exports.default = options => {
  require('ts-node').register({
    files: ['./impl.ts'],
    compilerOptions: {
      rootDir: '.',
      module: 'commonjs',
      target: 'es5',
      types: ['node']
    }
  });

  const impl = require('./impl');

  return impl.default(options);
};
