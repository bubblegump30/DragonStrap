Option Explicit

Dim shell, fso, scriptDir, rootDir, electronExe
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
electronExe = fso.BuildPath(rootDir, "node_modules\electron\dist\electron.exe")

If Not fso.FileExists(electronExe) Then
    MsgBox "DragonStrap dependencies are not installed." & vbCrLf & vbCrLf & _
           "Open PowerShell in the DragonStrap folder and run: npm install", _
           vbExclamation, "DragonStrap"
    WScript.Quit 1
End If

' Launch Electron directly. WScript has no console window, so DragonStrap opens cleanly.
shell.Run Chr(34) & electronExe & Chr(34) & " " & Chr(34) & rootDir & Chr(34), 1, False
WScript.Quit 0
