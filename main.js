const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), https = require('https');
const { spawn } = require('child_process');
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 780, minWidth: 760, minHeight: 600,
    autoHideMenuBar: true, backgroundColor: '#0c111b', title: 'Launcher',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function findExe(folder) {
  let files;
  try { files = fs.readdirSync(folder); } catch (e) { return null; }
  const bad = /unins|crash|redist|setup|launcher|vcredist|dxsetup|helper/i;
  const exes = files.filter(f => /\.exe$/i.test(f) && !bad.test(f)).map(f => ({ f, size: fs.statSync(path.join(folder, f)).size }));
  if (!exes.length) return null;
  const pref = exes.find(x => /2k/i.test(x.f));
  return path.join(folder, (pref || exes.sort((a, b) => b.size - a.size)[0]).f);
}
ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Choose your game folder' });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('ping', (_, url) => new Promise(res => {
  let u; try { u = new URL(/^https?:/.test(url) ? url : 'http://' + url); } catch (e) { return res({ ok: false }); }
  const lib = u.protocol === 'https:' ? https : http, t = Date.now();
  const rq = lib.request(u, { method: 'GET', timeout: 4000 }, r => { r.resume(); res({ ok: true, ms: Date.now() - t }); });
  rq.on('timeout', () => { rq.destroy(); res({ ok: false }); });
  rq.on('error', () => res({ ok: false }));
  rq.end();
}));
ipcMain.handle('verify', (_, folder) => {
  if (!folder || !fs.existsSync(folder)) return { ok: false, msg: 'Folder not found. Set the game folder in Settings.' };
  const exe = findExe(folder);
  return exe ? { ok: true, msg: 'Found ' + path.basename(exe) + '. Game folder looks good.' }
             : { ok: false, msg: 'No game .exe found in that folder. Check the path in Settings.' };
});
ipcMain.handle('launch', (_, folder, args) => new Promise(res => {
  const exe = findExe(folder);
  if (!exe) return res({ ok: false, error: 'No game .exe found in ' + folder + '. Set the game folder in Settings.' });
  const list = (args || '').split(/\s+/).filter(Boolean);
  const c = spawn(exe, list, { cwd: folder, detached: true, stdio: 'ignore' });
  c.on('spawn', () => { c.unref(); res({ ok: true, exe: path.basename(exe) }); });
  c.on('error', () => { // e.g. game needs admin: let Windows show the UAC prompt
    shell.openPath(exe).then(m => res(m ? { ok: false, error: m } : { ok: true, exe: path.basename(exe) }));
  });
}));
ipcMain.handle('quit', () => app.quit());
