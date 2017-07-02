//
// Browser MCU
//   https://github.com/mganeko/browser_mcu
//   browser_mcu is provided under MIT license
// 
// TODO
//  (1) DONE: Provide All-mix audio mode: AUDIO_MODE_ALL = 2
//  (2) Provide Minus-one audio mode: AUDIO_MODE_MINUS_ONE = 1
//  (3) Provide NO Audio mode: AUDIO_MODE_NONE = 0

    // MEMO
    // 
    // MCU browser
    // 
    //
    // Design new mode:
    //   - MEETING_MODE (minus one)
    //   - SIDE_BY_SIDE (mix all audio)
    //   - NO_AUDIO ()
    //
    // Server, Member
    //   - wss, or socket.io
    //
    // --- task candidates --
    //  DONE - clean up, when member reloded (server)
    //  - setup pc_config (STUN, TURN)
    //  - change canvas size, remote video size, remote video visible/hidden
    //  - support multiple video for same peer 
    //  - support multiple audio for same peer
    //  DONE - correct timing for startMix/stopMix
    //  DONE - callme , in member
    //  DONE - updateButtons()

    // --- audio minus one for Meeting mode --
    // MEMO
    // in AUDIO_MODE_MINUS_ONE
    //  - prepare outputNode and stream, when got Offer
    //   DONE - streams key can not be incoming stream.id
    //   DONE - key should be peerId, given from outside
    //   DONE - prepareMinusOneStream(peerid)
    //   NOT NEED - removeMinusOneStream(peerid)
    //   (WRITE, NOT TESTED - getMinusOneStream(peerid))
    //  - provide
    //   DONE - addRemoteAudioMinusOne(peerid, stream)
    //   DONE - removeRemoteAudioMinusOne(peerid)
    //   DONE - removeAllRemoteAudioMinusOne()

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
    const AUDIO_MODE_NONE = 0;
    const AUDIO_MODE_MINUS_ONE = 1;
    const AUDIO_MODE_ALL = 2;
    const audioContext = new window.AudioContext();
    let audioMode = AUDIO_MODE_ALL;
    let inputNodes = [];
    let minusOneOutputNodes = [];
    let minusOneStreams = [];
    let mixAllOutputNode = null;
    let audioMixAllStream = null;


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

    this.setAudioMode = function(mode) {
        audioMode = mode;
    }

    // --- start/stop Mix ----
    this.startMix = function() {
        mixStream = canvasMix.captureStream(MIX_CAPTURE_FPS);
        if (audioMode === AUDIO_MODE_ALL) {
            mixAllOutputNode = audioContext.createMediaStreamDestination();
            audioMixAllStream = mixAllOutputNode.stream;
            mixStream.addTrack(audioMixAllStream.getAudioTracks()[0]);
        }

        animationId = window.requestAnimationFrame(_drawMixCanvas);
        keepAnimation = true;
        console.log('--start mix and capture stream--');
    }

    this.stopMix = function() {
        if (mixAllOutputNode) {
            // NG mixAllOutputNode.stop();
            audioMixAllStream = null;
            mixAllOutputNode = null;
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
        remoteVideo.style.width = "320px"; // 16x20; //"480px"; // 16x30
        remoteVideo.style.height = "180px"; // 9x20; //"270px"; // 9x30
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

        if (audioMode === AUDIO_MODE_ALL) {
            console.log('AUDIO_MODE_ALL: mix all audo');
            remoteNode.connect(mixAllOutputNode);
        }
        else if (audioMode === AUDIO_MODE_MINUS_ONE) {
            console.log('AUDIO_MODE_MINUS_ONE: make minus one audio');

            // -- prepare outputNode for this, connect other inputs ---
            let newOutputNode = audioContext.createMediaStreamDestination();
            let newAudioMixStream = newOutputNode.stream;
            minusOneOutputNodes[stream.id] = newOutputNode;
            minusOneStreams[stream.id] = newAudioMixStream;
            for (let key in inputNodes) {
                if (key === stream.id) {
                    console.log('skip input(id=' + key + ') because same id=' + stream.id);
                }
                else {
                    console.log('connect input(id=' + key + ') to this output');
                    let otherMicNode = inputNodes[key];
                    otherMicNode.connect(newOutputNode);
                }
            }

            // -- connect this node to other outputs --
            for (let key in minusOneOutputNodes) {
                if (key === stream.id) {
                    console.log('skip output(id=' + key + ') because same id=' + stream.id);
                }
                else {
                    let otherOutputNode = minusOneOutputNodes[key];
                    remoteNode.connect(otherOutputNode);
                }
            }
        }
        else {
            // AUDIO_MODE_NONE
            console.log('AUDIO_MODE_NONE: ignore remote audio');
        }
    }

    this.removeRemoteAudio = function(stream) {
        let remoteNode = inputNodes[stream.id];
        if (remoteNode) {
            remoteNode.disconnect(mixAllOutputNode);
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
            remoteNode.disconnect(mixAllOutputNode);
        }
        inputNodes = [];
    }

    this.prepareMinusOneStream = function(peerId) {
        let stream = minusOneStreams[peerId];
        if (stream) {
            console.warn('minusOneStream ALREADY EXIST for peerId:' + peerId);
            return stream;
        }

        let newOutputNode = audioContext.createMediaStreamDestination();
        let newAudioMixStream = newOutputNode.stream;
        minusOneOutputNodes[peerId] = newOutputNode;
        minusOneStreams[peerId] = newAudioMixStream;
        for (let key in inputNodes) {
            if (key === peerId) {
                console.log('skip input(id=' + key + ') because same id=' + peerId);
            }
            else {
                console.log('connect input(id=' + key + ') to this output');
                let otherMicNode = inputNodes[key];
                otherMicNode.connect(newOutputNode);
            }
        }

        // -- add Video Track --
        if (mixStream) {
            newAudioMixStream.addTrack(mixStream.getVideoTracks()[0]);
        }
        else {
            console.warn('Video Track NOT READY YET');
        }

        return newAudioMixStream;
    }

    this.getMinusOneStream = function(peerId) {
        let stream = minusOneStreams[peerId];
        if (! stream) {
            console.warn('minusOneStream NOT EXIST for peerId:' + peerId);
        }
        return stream;
    }

    this.addRemoteAudioMinusOne = function(peerId, stream) {
        let audioTracks = stream.getAudioTracks();
        if (audioTracks && (audioTracks.length > 0))  {
            console.log('stream has audioStream. audio track count = ' + audioTracks.length);
            console.log(' stream.id=' + stream.id + ' , track.id=' + audioTracks[0].id);

            // --- prepare audio mic node ---
            let micNode = audioContext.createMediaStreamSource(stream);
            inputNodes[peerId] = micNode;

            // --- connect to other output ---
            for (let key in minusOneOutputNodes) {
                if (key === peerId) {
                    console.log('skip output(id=' + key + ') because same id=' + peerId);
                }
                else {
                    let otherOutputNode = minusOneOutputNodes[key];
                    micNode.connect(otherOutputNode);
                }
            }
        }
        else {
            console.warn('NO Audio Tracks in stream');
        }
    }

    this.removeRemoteAudioMinusOne = function(peerId) {
        // -- remove from other outputs ----
        let thisMicNode = inputNodes[peerId];
        if (thisMicNode) {
            for (let key in minusOneOutputNodes) {
                if (key === peerId) {
                    console.log('skip output(id=' + key + ') because same id=' + peerId);
                }
                else {
                    let otherOutputNode = minusOneOutputNodes[key];
                    thisMicNode.disconnect(otherOutputNode);
                }
            }

            thisMicNode = null;
            delete inputNodes[peerId];
        }
        else {
            console.warn('inputNode NOT EXIST for peerId:' + peerId);
        }

        // --- remove other mic/inputs ---
        let thisOutputNode = minusOneOutputNodes[peerId];
        if (thisOutputNode) {
            for (let key in inputNodes) {
                if (key === peerId) {
                    console.log('skip disconnecting mic, because key=id (not connected)');
                }
                else {
                    let micNode = inputNodes[key];
                    micNode.disconnect(thisOutputNode);
                }
            }

            thisOutputNode = null;
            delete minusOneOutputNodes[peerId];
        }
        else {
            console.warn('minusOneOutputNode NOT EXIST for peerId:' + peerId);
        }

        let stream = minusOneStreams[peerId];
        if (stream) {
            stream = null;
            delete minusOneStreams[peerId];
        }
        else {
            console.warn('minusOneStream NOT EXIST for peerId:' + peerId);
        }
    }

    this.removeAllRemoteAudioMinusOne = function() {
        for (let key in minusOneStreams) {
            this.removeRemoteAudioMinusOne(key);
        }
    }
};

