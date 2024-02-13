const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const robot = require('@hurdlegroup/robotjs');
const sound = require('sound-play')

function playSound(file) {
    console.log("Play", file)
    sound.play(path.join(__dirname, file));
}

const windowWidth = 32;
const windowHeight = 32;
let mouse_win, face_detector_win;
let screen_real_width, screen_real_height;
let screen_hz, refresh_speed, move_speed;
let current_x, current_y;

function moveMouse() {
    if (current_x < 0) current_x = 0;
    if (current_y < 0) current_y = 0;
    if (current_x > screen_real_width - windowWidth) current_x = screen_real_width - windowWidth;
    if (current_y > screen_real_height - windowWidth) current_y = screen_real_height - windowWidth;
    mouse_win.setPosition(Math.floor(current_x), Math.floor(current_y));
}

function createMouse() {
    const primary_screen = screen.getPrimaryDisplay();
    const screen_size = primary_screen.size;
    screen_hz = primary_screen.displayFrequency;
    refresh_speed = 1000 / screen_hz;
    move_speed = Math.floor(refresh_speed);
    screen_real_width = screen_size.width;
    screen_real_height = screen_size.height;
    current_x = Math.floor((screen_real_width - windowWidth) / 2);
    current_y = Math.floor((screen_real_height - windowHeight) / 2);
    mouse_win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: current_x, // Initial X position at the center of the screen
        y: current_y, // Initial Y position at the center of the screen
        transparent: true,
        frame: false,
        alwaysOnTop: true, // Make window top-most
        backgroundColor: '#00FFFFFF', // Set background color with alpha for transparency
        // enableLargerThanScreen: true, // Allow the window to be larger than the screen
        hasShadow: false, // Optional: Disable window shadow for a clean look
        // skipTaskbar: true, // Optional: Remove from taskbar
        focusable: false, // Optional: Make window non-focusable
        // fullscreenable: false, // Optional: Make window non-fullscreenable
        // maximizable: false, // Optional: Make window non-maximizable
        // minimizable: false, // Optional: Make window non-minimizable
        // resizable: false, // Optional: Make window non-resizable
        // movable: false, // Optional: Make window non-movable
        webPreferences: {
            backgroundThrottling: false,
        }
    });
    // win.webContents.openDevTools(); // Uncomment if you want to open DevTools
    mouse_win.setIgnoreMouseEvents(true, { forward: true });  // Make window click-through
    mouse_win.loadURL(`file://${path.join(__dirname, 'web_ui/index.html')}`);
    mouse_win.on('closed', () => { // Dereference the window object, usually you would store windows in an array if your app supports multi windows, this is the time when you should delete the corresponding element.
        mouse_win = null;
    });
    setInterval(function () {
        mouse_win.focus();
        mouse_win.setAlwaysOnTop(true);
        mouse_win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mouse_win.setAlwaysOnTop(true, "floating");
        mouse_win.setFullScreenable(false);
        mouse_win.moveTop();
    }, 1000);
    // Auto move mouse where your eye is looking:
    setInterval(function () {
        moveMouse();
    }, refresh_speed);
    let is_mouse_down = false;
    playSound('sounds/Loading.mp3');
    ipcMain.on('loaded', (event, data) => {
        playSound('sounds/Loaded.mp3');
    });
    ipcMain.on('center', (event, data) => {
        playSound('sounds/Center.mp3');
        current_x = Math.floor((screen_real_width - windowWidth) / 2);
        current_y = Math.floor((screen_real_height - windowHeight) / 2);
    });
    ipcMain.on('Play', (event, data) => {
        playSound('sounds/' + data + '.mp3');
    });
    ipcMain.on('face-detection', (event, data) => {
        // console.log("incoming face detection", data);
        current_x += data.x;
        current_y += data.y;
        if (data.puck) { // pucking with mouth...
            if (!is_mouse_down) {
                is_mouse_down = true;
                // optionally do extra work with data.puck_vector
                // api to click mouse down on data.x data.y in the background
                // robot.moveMouseSmooth(current_x, current_y);
                // robot.mouseToggle("down");
                playSound('sounds/MouseDown.mp3');
            }
        } else { // stopped pucking with mouth...
            if (is_mouse_down) {
                is_mouse_down = false;
                // api to release mouse up
                // robot.mouseToggle("up");
                playSound('sounds/MouseUp.mp3');
            }
        }
        // console.log("new xy", {current_x, current_y})
        // Handle the face detection outputs here
        // moveMouse(data.x, data.y);
    });
}

function createFaceDetector() {
    face_detector_win = new BrowserWindow({
        width: 1524,
        height: 900,
        webPreferences: {
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    // face_detector_win.webContents.openDevTools(); // Uncomment if you want to open DevTools
    face_detector_win.loadURL(`file://${path.join(__dirname, 'web_ui/face_detection.html')}`);
    face_detector_win.on('closed', () => { // Dereference the window object, usually you would store windows in an array if your app supports multi windows, this is the time when you should delete the corresponding element.
        face_detector_win = null;
    });
    face_detector_win.maximize();
}

function createWindows() {
    createMouse();
    createFaceDetector();
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
