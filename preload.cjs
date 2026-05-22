const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    saveCredential: (credential) => ipcRenderer.invoke('save-credential', credential),
    getCredentials: () => ipcRenderer.invoke('get-credentials'),
    deleteCredential: (id) => ipcRenderer.invoke('delete-credential', id),
    launchSsh: (credential) => ipcRenderer.invoke('launch-ssh', credential),
    importCredentials: () => ipcRenderer.invoke('import-credentials'),
    exportCredentials: () => ipcRenderer.invoke('export-credentials'),
    checkMasterPassword: () => false,
    unlock: (password) => true,
    setMasterPassword: (password) => Promise.resolve({ success: true }),
});
