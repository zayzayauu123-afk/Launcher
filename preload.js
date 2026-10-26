const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  pickFolder: () => ipcRenderer.invoke('pick'),
  ping: (u) => ipcRenderer.invoke('ping', u),
  verify: (f) => ipcRenderer.invoke('verify', f),
  launch: (f, a) => ipcRenderer.invoke('launch', f, a),
  quit: () => ipcRenderer.invoke('quit')
});
