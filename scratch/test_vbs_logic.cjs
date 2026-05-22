const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock data
const username = 'testuser';
const host = 'localhost';
const p = 22;
const tempTitle = `TEST_SSH_LOGIN_${Date.now()}`;
const vbsPath = path.join(os.tmpdir(), `test_ssh_login_${Date.now()}.vbs`);

let vbsContent = `
Set WshShell = WScript.CreateObject("WScript.Shell")
' Launch cmd which then starts a dummy task in a new window with a specific title
WshShell.Run "cmd /c start """ & "${tempTitle}" & """ cmd /k echo Hello from Test script", 1, False

Success = False
' Wait up to 5 seconds for the window to appear
For i = 1 to 50
    If WshShell.AppActivate("${tempTitle}") Then
        Success = True
        Exit For
    End If
    WScript.Sleep 100
Next

If Success Then
    WScript.Sleep 1000
    WshShell.SendKeys "echo Automation worked{ENTER}"
Else
    WScript.Echo "Could not find window"
End If
`.trim();

fs.writeFileSync(vbsPath, vbsContent);
console.log(`Running VBScript: ${vbsPath}`);

exec(`cscript //Nologo "${vbsPath}"`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error}`);
        return;
    }
    console.log(`STDOUT: ${stdout}`);
    console.log(`STDERR: ${stderr}`);
    // fs.unlinkSync(vbsPath);
});
