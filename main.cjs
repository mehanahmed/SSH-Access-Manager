const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Determine if we're in dev mode
const isDev = !app.isPackaged;
const DATA_DIR = app.getPath('userData');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// --- Encryption Helpers ---
const ALGO = 'aes-256-cbc';
const DEFAULT_SALT = 'default-salt'; // For non-master-password mode
const DEFAULT_KEY_SOURCE = 'ssh-access-default-key';

// Global state for encryption key
let globalKey = null;

function deriveKey(password, salt) {
    // Derive a 32-byte key
    return crypto.scryptSync(password, salt, 32);
}

function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text, key) {
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift(), 'hex');
        const encryptedText = parts.join(':');
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error("Decryption failed:", err);
        return null; // Wrong key or corrupted data
    }
}

// --- Window Management ---
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        backgroundColor: '#1e1e1e',
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());

    if (isDev) {
        // Wait a bit for Vite to start? Or assume it's running via concurrently
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// Master password handlers removed

// 4. Get Credentials
ipcMain.handle('get-credentials', async () => {
    if (!globalKey) {
        globalKey = deriveKey(DEFAULT_KEY_SOURCE, DEFAULT_SALT);
    }

    if (!fs.existsSync(CREDENTIALS_FILE)) return [];

    try {
        const content = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const json = decrypt(content, globalKey);
        if (!json) return []; // Decryption failed
        return JSON.parse(json);
    } catch (e) {
        console.error(e);
        return [];
    }
});

// 5. Save Credential
ipcMain.handle('save-credential', async (event, credential) => {
    if (!globalKey) {
        globalKey = deriveKey(DEFAULT_KEY_SOURCE, DEFAULT_SALT);
    }

    // Read existing
    let list = [];
    if (fs.existsSync(CREDENTIALS_FILE)) {
        const c = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const j = decrypt(c, globalKey);
        if (j) list = JSON.parse(j);
    }

    const existingIndex = list.findIndex(x => x.id === credential.id);
    if (existingIndex >= 0) {
        list[existingIndex] = credential;
    } else {
        list.push(credential);
    }

    const enc = encrypt(JSON.stringify(list), globalKey);
    fs.writeFileSync(CREDENTIALS_FILE, enc);
    return { success: true, list };
});

// 6. Delete Credential
ipcMain.handle('delete-credential', async (event, id) => {
    if (!globalKey) {
        globalKey = deriveKey(DEFAULT_KEY_SOURCE, DEFAULT_SALT);
    }

    let list = [];
    if (fs.existsSync(CREDENTIALS_FILE)) {
        const c = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const j = decrypt(c, globalKey);
        if (j) list = JSON.parse(j);
    }

    list = list.filter(item => item.id !== id);
    const enc = encrypt(JSON.stringify(list), globalKey);
    fs.writeFileSync(CREDENTIALS_FILE, enc);
    return list;
});

// Import/Export Credentials
ipcMain.handle('export-credentials', async () => {
    if (!globalKey) {
        globalKey = deriveKey(DEFAULT_KEY_SOURCE, DEFAULT_SALT);
    }

    let list = [];
    if (fs.existsSync(CREDENTIALS_FILE)) {
        const c = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        const j = decrypt(c, globalKey);
        if (j) list = JSON.parse(j);
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const defaultFileName = `ssh-backup-${dd}-${mm}-${yyyy}.ssh`;

    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export SSH Connections Backup',
        defaultPath: defaultFileName,
        filters: [
            { name: 'SSH Backup (*.ssh)', extensions: ['ssh'] }
        ]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, reason: 'canceled' };
    }

    try {
        const content = JSON.stringify(list, null, 4);
        fs.writeFileSync(result.filePath, content, 'utf8');
        return { success: true };
    } catch (e) {
        console.error('Export failed:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('import-credentials', async () => {
    if (!globalKey) {
        globalKey = deriveKey(DEFAULT_KEY_SOURCE, DEFAULT_SALT);
    }

    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Import SSH Connections Backup',
        filters: [
            { name: 'SSH Backup (*.ssh)', extensions: ['ssh'] }
        ],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, reason: 'canceled' };
    }

    try {
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf8');
        const importedList = JSON.parse(content);

        if (!Array.isArray(importedList)) {
            return { success: false, error: 'Backup file must contain an array of connections.' };
        }

        // Validate structure
        for (const item of importedList) {
            if (!item.host || !item.username) {
                return { success: false, error: 'Invalid backup format: connections must include host and username.' };
            }
        }

        // Read existing connections
        let existingList = [];
        if (fs.existsSync(CREDENTIALS_FILE)) {
            const c = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
            const j = decrypt(c, globalKey);
            if (j) existingList = JSON.parse(j);
        }

        // Set of existing labels and hosts (for unlabeled items)
        const existingLabels = new Set(
            existingList
                .map(item => (item.label || '').trim().toLowerCase())
                .filter(l => l !== '')
        );
        const existingHostsNoLabel = new Set(
            existingList
                .filter(item => !(item.label || '').trim())
                .map(item => (item.host || '').trim().toLowerCase())
        );

        let importedCount = 0;
        importedList.forEach(item => {
            const label = (item.label || '').trim().toLowerCase();
            const host = (item.host || '').trim().toLowerCase();
            
            let isDuplicate = false;
            if (label) {
                if (existingLabels.has(label)) {
                    isDuplicate = true;
                }
            } else if (host) {
                if (existingHostsNoLabel.has(host)) {
                    isDuplicate = true;
                }
            }
            
            if (!isDuplicate) {
                const newItem = {
                    id: item.id || uuidv4(),
                    label: item.label || '',
                    host: item.host,
                    username: item.username,
                    port: item.port || '22',
                    password: item.password || '',
                    remotePath: item.remotePath || '',
                    command: item.command || '',
                    tags: Array.isArray(item.tags) ? item.tags : []
                };
                existingList.push(newItem);
                if (label) {
                    existingLabels.add(label);
                } else if (host) {
                    existingHostsNoLabel.add(host);
                }
                importedCount++;
            }
        });

        const enc = encrypt(JSON.stringify(existingList), globalKey);
        fs.writeFileSync(CREDENTIALS_FILE, enc);

        return {
            success: true,
            list: existingList,
            importedCount,
            skippedCount: importedList.length - importedCount
        };
    } catch (e) {
        console.error('Import failed:', e);
        return { success: false, error: e.message || 'Failed to parse JSON file' };
    }
});

// 7. Launch SSH
ipcMain.handle('launch-ssh', async (event, { username, host, port, password, remotePath, command }) => {
    const p = port || 22;

    // ==========================================
    // macOS Platform Handling
    // ==========================================
    if (process.platform === 'darwin') {
        const knownHostsOption = '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';

        if (!password && !remotePath && !command) {
            const appleScript = `tell application "Terminal"
    activate
    do script "ssh ${knownHostsOption} ${username}@${host} -p ${p}"
end tell`;
            exec(`osascript -e ${JSON.stringify(appleScript)}`, (error) => {
                if (error) console.error(`macOS Terminal error: ${error}`);
            });
            return true;
        }

        // Automated login using macOS expect and Terminal.app (.command executable script)
        const scriptPath = path.join(app.getPath('temp'), `ssh_login_${Date.now()}.command`);
        // Escape special characters for Tcl/Expect: backslash, quotes, $, and brackets
        const escapeExpect = (str) => {
            if (!str) return '';
            let out = '';
            for (let i = 0; i < str.length; i++) {
                const c = str[i];
                if (c === '\\' || c === '"' || c === '$' || c === '[' || c === ']') {
                    out += '\\' + c;
                } else {
                    out += c;
                }
            }
            return out;
        };

        const safePass = escapeExpect(password);
        const safePath = escapeExpect(remotePath);
        const safeCmd = escapeExpect(command);

        let expectScript = '#!/usr/bin/expect -f\n';
        expectScript += 'set timeout 30\n';
        expectScript += `spawn ssh ${knownHostsOption} ${username}@${host} -p ${p}\n`;
        expectScript += 'expect {\n';
        expectScript += '    -nocase "are you sure you want to continue connecting" {\n';
        expectScript += '        send "yes\\r"\n';
        expectScript += '        exp_continue\n';
        expectScript += '    }\n';
        if (password) {
            expectScript += '    -nocase "password:" {\n';
            expectScript += `        send "${safePass}\\r"\n`;
            expectScript += '    }\n';
            expectScript += '    -nocase "password for" {\n';
            expectScript += `        send "${safePass}\\r"\n`;
            expectScript += '    }\n';
        }
        expectScript += '    timeout {\n';
        expectScript += '        send_user "\\n[Connection timeout]\\n"\n';
        expectScript += '        interact\n';
        expectScript += '        exit\n';
        expectScript += '    }\n';
        expectScript += '    eof {\n';
        expectScript += '        send_user "\\n[Connection closed]\\n"\n';
        expectScript += '        exit\n';
        expectScript += '    }\n';
        expectScript += '}\n';

        if (remotePath || command) {
            expectScript += 'set timeout 8\n';
            expectScript += 'expect {\n';
            expectScript += '    -re {[$#%>] ?} { }\n';
            expectScript += '    timeout { }\n';
            expectScript += '}\n';
            if (remotePath) {
                expectScript += `send "cd \\"${safePath}\\" && clear\\r"\n`;
            }
            if (command) {
                expectScript += `send "${safeCmd}\\r"\n`;
            }
        }
        expectScript += 'interact\n\n';

        try {
            fs.writeFileSync(scriptPath, expectScript, { mode: 0o755 });
            exec(`open "${scriptPath}"`, (error) => {
                if (error) console.error(`macOS open error: ${error}`);
                setTimeout(() => {
                    if (fs.existsSync(scriptPath)) {
                        try { fs.unlinkSync(scriptPath); } catch (e) {}
                    }
                }, 25000);
            });
            return true;
        } catch (err) {
            console.error("Failed to run macOS SSH script:", err);
            return false;
        }
    }

    // ==========================================
    // Windows Platform Handling
    // ==========================================
    const tempTitle = `SSH_LOGIN_${Date.now()}`;

    // Common SSH options to ensure a smooth, unattended connection
    const sshOptions = '-o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL';

    if (!password && !remotePath && !command) {
        // Simple case: no automation needed
        // We use cmd /k for the simple case so the window stays open to show errors if the connection fails.
        const cmd = `cmd /c start "${host}" cmd /k "title ${host} & ssh ${sshOptions} ${username}@${host} -p ${p}"`;
        exec(cmd, (error) => {
            if (error) console.error(`exec error: ${error}`);
        });
        return true;
    }

    // --- Automation case (Password/Path/Command) ---

    // Escape characters for VBScript SendKeys
    const escapeSendKeys = (text) => {
        if (!text) return "";
        // SendKeys special characters: + ^ % ~ ( ) { } [ ]
        return text.replace(/([+^%~(){}[\]])/g, '{$1}').replace(/"/g, '""');
    };

    const safePassword = escapeSendKeys(password);
    const safePath = escapeSendKeys(remotePath);
    const safeCommand = escapeSendKeys(command);
    
    // Path for VBScript
    const vbsPath = path.join(app.getPath('temp'), `ssh_login_${Date.now()}.vbs`);

    // VBScript content
    // We set the title using the 'title' command inside the same cmd process that runs ssh.
    // Added "|| pause" to prevent the window from closing automatically if SSH fails.
    let vbsContent = `
Set WshShell = WScript.CreateObject("WScript.Shell")
' Launch cmd, set its title, and then run SSH. Added pause on error.
WshShell.Run "cmd /c title ${tempTitle} & ssh ${sshOptions} ""${username}@${host}"" -p ${p} || pause", 1, False

Success = False
' Wait up to 10 seconds for the window to appear
For i = 1 to 100
    If WshShell.AppActivate("${tempTitle}") Then
        Success = True
        Exit For
    End If
    WScript.Sleep 100
Next

If Success Then
    ' Give SSH a moment to initialize and show password prompt
    WScript.Sleep 2000
    `.trim();

    if (password) {
        vbsContent += `
    ' Send Password
    WshShell.SendKeys "${safePassword}"
    WshShell.SendKeys "{ENTER}"
    ' Wait for shell to be ready after login
    WScript.Sleep 1500
    `;
    }

    if (remotePath) {
        vbsContent += `
    ' Send CD Command
    WshShell.SendKeys "cd ""${safePath}"" && clear"
    WshShell.SendKeys "{ENTER}"
    `;
    }

    if (command) {
        vbsContent += `
    ' Send Custom Command
    WshShell.SendKeys "${safeCommand}"
    WshShell.SendKeys "{ENTER}"
    `;
    }

    vbsContent += `
Else
    MsgBox "Could not find the terminal window with title: " & "${tempTitle}", 16, "SSH Access Error"
End If
    `;

    try {
        fs.writeFileSync(vbsPath, vbsContent);
        // Using "cscript" ensures the VBScript runs
        exec(`cscript //Nologo "${vbsPath}"`, (error) => {
            if (error) console.error(`VBS execution error: ${error}`);
            // Clean up later
            setTimeout(() => {
                if (fs.existsSync(vbsPath)) {
                    try { fs.unlinkSync(vbsPath); } catch(e) {}
                }
            }, 15000);
        });
    } catch (e) {
        console.error("Failed to create/run VBS automation:", e);
        return false;
    }

    return true;
});
