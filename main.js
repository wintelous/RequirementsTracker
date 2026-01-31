const { app, BrowserWindow } = require("electron");
const path = require("path");
const { startServer } = require("./server");

let mainWindow;
let server;

app.setName("Requirements Tracker");
app.name = "Requirements Tracker";

function createWindow(port) {
  const appVersion = app.getVersion();
  const iconPath = path.join(app.isPackaged ? app.getAppPath() : __dirname, "icon.png");
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    title: `Requirements Tracker v${appVersion}`,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(`Requirements Tracker v${appVersion}`);
  });

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    app.quit();
  });
}

app.whenReady().then(async () => {
  try {
    app.setName("Requirements Tracker");
    server = await startServer();
    createWindow(server.port);
  } catch (err) {
    console.error("Failed to start server:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("quit", () => {
  if (server && server.close) {
    server.close();
  }
});
