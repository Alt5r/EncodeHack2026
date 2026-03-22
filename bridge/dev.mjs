import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const pythonCandidates = [
  path.join(root, '.venv', 'bin', 'python'),
  path.join(root, '.venv', 'bin', 'python3'),
];
const python = pythonCandidates.find((candidate) => existsSync(candidate));

if (!python) {
  console.error(
    '[watchtower-dev] Missing repo-local backend runtime. Expected .venv/bin/python. ' +
      'Run `.venv/bin/pip install -e .` first.',
  );
  process.exit(1);
}

const childProcesses = [];
let shuttingDown = false;

function prefixStream(stream, prefix, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`${prefix}${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer) {
      target.write(`${prefix}${buffer}\n`);
      buffer = '';
    }
  });
}

function terminateChildren(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

function spawnTagged(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  childProcesses.push(child);
  prefixStream(child.stdout, `[${name}] `, process.stdout);
  prefixStream(child.stderr, `[${name}] `, process.stderr);
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[watchtower-dev] ${name} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`);
      terminateChildren();
      process.exit(code ?? 1);
    }
  });
  return child;
}

process.on('SIGINT', () => {
  terminateChildren('SIGINT');
  process.exit(130);
});
process.on('SIGTERM', () => {
  terminateChildren('SIGTERM');
  process.exit(143);
});
process.on('exit', () => {
  terminateChildren('SIGTERM');
});

spawnTagged(
  'backend',
  python,
  ['-m', 'uvicorn', 'watchtower_backend.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'],
  { PYTHONPATH: path.join(root, 'src') },
);

spawnTagged('frontend', 'npm', ['run', 'dev:frontend']);
