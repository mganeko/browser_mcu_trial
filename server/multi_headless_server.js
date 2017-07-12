//
// Browser MCU sample server with multipule rooms/headless browsers
//   https://github.com/mganeko/browser_mcu
//   browser_mcu is provided under MIT license
//
//   This sample is using https://github.com/mganeko/browser_mcu
//

// TODO:
//  - use socket.io, use rooms
//  - hold room list, with headless browser object
//  - member index page with socket.io
//  - mcu page with socket.io

'use strict';

const mcuOptions = require('./options').mcuOptions;

const SSL_KEY = 'cert/server.key';
const SSL_CERT = 'cert/server.crt';
const fs = require('fs');
var sslOptions = {
 //key : fs.readFileSync(SSL_KEY).toString(),
 //cert : fs.readFileSync(SSL_CERT).toString()
};

//const HEADLESS_FULL_PATH = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
//const HEADLESS_OPTION = '--headless --disable-gpu --remote-debugging-port=9222';
//const HEADLESS_MCU_URL = 'http://localhost:3000/meeting_mcu.html';

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
//const webServer = https.createServer( sslOptions, app ).listen(webPort, function(){
//    console.log('Web server start. https://serverurl:' + webServer.address().port + '/');
//});

// --- http ---
const webServer = http.Server( app ).listen(webPort, function(){
    console.log('Web server start. http://serverurl:' + webServer.address().port + '/');
});

// --- socket.io server ---
const io = require('socket.io')(webServer);

function getId(socket) {
  return socket.id;
}

function getClientCount() {
  // WARN: undocumented method to get clients number
  return io.eio.clientsCount;
}

function getClientCountInRoom(room) {
  // WARN: undocumented method

  //console.log(io.sockets.manager); // not defined
  //console.log(io);
  //console.log(io.sockets.adapter);
  //console.log(io.sockets.adapter.rooms);
  //console.log(io.sockets.adapter.rooms[room]);
  //console.log(io.sockets.adapter.rooms[room].length);

  let count;  
  if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms && io.sockets.adapter.rooms[room]) {
    count = io.sockets.adapter.rooms[room].length;
  }
  else {
    console.log('===ERROR== CANNOT get clients count in room');
  }

  return count;
}


io.on('connection', function(socket) {
  console.log('client connected. socket id=' + getId(socket) + '  , total clients=' + getClientCount());
  //broadcast( { type: 'notify', text: 'new client connected. count=' + getClientCount() } );

  socket.on('disconnect', function() {
    // close user connection
    console.log('client disconnected. socket id=' + getId(socket) + '  , total clients=' + getClientCount());
    emitMessage('message', { type: 'bye', from: getId(socket)})
  });
  socket.on('error',  function(err) {
    console.error('socket ERROR:', err);
  });

  socket.on('enter', function(roomname) {
    socket.join(roomname);
    console.log('id=' + getId(socket) + ' enter room=' + roomname);
    setRoomname(roomname);

    let count = getClientCountInRoom(roomname);
    sendback('welcome', {id: getId(socket), room: roomname, members: count});
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  // --- emit message to members in the same room --
  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      //console.log('===== message broadcast to room -->' + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    }
    else {
      console.log('===== message broadcast all====');
      socket.broadcast.emit(type, message);
    }
  }

  function sendback(type, message) {
    socket.emit(type, message);
  }

  //function broadast(type, message) {
  //  socket.broadcast.emit(type, message);
  //}

  function sendMessageTo(target, message) {
    socket.to(target).emit('message', message);
  }

  socket.on('message', function incoming(inMessage) {
    const id = getId(socket);
    console.log('received fromId=%s to=%s type=%s',  id, inMessage.to, inMessage.type);
    inMessage.from = id;
 
    let target = inMessage.to;
    if (target) {
      //console.log('===== message emit to -->' + target);
      sendMessageTo(target, inMessage);
    }
    else {
      // broadcast in room
      emitMessage('message', inMessage);
    }
  });
});

//function sendback(ws, message) {
//  const str = JSON.stringify(message);
//  ws.send(str);
//}

//function broadcast(message) {
//  const str = JSON.stringify(message);
//  wsServer.clients.forEach(function (ws) {
//    ws.send(str);
//  });
//};

// -- use emitMessage instead --
//function sendOthers(fromId, message) {
//  const str = JSON.stringify(message);
//  wsServer.clients.forEach(function (ws) {
//    if (getId(ws) === fromId) {
//      // skip
//      console.log('skip same id=' + fromId);
//    }
//    else {
//      ws.send(str);
//    }
//  });
//}

//function sendTo(toId, message) {
//  const str = JSON.stringify(message);
//  wsServer.clients.forEach(function (ws) {
//    if (getId(ws) === toId) {
//      // send message
//      console.log('send message to id=' + toId);
//      ws.send(str);
//      return;
//    }
//  });
//}

/*------
// --- websocket server ---
const wsServer = new WebSocketServer({ server: webServer });
console.log('websocket server start. port=' + webServer.address().port );
let clientIndex = 0;

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
-----*/

// --- headless browser ---

function startHeadlessChrome() {
  let openURL = buildURL('');
  let mcuArgs = buildArgs(openURL);
  headless = childProcess.execFile(mcuOptions.headlessFullpath,
    //['--headless', '--disable-gpu', '--remote-debugging-port=9222', openURL],
    mcuArgs,
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
  let url = mcuOptions.headlessUrl;
  //console.log('mcu URL=' + url);
  return url;
}

function buildArgs(url) {
  let args = mcuOptions.headlessArgs;
  args.push(url);
  //console.log(args);
  return args;
}

function stopHeadlessChrome() {
  if (headless) {
    headless.kill('SIGKILL'); // OK
    console.log('---terminate headless chrome ----');
    headless = null;
  }
}

// --- start mcu ---
//startHeadlessChrome();

