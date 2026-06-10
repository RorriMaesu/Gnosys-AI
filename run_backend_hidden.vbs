Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptPosition)
WshShell.Run Chr(34) & strPath & "\run_backend.bat" & Chr(34), 0, False
