const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personnelApi', {
  getAll: () => ipcRenderer.invoke('personnel:getAll'),
  save: (record) => ipcRenderer.invoke('personnel:save', record),
  delete: (id, version) => ipcRenderer.invoke('personnel:delete', id, version),
});

contextBridge.exposeInMainWorld('exportApi', {
  savePhsPdf: (payload) => ipcRenderer.invoke('export:phsPdf', payload),
  savePhsWord: (payload) => ipcRenderer.invoke('export:phsWord', payload),
  savePhsDocx: (payload) => ipcRenderer.invoke('export:phsDocx', payload),
});
