import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import nextEnv from '@next/env';
import { cloudConnectSource } from './static-headers.mjs';

nextEnv.loadEnvConfig(process.cwd());
const connectSource = cloudConnectSource(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const code = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], {
    stdio: 'inherit', env: { ...process.env, OPSTRIAGE_STATIC_EXPORT: '1' },
  });
  child.on('error', reject);
  child.on('exit', (result) => resolve(result ?? 1));
});
if (code !== 0) process.exitCode = code;
else {
  const template = await readFile('public/_headers', 'utf8');
  if (!template.includes("connect-src 'self'")) throw new Error('Static security header template is missing its connect policy.');
  await writeFile('out/_headers', template.replace(/connect-src [^;]+;/, `connect-src ${connectSource};`));
}
