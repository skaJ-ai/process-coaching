const { spawn } = require('child_process');
const path = require('path');

const root = 'C:/dev/process-coaching';
const backendDir = path.join(root, 'backend');
const frontendDir = path.join(root, 'frontend');
const py = 'C:\\Users\\jangs\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function waitHttp(url, ms=60000){
  const start = Date.now();
  while(Date.now() - start < ms){
    try {
      const res = await fetch(url);
      if(res.ok) return true;
    } catch {}
    await sleep(800);
  }
  return false;
}

function runChild(cmd, args, cwd, env = process.env){
  const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  p.stdout.on('data', d => process.stdout.write(d));
  p.stderr.on('data', d => process.stderr.write(d));
  return p;
}

(async ()=>{
  const backend = runChild('cmd.exe', ['/c', `"${py}" app.py`], backendDir);
  const frontend = runChild('cmd.exe', ['/c', 'npm.cmd run dev -- --port 5175 --strictPort'], frontendDir);

  try {
    const apiOk = await waitHttp('http://localhost:8000/api/health', 70000);
    const uiOk = await waitHttp('http://localhost:5175/flowchart/', 70000);
    console.log(`READY API=${apiOk} UI=${uiOk}`);
    if(!apiOk || !uiOk){
      process.exitCode = 2;
      return;
    }

    const ux = runChild('node', ['scripts/qa-ux-edge.cjs'], frontendDir, { ...process.env, QA_BASE_URL: 'http://localhost:5175/flowchart/' });
    const uxExit = await new Promise(res => ux.on('exit', code => res(code ?? 1)));
    process.exitCode = uxExit;

  } finally {
    try { backend.kill('SIGTERM'); } catch {}
    try { frontend.kill('SIGTERM'); } catch {}
    await sleep(800);
    try { backend.kill('SIGKILL'); } catch {}
    try { frontend.kill('SIGKILL'); } catch {}
  }
})();
