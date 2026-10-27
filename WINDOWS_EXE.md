# Windows portable launch

1. Download `ASIC_ToolBox_v1.4.5_Windows_Portable.zip` and extract the **entire** folder to a location writable by your Windows account, such as Documents. Do not run the EXE from inside the ZIP.
2. Double-click `ASIC ToolBox.exe`. It starts the bundled local server and opens the application in your default browser. Node.js does not need to be installed separately.
3. Keep the launcher window open while using the application. Close it to stop the local server.

The application binds only to `127.0.0.1`. If the default local port is already occupied, the launcher checks the next ports up to 4199 and opens the browser at the selected port. If the application is already running on port 4180, the launcher opens that existing instance rather than starting a duplicate.

This is a portable package rather than a system installer: it does not require administrator permissions and does not create a Windows service. The complete folder must remain together because the EXE uses the included portable Node.js runtime and app files. Keep the folder writable so the application can save its data and settings.

The default web browser is used to display the existing ASIC ToolBox interface. Scanner network traffic is initiated by the local server using the configured API ports and credentials.


Version 1.4.5 can auto-detect Braiins OS via REST/gRPC and CGMiner-compatible firmware via TCP 4028. For stock/third-party firmware, the miner must expose read-only CGMiner API access to this computer; hashrate is displayed when reported by `summary` or `devs`. The port 4028 path is read-only.
