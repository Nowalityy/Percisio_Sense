import { execSync } from 'node:child_process';

const MODE = process.env.APP_MODE || 'monolithic';

function run(cmd) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log(`🚀 Heroku postbuild — APP_MODE="${MODE}"`);

switch (MODE) {
  case 'backend':
    run('npm install --prefix backend --omit=dev');
    break;

  case 'frontend':
    run('npm install --prefix frontend --include=dev');
    run('npm run build --prefix frontend');
    break;

  case 'monolithic':
  default:
    run('npm install --prefix backend --omit=dev');
    run('npm install --prefix frontend --include=dev');
    run('npm run build --prefix frontend');
    break;
}

console.log(`\n✅ postbuild done (APP_MODE=${MODE})`);
