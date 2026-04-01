const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('personnelApi', {
  getAll: () => ipcRenderer.invoke('personnel:getAll'),
  save: (record) => ipcRenderer.invoke('personnel:save', record),
  delete: (id, version) => ipcRenderer.invoke('personnel:delete', id, version),
});

contextBridge.exposeInMainWorld('authApi', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username: username, password: password }),
  getSession: () => ipcRenderer.invoke('auth:session'),
  logout: () => ipcRenderer.invoke('auth:logout'),
});

contextBridge.exposeInMainWorld('adminApi', {
  getRoles: () => ipcRenderer.invoke('admin:roles'),
  createUser: (payload) => ipcRenderer.invoke('admin:createUser', payload),
  listUsers: () => ipcRenderer.invoke('admin:listUsers'),
});

contextBridge.exposeInMainWorld('exportApi', {
  savePhsPdf: (payload) => ipcRenderer.invoke('export:phsPdf', payload),
  savePhsWord: (payload) => ipcRenderer.invoke('export:phsWord', payload),
});
