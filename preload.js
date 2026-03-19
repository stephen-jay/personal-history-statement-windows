const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personnelApi', {
  getAll: () => ipcRenderer.invoke('personnel:getAll'),
  save: (record) => ipcRenderer.invoke('personnel:save', record),
  delete: (id) => ipcRenderer.invoke('personnel:delete', id),
});
