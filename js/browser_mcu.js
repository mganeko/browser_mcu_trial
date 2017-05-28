//
// Browser MCU
//

"use strict"

var BrowserMCU = function() {
    // --- for video mix ---
    const MAX_MEMBER_COUNT = 25;
    let remoteStreams = [];
    let remoteVideos = [];
    let mixStream = null;
    let videoContainer = null;

    const MIX_CAPTURE_FPS = 15;
    //const canvasMix = document.getElementById('canvas_mix');
    //const ctxMix = canvasMix.getContext('2d');
    //ctxMix.fillStyle = 'rgb(128, 128, 255)';
    let canvasMix = null;
    let ctxMix = null;
    let animationId = null;
    let keepAnimation = false;
    let mixWidth = 320;
    let mixHeight = 240;

    // -- for audio mix --
    const audioContext = new window.AudioContext();
    let inputNodes = [];
    let mixOutputNode = null;
    let audioMixStream = null;


    // --- init MCU ----
    this.setCanvas = function(canvas) {
        canvasMix = canvas;
        ctxMix = canvasMix.getContext('2d');
        ctxMix.fillStyle = 'rgb(128, 128, 255)';
        mixWidth = canvasMix.width;
        mixHeight = canvasMix.height;
    }

    this.setContainer = function(container) {
        videoContainer = container;
    }

    // --- start/stop Mix ----
    this.startMix = function() {
        mixStream = canvasMix.captureStream(MIX_CAPTURE_FPS);
        mixOutputNode = audioContext.createMediaStreamDestination();
        audioMixStream = mixOutputNode.stream;
        mixStream.addTrack(audioMixStream.getAudioTracks()[0]);

        animationId = window.requestAnimationFrame(_drawMixCanvas);
        keepAnimation = true;
        console.log('--start mix and capture stream--');
    }

    this.stopMix = function() {
        if (mixOutputNode) {
            // NG mixOutputNode.stop();
            audioMixStream = null;
            mixOutputNode = null;
        }

        if (mixStream) {
            _stopStream(mixStream);
            mixStream = null;
        }

        if (animationId) {
            window.cancelAnimationFrame(animationId);
            animationId = null;
        }
        keepAnimation = false;

        console.log('--stop mix and capture stream--');
    }

    function _stopStream(stream) {
        let tracks = stream.getTracks();
        if (! tracks) {
            console.warn('NO tracks');
            return;
        }
        
        for (let track of tracks) {
            track.stop();
        }
    }

    this.getMixStream = function() {
        return mixStream;
    }

    // ---- mix video ----
    function _clearMixCanvas() {
        ctxMix.fillRect(0, 0, mixWidth, mixHeight);
    }

    function _drawMixCanvas() {
        //console.log('--drawMixCanvas--');
        let i = 0;
        for(let key in remoteVideos) {
            let video = remoteVideos[key];
            _drawVideoGrid(video, i, horzCount, vertCount);
            i++;
        }

        if (keepAnimation) {
            window.requestAnimationFrame(_drawMixCanvas);
        }
    }

    function _drawVideoGrid(videoElement, index, horzCount, vertCount) {
        const destLeft = gridWidth * (index % horzCount); 
        const destTop = gridHeight * Math.floor(index / horzCount);

        _drawVideoGridWithClop(ctxMix, videoElement, destLeft, destTop, gridWidth, gridHeight);
    }

    function _drawVideoGridWithClop(ctx, video, destLeft, destTop, gridWidth, gridHeight) {
        // === make 4:3 area ====
        const horzUnit = video.videoWidth / 4;
        const vertUnit = video.videoHeight / 3;
        let unit = 240;

        if (horzUnit > vertUnit) {
            // -- landscape, so clip side --
            unit = vertUnit;
        }
        else {
            // --- portrait, so cut top/bottom -- 
            unit = horzUnit;
        }

        const srcWidth = unit * 4;
        const srcHeight = unit * 3;
        const xCenter = video.videoWidth / 2;
        const yCenter =  video.videoHeight / 2;
        const srcLeft = xCenter - (srcWidth /2);
        const srcTop = yCenter - (srcHeight /2);

        ctx.drawImage(video, srcLeft, srcTop, srcWidth, srcHeight,
            destLeft, destTop, gridWidth, gridHeight
        );
    }

    // ---- matrix info ---
    let memberCount = 1;
    let horzCount = 1;
    let vertCount = 1;
    let gridWidth = 640;
    let gridHeight =480;
    function _calcGridHorzVert() {
        memberCount = _getRemoteVideoCount();
        if (memberCount > 16) {
            horzCount = 5;
            vertCount = 5;
        }
        else if (memberCount > 9) {
            horzCount = 4;
            vertCount = 4;
        }
        else if (memberCount > 4) {
            horzCount = 3;
            vertCount = 3;
        }
        else if (memberCount > 1) {
            horzCount = 2;
            vertCount = 2;
        }
        else  {
            horzCount = 1;
            vertCount = 1;
        }

        gridWidth = mixWidth / horzCount;
        gridHeight = mixHeight / vertCount;
    }

    // ------- handling remote video --------------
    function _getRemoteVideoCount() {
        return Object.keys(remoteVideos).length;
    }

    this.addRemoteVideo = function(stream) {
        let remoteVideo = document.createElement('video');
        remoteVideo.id = "remotevideo_" + stream.id;
        remoteVideo.style.border = "1px solid black";
        remoteVideo.style.width = "480px"; // 16x30
        remoteVideo.style.height = "270px"; // 9x30
        // to hide :: remoteVideo.style.display = 'none'; // for Chrome (hidden NG)
        //remoteVideo.controls = true;
        remoteVideo.srcObject = stream;
        videoContainer.appendChild(remoteVideo);
        remoteVideo.volume = 0;
        remoteVideo.play();

        remoteStreams[stream.id] = stream;
        remoteVideos[stream.id] = remoteVideo;
        _calcGridHorzVert();
        _clearMixCanvas();
    }

    this.removeRemoteVideo = function(stream) {
        const videoId = "remotevideo_" + stream.id;
        let remoteVideo = document.getElementById(videoId); //'remotevideo_' + event.stream.id);
        remoteVideo.pause();
        remoteVideo.srcObject = null;
        videoContainer.removeChild(remoteVideo);

        let video = remoteVideos[stream.id];
        if (video !== remoteVideo) {
            console.error('VIDEO element NOT MATCH');
        }
        // NG //console.log('Before Delete video len=' + remoteVideos.length);
        console.log('Before Delete video keys=' + Object.keys(remoteVideos).length);
        delete remoteVideos[stream.id];
        // NG //console.log('After Delete video len=' + remoteVideos.length);
        console.log('After Delete video keys=' + Object.keys(remoteVideos).length);

        // NG //console.log('Before Delete Stream len=' + remoteStreams.length);
        console.log('Before Delete Stream keys=' + Object.keys(remoteStreams).length);
        delete remoteStreams[stream.id];
        // NG //console.log('After Delete Stream len=' + remoteStreams.length);
        console.log('After Delete Stream keys=' + Object.keys(remoteStreams).length);

        _calcGridHorzVert();
        _clearMixCanvas();
    }

    this.removeAllRemoteVideoStream = function() {
        console.log('===== removeAllRemoteVideoStream ======');
        for(let key in remoteVideos) {
            let video = remoteVideos[key];
            video.pause();
            video.srcObject = null;
            videoContainer.removeChild(video);
        }
        remoteVideos = [];

        for(let key in remoteStreams) {
            let stream = remoteStreams[key];
            _stopStream(stream);
        }
        remoteStreams = [];

        _calcGridHorzVert();
        _clearMixCanvas();
    }

    // --- handling remote audio ---
    this.addRemoteAudio = function(stream) {
        console.log('addRemoteAudio()');
        let remoteNode = audioContext.createMediaStreamSource(stream);
        inputNodes[stream.id] = remoteNode;
        remoteNode.connect(mixOutputNode);
    }

    this.removeRemoteAudio = function(stream) {
        let remoteNode = inputNodes[stream.id];
        if (remoteNode) {
            remoteNode.disconnect(mixOutputNode);
            delete inputNodes[stream.id];
        }
        else {
            console.warn('removeRemoteAudio() remoteStream NOT EXIST');
        }
    }

    this.removeAllRemoteAudio = function() {
        console.log('===== removeAllRemoteAudio ======');
        for(let key in inputNodes) {
            let remoteNode = inputNodes[key];
            remoteNode.disconnect(mixOutputNode);
        }
        inputNodes = [];
    }
};

