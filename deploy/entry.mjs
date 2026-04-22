const MODE = process.env.APP_MODE || 'monolithic';

console.log(`🚀 Starting Percisio-Sense — APP_MODE="${MODE}"`);

switch (MODE) {
  case 'frontend':
    await import('./static-server.mjs');
    break;

  case 'backend':
  case 'monolithic':
  default:
    await import('../backend/index.js');
    break;
}
