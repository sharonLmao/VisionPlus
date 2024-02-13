// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;
const mainSection = document.getElementById("main");
const imageBlendShapes = document.getElementById("image-blend-shapes");
const videoBlendShapes = document.getElementById("video-blend-shapes");
let faceLandmarker;
let runningMode = "IMAGE";
// let enableWebcamButton;
let webcamRunning = false;
const videoWidth = 480;
// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function createFaceLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode,
        numFaces: 1
    });
    mainSection.classList.remove("invisible");
    window.electronAPI.send('loaded', 'ok');
}
createFaceLandmarker();
/********************************************************************
// Demo 1: Grab a bunch of images from the page and detection them
// upon click.
********************************************************************/
// In this demo, we have put all our clickable images in divs with the
// CSS class 'detectionOnClick'. Lets get all the elements that have
// this class.
const imageContainers = document.getElementsByClassName("detectOnClick");
// Now let's go through all of these and add a click event listener.
for (let imageContainer of imageContainers) {
    // Add event listener to the child element whichis the img element.
    imageContainer.children[0].addEventListener("click", handleClick);
}
// When an image is clicked, let's detect it and display results!
async function handleClick(event) {
    if (!faceLandmarker) {
        // console.log("Wait for faceLandmarker to load before clicking!");
        return;
    }
    if (runningMode === "VIDEO") {
        runningMode = "IMAGE";
        await faceLandmarker.setOptions({ runningMode });
    }
    // Remove all landmarks drawed before
    const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
    for (var i = allCanvas.length - 1; i >= 0; i--) {
        const n = allCanvas[i];
        n.parentNode.removeChild(n);
    }
    // We can call faceLandmarker.detect as many times as we like with
    // different image data each time. This returns a promise
    // which we wait to complete and then call a function to
    // print out the results of the prediction.
    const faceLandmarkerResult = faceLandmarker.detect(event.target);
    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "canvas");
    canvas.setAttribute("width", event.target.naturalWidth + "px");
    canvas.setAttribute("height", event.target.naturalHeight + "px");
    canvas.style.left = "0px";
    canvas.style.top = "0px";
    canvas.style.width = `${event.target.width}px`;
    canvas.style.height = `${event.target.height}px`;
    event.target.parentNode.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx);
    for (const landmarks of faceLandmarkerResult.faceLandmarks) {
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
            color: "#E0E0E0"
        });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
        drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
    }
    drawBlendShapes(imageBlendShapes, faceLandmarkerResult.faceBlendshapes);
}
/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
// Check if webcam access is supported.
// function hasGetUserMedia() {
//     return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
// }
// If webcam supported, add event listener to button for when user
// wants to activate it.
// if (hasGetUserMedia()) {
//     enableWebcamButton = document.getElementById("webcamButton");
//     enableWebcamButton.addEventListener("click", function () {
//         enableCam(document.getElementById('cameraSelect').value);
//     });
// }
// else {
//     console.warn("getUserMedia() is not supported by your browser");
// }
// Enable the live webcam view and start detection.
function enableCam(deviceId, stayOnline = false) {
    if (!faceLandmarker) {
        // console.log("Wait! faceLandmarker not loaded yet.");
        return;
    }
    if (stayOnline && webcamRunning) webcamRunning = false;
    setTimeout(function () {
        if (webcamRunning === true && !stayOnline) {
            webcamRunning = false;
            // enableWebcamButton.innerText = "ENABLE PREDICTIONS";
        }
        else {
            webcamRunning = true;
            // enableWebcamButton.innerText = "DISABLE PREDICTIONS";
        }
        // getUsermedia parameters.
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                zoom: true
            }
        };
        // Activate the webcam stream.
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
            setTimeout(() => window.electronAPI.send('webcam_active', 'ok'), 1000);
            const [track] = stream.getVideoTracks();
            const capabilities = track.getCapabilities();
            const settings = track.getSettings();
            const zoom_webcam = document.getElementById('zoom_webcam');
            const zoom_webcam_input = document.getElementById('zoom_webcam_input');
            // Check whether zoom is supported or not.
            if (!('zoom' in settings)) return document.getElementById('zoom_webcam_error').textContent = 'Zoom is not supported by ' + track.label;
            // Map zoom to a slider element.
            zoom_webcam.min = capabilities.zoom.min;
            zoom_webcam_input.min = capabilities.zoom.min;
            zoom_webcam.max = capabilities.zoom.max;
            zoom_webcam_input.max = capabilities.zoom.max;
            zoom_webcam.step = capabilities.zoom.step;
            zoom_webcam_input.step = capabilities.zoom.step;
            zoom_webcam.value = settings.zoom;
            zoom_webcam_input.value = settings.zoom;
            zoom_webcam.onchange = function(event) {
              track.applyConstraints({advanced: [ {zoom: event.target.value} ]});
            }
            zoom_webcam_input.onchange = function(event) {
              track.applyConstraints({advanced: [ {zoom: event.target.value} ]});
            }
            zoom_webcam.hidden = false;
            zoom_webcam_input.hidden = false;
            zoom_webcam.disabled = false;
            zoom_webcam_input.disabled = false;
        }).catch((e) => {
            console.error("Webcam Error:", e);
            alert("Webcam Error:\n" + e.message);
            window.electronAPI.send('error', 'ok');
        });
    }, 16);
}
window.enableCam = enableCam;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);
async function predictWebcam() {
    const radio = video.videoHeight / video.videoWidth;
    video.style.width = videoWidth + "px";
    video.style.height = videoWidth * radio + "px";
    canvasElement.style.width = videoWidth + "px";
    canvasElement.style.height = videoWidth * radio + "px";
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode: runningMode });
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, startTimeMs);
    }
    if (results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
        }
    }
    drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
// let isUpGlobal = false;
// let isDownGlobal = false;
// let isLeftGlobal = false;
// let isRightGlobal = false;
let isBrowUpGlobal = false;
let isJawOpenGlobal = false;
function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
        return;
    }
    // console.log(blendShapes[0]);
    // Send to backend
    const categories = {};
    categories._neutral = blendShapes[0].categories[0];
    categories.browDownLeft = blendShapes[0].categories[1];
    categories.browDownRight = blendShapes[0].categories[2];
    categories.browInnerUp = blendShapes[0].categories[3];
    categories.browOuterUpLeft = blendShapes[0].categories[4];
    categories.browOuterUpRight = blendShapes[0].categories[5];
    categories.cheekPuff = blendShapes[0].categories[6];
    categories.cheekSquintLeft = blendShapes[0].categories[7];
    categories.cheekSquintRight = blendShapes[0].categories[8];
    categories.eyeBlinkLeft = blendShapes[0].categories[9];
    categories.eyeBlinkRight = blendShapes[0].categories[10];
    categories.eyeLookDownLeft = blendShapes[0].categories[11];
    categories.eyeLookDownRight = blendShapes[0].categories[12];
    categories.eyeLookInLeft = blendShapes[0].categories[13];
    categories.eyeLookInRight = blendShapes[0].categories[14];
    categories.eyeLookOutLeft = blendShapes[0].categories[15];
    categories.eyeLookOutRight = blendShapes[0].categories[16];
    categories.eyeLookUpLeft = blendShapes[0].categories[17];
    categories.eyeLookUpRight = blendShapes[0].categories[18];
    categories.eyeSquintLeft = blendShapes[0].categories[19];
    categories.eyeSquintRight = blendShapes[0].categories[20];
    categories.eyeWideLeft = blendShapes[0].categories[21];
    categories.eyeWideRight = blendShapes[0].categories[22];
    categories.jawForward = blendShapes[0].categories[23];
    categories.jawLeft = blendShapes[0].categories[24];
    categories.jawOpen = blendShapes[0].categories[25];
    categories.jawRight = blendShapes[0].categories[26];
    categories.mouthClose = blendShapes[0].categories[27];
    categories.mouthDimpleLeft = blendShapes[0].categories[28];
    categories.mouthDimpleRight = blendShapes[0].categories[29];
    categories.mouthFrownLeft = blendShapes[0].categories[30];
    categories.mouthFrownRight = blendShapes[0].categories[31];
    categories.mouthFunnel = blendShapes[0].categories[32];
    categories.mouthLeft = blendShapes[0].categories[33];
    categories.mouthLowerDownLeft = blendShapes[0].categories[34];
    categories.mouthLowerDownRight = blendShapes[0].categories[35];
    categories.mouthPressLeft = blendShapes[0].categories[36];
    categories.mouthPressRight = blendShapes[0].categories[37];
    categories.mouthPucker = blendShapes[0].categories[38];
    categories.mouthRight = blendShapes[0].categories[39];
    categories.mouthRollLower = blendShapes[0].categories[40];
    categories.mouthRollUpper = blendShapes[0].categories[41];
    categories.mouthShrugLower = blendShapes[0].categories[42];
    categories.mouthShrugUpper = blendShapes[0].categories[43];
    categories.mouthSmileLeft = blendShapes[0].categories[44];
    categories.mouthSmileRight = blendShapes[0].categories[45];
    categories.mouthStretchLeft = blendShapes[0].categories[46];
    categories.mouthStretchRight = blendShapes[0].categories[47];
    categories.mouthUpperUpLeft = blendShapes[0].categories[48];
    categories.mouthUpperUpRight = blendShapes[0].categories[49];
    categories.noseSneerLeft = blendShapes[0].categories[50];
    categories.noseSneerRight = blendShapes[0].categories[51];
    // up
    let isMovingUp = (categories.eyeLookUpLeft.score >= window.up_threshold && categories.eyeLookUpRight.score >= window.up_threshold);
    let upVector = (categories.eyeLookUpLeft.score + categories.eyeLookUpRight.score) / 2;
    // if (isMovingUp) {
    //     if (!isUpGlobal) {
    //         isUpGlobal = true;
    //         window.electronAPI.send('Play', 'Up');
    //     }
    // } else {
    //     if (isUpGlobal) {
    //         isUpGlobal = false;
    //     }
    // }
    // down
    let isMovingDown = (categories.eyeLookDownLeft.score >= window.down_threshold && categories.eyeLookDownRight.score >= window.down_threshold);
    let downVector = (categories.eyeLookDownLeft.score + categories.eyeLookDownRight.score) / 2;
    // if (isMovingDown) {
    //     if (!isDownGlobal) {
    //         isDownGlobal = true;
    //         window.electronAPI.send('Play', 'Down');
    //     }
    // } else {
    //     if (isDownGlobal) {
    //         isDownGlobal = false;
    //     }
    // }
    // right
    let isMovingRight = categories.eyeLookOutRight.score >= window.right_threshold;
    let rightVector = categories.eyeLookOutRight.score;
    // if (isMovingRight) {
    //     if (!isRightGlobal) {
    //         isRightGlobal = true;
    //         window.electronAPI.send('Play', 'Right');
    //     }
    // } else {
    //     if (isRightGlobal) {
    //         isRightGlobal = false;
    //     }
    // }
    // left
    let isMovingLeft = categories.eyeLookInRight.score >= window.left_threshold;
    let leftVector = categories.eyeLookInRight.score;
    // if (isMovingLeft) {
    //     if (!isLeftGlobal) {
    //         isLeftGlobal = true;
    //         window.electronAPI.send('Play', 'Left');
    //     }
    // } else {
    //     if (isLeftGlobal) {
    //         isLeftGlobal = false;
    //     }
    // }
    // brow
    let isBrowUp = categories.browInnerUp.score >= window.brow_threshold;
    let browVector = categories.browInnerUp.score;
    if (isBrowUp) {
        if (!isBrowUpGlobal) {
            isBrowUpGlobal = true;
            window.electronAPI.send('Play', 'BrowUp');
        }
    } else {
        if (isBrowUpGlobal) {
            isBrowUpGlobal = false;
        }
    }
    // jaw
    let isJawOpen = categories.jawOpen.score >= window.jaw_threshold;
    let jawVector = categories.jawOpen.score;
    if (isJawOpen) {
        if (!isJawOpenGlobal) {
            isJawOpenGlobal = true;
            window.electronAPI.send('Play', 'JawOpen');
        }
    } else {
        if (isJawOpenGlobal) {
            isJawOpenGlobal = false;
        }
    }
    // mouth - MouseDownMouseUp
    let isMouthPuck = categories.mouthPucker.score >= window.mouth_threshold;
    let mouthVector = categories.mouthPucker.score;

    // let title = '';
    // if (isMovingDown) {
    //     // console.log("Down", downVector);
    //     title += ' - Down';
    // } else if (isMovingUp) {
    //     // console.log("Up", upVector);
    //     title += ' - Up';
    // }
    // if (isMovingRight) {
    //     // console.log("Right", rightVector);
    //     title += ' - Right';
    // } else if (isMovingLeft) {
    //     // console.log("Left", leftVector);
    //     title += ' - Left';
    // }
    // if (isBrowUp) {
    //     // console.log("Right", rightVector);
    //     title += ' - BrowUp';
    // }
    // if (isJawOpen) {
    //     // console.log("Right", rightVector);
    //     title += ' - JawOpen(SLOW)';
    // }
    // if (isMouthPuck) {
    //     // console.log("Right", rightVector);
    //     title += ' - MouthPuck';
    // }

    // document.title = title;

    window.requestAnimationFrame(function () {
        // const right_left_speed = isMovingRight ? window.right_speed : isMovingLeft ? window.left_speed : 0;
        // const up_down_speed = isMovingDown ? window.down_speed : isMovingUp ? window.up_speed : 0;
        window.electronAPI.send('face-detection', {
            // x: (isMovingRight ? rightVector : isMovingLeft ? leftVector : 0) * (isJawOpen ? right_left_speed * window.r_l_speed_reducer / 100 : right_left_speed),
            // y: (isMovingDown ? downVector : isMovingUp ? upVector : 0) * (isJawOpen ? up_down_speed * window.u_d_speed_reducer / 100 : up_down_speed),
            // puck: isMouthPuck,
            // puck_vector: mouthVector,
            flags: {
                right_speed: window.right_speed,
                down_speed: window.down_speed,
                left_speed: window.left_speed,
                up_speed: window.up_speed,
                x_offset: window.x_offset,
                y_offset: window.y_offset,
                // isMovingRight,
                rightVector,
                //
                // isMovingDown,
                downVector,
                //
                // isMovingUp,
                upVector,
                //
                // isMovingLeft,
                leftVector,
                //
                // isJawOpen,
                // jawVector,
                // //
                // isBrowUp,
                // browVector,
                // //
                // isMouthPuck,
                // mouthVector,
            },
            // everything: {
            //     _neutral,
            //     browDownLeft,
            //     browDownRight,
            //     browInnerUp,
            //     browOuterUpLeft,
            //     browOuterUpRight,
            //     cheekPuff,
            //     cheekSquintLeft,
            //     cheekSquintRight,
            //     eyeBlinkLeft,
            //     eyeBlinkRight,
            //     eyeLookDownLeft,
            //     eyeLookDownRight,
            //     eyeLookInLeft,
            //     eyeLookInRight,
            //     eyeLookOutLeft,
            //     eyeLookOutRight,
            //     eyeLookUpLeft,
            //     eyeLookUpRight,
            //     eyeSquintLeft,
            //     eyeSquintRight,
            //     eyeWideLeft,
            //     eyeWideRight,
            //     jawForward,
            //     jawLeft,
            //     jawOpen,
            //     jawRight,
            //     mouthClose,
            //     mouthDimpleLeft,
            //     mouthDimpleRight,
            //     mouthFrownLeft,
            //     mouthFrownRight,
            //     mouthFunnel,
            //     mouthLeft,
            //     mouthLowerDownLeft,
            //     mouthLowerDownRight,
            //     mouthPressLeft,
            //     mouthPressRight,
            //     mouthPucker,
            //     mouthRight,
            //     mouthRollLower,
            //     mouthRollUpper,
            //     mouthShrugLower,
            //     mouthShrugUpper,
            //     mouthSmileLeft,
            //     mouthSmileRight,
            //     mouthStretchLeft,
            //     mouthStretchRight,
            //     mouthUpperUpLeft,
            //     mouthUpperUpRight,
            //     noseSneerLeft,
            //     noseSneerRight,
            // }
        });
    });
    // ------
    let htmlMaker = "";
    blendShapes[0].categories.map((shape) => {
        let isBold = '';
        let color = '';
        if (shape.categoryName == 'eyeLookUpLeft' ||
        shape.categoryName == 'eyeLookUpRight' ||
        shape.categoryName == 'eyeLookDownLeft' ||
        shape.categoryName == 'eyeLookDownRight' ||
        shape.categoryName == 'eyeLookOutRight' ||
        shape.categoryName == 'eyeLookInRight' ||
        shape.categoryName == 'browInnerUp' ||
        shape.categoryName == 'jawOpen' ||
        shape.categoryName == 'mouthPucker') isBold = 'font-weight:bold;';
        // up
        if (shape.categoryName == 'eyeLookUpLeft' ||
        shape.categoryName == 'eyeLookUpRight') color = 'green';
        // down
        if (shape.categoryName == 'eyeLookDownLeft' ||
        shape.categoryName == 'eyeLookDownRight') color = 'red';
        // right
        if (shape.categoryName == 'eyeLookOutRight') color = 'blue';
        // left
        if (shape.categoryName == 'eyeLookInRight') color = 'purple';
        // brow
        if (shape.categoryName == 'browInnerUp') color = 'brown';
        // jaw
        if (shape.categoryName == 'jawOpen') color = 'orange';
        // mouth
        if (shape.categoryName == 'mouthPucker') color = 'pink';
        //
        htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label" style="${isBold}color:${color};">${shape.displayName || shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${+shape.score * 100}% - 120px)">${(+shape.score).toFixed(4)}</span>
      </li>
    `;
    });
    el.innerHTML = `
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:green;">isMovingUp: ${isMovingUp}</span>
      <span class="blend-shapes-value" style="width: calc(${+upVector * 100}% - 120px)">${(+upVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:red;">isMovingDown: ${isMovingDown}</span>
      <span class="blend-shapes-value" style="width: calc(${+downVector * 100}% - 120px)">${(+downVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:blue;">isMovingRight: ${isMovingRight}</span>
      <span class="blend-shapes-value" style="width: calc(${+rightVector * 100}% - 120px)">${(+rightVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:purple;">isMovingLeft: ${isMovingLeft}</span>
      <span class="blend-shapes-value" style="width: calc(${+leftVector * 100}% - 120px)">${(+leftVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:brown;">isBrowUp: ${isBrowUp}</span>
      <span class="blend-shapes-value" style="width: calc(${+browVector * 100}% - 120px)">${(+browVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:orange;">isJawOpen: ${isJawOpen}</span>
      <span class="blend-shapes-value" style="width: calc(${+jawVector * 100}% - 120px)">${(+jawVector).toFixed(4)}</span>
    </li>
    <li class="blend-shapes-item">
      <span class="blend-shapes-label" style="color:pink;">isMouthPuck: ${isMouthPuck}</span>
      <span class="blend-shapes-value" style="width: calc(${+mouthVector * 100}% - 120px)">${(+mouthVector).toFixed(4)}</span>
    </li>` + htmlMaker;
}