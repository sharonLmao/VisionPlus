const { app, BrowserWindow, screen, ipcMain, powerSaveBlocker } = require('electron');
const path = require('path');
const sound = require('sound-play');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const id = powerSaveBlocker.start('prevent-app-suspension');
console.log("prevent-app-suspension?", powerSaveBlocker.isStarted(id));

const windowWidth = 32;
const windowHeight = 32;
let volume = 0.5;
let mouse_win, face_detector_win;
let screen_real_width, screen_real_height;
let screen_hz, refresh_speed, move_speed;
let current_x, current_y;
let muted = false;

function moveMouse() {
    if (current_x < 0) current_x = 0;
    if (current_y < 0) current_y = 0;
    if (current_x > screen_real_width - windowWidth) current_x = screen_real_width - windowWidth;
    if (current_y > screen_real_height - windowWidth) current_y = screen_real_height - windowWidth;
    mouse_win.setPosition(Math.floor(current_x), Math.floor(current_y));
}

async function playSound(file) {
    if (muted) return;
    try {
        await sound.play(path.join(__dirname, file), volume);
        // console.log("Play", file)
    } catch(e) {
        console.log("Error playing file", file, e)
    }
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
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
            backgroundThrottling: false,
        }
    });
    mouse_win.webContents.setBackgroundThrottling(false);
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
    playSound('sounds/Loading.mp3');
    ipcMain.on('mute', async (event, data) => {
        await playSound('sounds/Muted.mp3');
        muted = true;
    });
    ipcMain.on('unmute', async (event, data) => {
        muted = false;
        await playSound('sounds/Unmuted.mp3');
    });
    ipcMain.on('loaded', (event, data) => {
        playSound('sounds/Loaded.mp3');
    });
    ipcMain.on('webcam_active', (event, data) => {
        playSound('sounds/Active.mp3');
    });
    ipcMain.on('error', (event, data) => {
        playSound('sounds/Error.mp3');
    });
    ipcMain.on('center', (event, data) => {
        playSound('sounds/Center.mp3');
        current_x = Math.floor((screen_real_width - windowWidth) / 2);
        current_y = Math.floor((screen_real_height - windowHeight) / 2);
    });
    ipcMain.on('Play', (event, data) => {
        playSound('sounds/' + data + '.mp3');
    });
    // let is_mouse_down = false;
    ipcMain.on('face-detection', (event, data) => {
        // console.log("incoming face detection", data);
        // data.everything
        // data.flags
        // screen_real_width // 1920
        // screen_real_height // 1080
        /* 0.0000 - 1.0
        //------- width=left+right
        // // right
        // eyeLookOutRight
        // // left
        // eyeLookInRight
        //------- height=up+down
        // // up
        // eyeLookUpLeft
        // eyeLookUpRight
        // // down
        // eyeLookDownLeft
        // eyeLookDownRight
        -------- Math shit:
        To convert the outputs from your eye tracking algorithm to the mouse x and y position on the screen, you can use the following approach:
        Normalize the values of your eye tracking variables so that they range from -1 to 1. This will ensure that the maximum movement corresponds to the edges of the screen.
        Scale the normalized values by the screen width and height to get the displacement in pixels.
        Add the displacement to the current mouse position to get the new mouse position.
        */
        // Calculate center point
        const center_x = screen_real_width / 2;
        const center_y = screen_real_height / 2;
        // Normalize values
        const normalized_x = (data.flags.rightVector * data.flags.right_speed) - (data.flags.leftVector * data.flags.left_speed);
        const normalized_y = (data.flags.downVector * data.flags.down_speed) - (data.flags.upVector * data.flags.up_speed);
        // Scale by screen dimensions
        const pixel_displacement_x = normalized_x * center_x;
        const pixel_displacement_y = normalized_y * center_y;
        // Calculate new mouse position
        current_x = center_x + pixel_displacement_x + data.flags.x_offset;
        current_y = center_y + pixel_displacement_y + data.flags.y_offset;
        console.log("New Mouse Position (x, y):", {current_x, current_y}, {screen_real_width, screen_real_height, center_x, center_y, pixel_displacement_x, pixel_displacement_y, normalized_x, normalized_y}, data.flags);
        // current_x += data.x;
        // current_y += data.y;
        // if (data.puck) { // pucking with mouth...
        //     if (!is_mouse_down) {
        //         is_mouse_down = true;
        //         // optionally do extra work with data.puck_vector
        //         // api to click mouse down on data.x data.y in the background
        //         playSound('sounds/MouseDown.mp3');
        //     }
        // } else { // stopped pucking with mouth...
        //     if (is_mouse_down) {
        //         is_mouse_down = false;
        //         // api to release mouse up
        //         playSound('sounds/MouseUp.mp3');
        //     }
        // }
        // Handle the face detection outputs here
        // moveMouse(data.x, data.y);
    });
}

function createFaceDetector() {
    face_detector_win = new BrowserWindow({
        width: 1524,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    face_detector_win.webContents.setBackgroundThrottling(false);
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
