//
// Browser MCU sample server
//   https://github.com/mganeko/browser_mcu
//   browser_mcu is provided under MIT license
//
//   This sample is using https://github.com/mganeko/browser_mcu
//

'use strict';

const SSL_KEY = 'cert/server.key';
const SSL_CERT = 'cert/server.crt';
const fs = require('fs');
var options = {
 //key : fs.readFileSync(SSL_KEY).toString(),
 //cert : fs.readFileSync(SSL_CERT).toString()
};

const HEADLESS_FULL_PATH = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
const HEADLESS_OPTION = '--headless --disable-gpu --remote-debugging-port=9222';
const HEADLESS_MCU_URL = 'http://localhost:3000/meeting_mcu.html';

const childProcess = require('child_process');
let headless = null;

//const https = require("https");
const http = require("http");

const WebSocketServer = require('ws').Server;
//const wsPort = 3001;
//const wsServer = new WebSocketServer({ port: wsPort });
//console.log('websocket server start. port=' + wsPort);

const express = require('express');
const app = express();
const webPort = 3000;
app.use(express.static('public'));

// -- https ---
//const webServer = https.createServer( options, app ).listen(webPort, function(){
//    console.log('Web server start. https://serverurl:' + webServer.address().port + '/');
//});

// --- http ---
const webServer = http.Server( app ).listen(webPort, function(){
    console.log('Web server start. http://serverurl:' + webServer.address().port + '/');
});

const wsServer = new WebSocketServer({ server: webServer });
console.log('websocket server start. port=' + webServer.address().port );

let clientIndex = 0;


// --- websocket server ---
function getId(ws) {
  if (ws.additionalId) {
    return ws.additionalId;
  }
  else {
    clientIndex++;
    ws.additionalId = 'member_' + clientIndex;
    return ws.additionalId;
  }
}

function getClientCount() {
  // NG:  return wsServer.clients.length;
  return wsServer.clients.size;
}

wsServer.on('connection', function connection(ws) {
  console.log('client connected. id=' + getId(ws) + '  , total clients=' + getClientCount());
  broadcast( { type: 'notify', text: 'new client connected. count=' + getClientCount() } );

  ws.on('close', function () {
    const fromId = getId(ws);
    console.log('client closed. id=' + fromId + '  , total clients=' + getClientCount());
    broadcast( { type: 'client_disconnect', from: fromId});
    broadcast( { type: 'notify', text: 'client closed. count=' + getClientCount() } );
  });
  ws.on('error', function(err) {
    console.error('ERROR:', err);
  });
  ws.on('message', function incoming(data) {
    const inMessage = JSON.parse(data);
    const fromId = getId(ws);
    if (! inMessage) {
      console.error('GOT INVALID data from:' + fromId);
      return;      
    }

    console.log('received id=%s type=%s',  fromId, inMessage.type);
    inMessage.from = fromId;
    const toId = inMessage.to;

    if (toId) {
      sendTo(toId, inMessage);
    }
    else {
      sendOthers(fromId, inMessage)
    }
  });

  sendback(ws, { type: 'welcome' });
});

function sendback(ws, message) {
  const str = JSON.stringify(message);
  ws.send(str);
}

function broadcast(message) {
  const str = JSON.stringify(message);
  wsServer.clients.forEach(function (ws) {
    ws.send(str);
  });
};

function sendOthers(fromId, message) {
  const str = JSON.stringify(message);
  wsServer.clients.forEach(function (ws) {
    if (getId(ws) === fromId) {
      // skip
      console.log('skip same id=' + fromId);
    }
    else {
      ws.send(str);
    }
  });
}

function sendTo(toId, message) {
  const str = JSON.stringify(message);
  wsServer.clients.forEach(function (ws) {
    if (getId(ws) === toId) {
      // send message
      console.log('send message to id=' + toId);
      ws.send(str);
      return;
    }
  });
}

// --- headless browser ---

function startHeadlessChrome() {
  let openURL = buildURL('');
  let execPath = 
  headless = childProcess.execFile(HEADLESS_FULL_PATH,
    ['--headless', '--disable-gpu', '--remote-debugging-port=9222', openURL],
    (error, stdout, stderr) => {
      if (error) {
        //console.error('headless chrome ERROR:', error);
        console.error('headless chrome ERROR:');
      }
      else {
        console.log('headless　chrome STDOUT:');
        console.log(stdout);
      }
    }
  );
  console.log('-- start chrome --');
  console.log(' url=' + openURL);

  headless.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    headless = null;
  });
}

function buildURL(channel) {
  let url = HEADLESS_MCU_URL;
  return url;
}

function stopHeadlessChrome() {
  if (headless) {
    headless.kill('SIGKILL'); // OK
    console.log('---terminate headless chrome ----');
    headless = null;
  }
}

// --- start mcu ---
startHeadlessChrome();

