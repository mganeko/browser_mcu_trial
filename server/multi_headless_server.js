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

const CLOSE_MCU_TIMER_SEC = 10;
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

  let count = 0;  
  if (io && io.sockets && io.sockets.adapter && io.sockets.adapter.rooms) {
    let clients = io.sockets.adapter.rooms[room];
    if (clients) {
      count = clients.length;
    }
    else {
      count = 0;
    }
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
    //emitMessage('message', { type: 'bye', from: getId(socket)})

    const roomname = getRoomname();
    if (roomname && (roomname !== '')) {
      console.log('-- leave from room=' + roomname);
      socket.leave(roomname);

      if (isMcu()) {
        // MCU shutdown
        console.log('=== MCU disconnected. room=' + roomname);
      }
      else {
        // member disconnected
        const count = coundDownMembersInRoom(roomname);
        console.log('=== member disconnected. room=' + roomname + ',  count=' + count);
        if (count === 0) {
          console.log('no members in room=' + roomname);
          setCloseTimer(roomname);          
        }
      }

      //let count = getClientCountInRoom(roomname);
      //if (count < 2) { // WARN! mcu browser is still in the room. Have to count members in the room (except MCU)
      //  console.log('no members in room=' + roomname);
      //  setCloseTimer(roomname);
      //}
    }

    emitMessage('message', { type: 'client_disconnect', from: getId(socket)})
  });
  socket.on('error',  function(err) {
    console.error('socket ERROR:', err);
  });

  socket.on('enter', function(roomname) {
    socket.join(roomname);
    console.log('id=' + getId(socket) + ' enter room=' + roomname);
    setRoomname(roomname);
    clearCloseTimer(roomname);

    // -- check if room / MCU ready
    let count = getClientCountInRoom(roomname);
    if (isRoomReady(roomname)) {
       sendback('welcome', {id: getId(socket), room: roomname, members: count, waitForInvoke: false});
    }

    // --- prepare room / MCU
    let ready = prepareRoom(roomname);
    countUpMembersInRoom(roomname);
    if (ready)  {
      sendback('welcome', {id: getId(socket), room: roomname, members: count,  waitForInvoke: true});
    }
    else {
      console.error('ERORR: failed to prepare room (invoke MCU');
    }
  });
  socket.on('mcu_enter', function(roomname) {
    socket.join(roomname);
    console.log('id=' + getId(socket) + ' MCU enter room=' + roomname);
    setRoomname(roomname);
    setMcu();
    setMcuReady(roomname);

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

  function setMcu() {
    socket.isMcu = true;
  }

  function isMcu() {
    if (socket.isMcu) {
      return true;
    }
    else {
      return false;
    }
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



//---- rooms ---
let rooms = []; 
var Room = function() {
  let roomname = '';
  let headlessProc = null;
  let mcuReady = false;
  let closeTimer = null;
  let members = 0;
  //let passwordHash = '';
}

function getRoom(name) {
  let room = rooms[name];
  return room;
}

function isRoomExist(name) {
  const room = rooms[name];
  if (room) {
    return true;
  }
  else {
    return false;
  }
}

function setMcuReady(name) {
  let room = getRoom(name);
  if (room) {
    room.mcuReady = true;
  }
}

function isRoomReady(name  /*,password*/) {
  let room = getRoom(name);
  if (! room) {
    // not exist yet
    return false;
  }

  if (room.headlessProc && room.mcuReady) {
    return true;
  }
  else {
    false;
  }
}

function prepareRoom(name  /*, passoword*/) {
  let room = getRoom(name);
  if (! room) {
    console.log('create new room. name=' + room);
    room = new Room();
    room.roomname = name;
    room.members = 0;
    room.mcuReady = false;
    room.headlessProc = null;

    // -- addRoom ---
    rooms[name] = room;
  }
  else {
    console.log('room already exist. name=' + name);
  }
  //console.log('==== room proc=' + room.headlessProc);

  // NOTE:
  // - chiled process will exist when using '--headless' option
  // - without '--headless' option, invokec process will pass to existing browser process and quit soon.
  //
  if (! room.headlessProc) {
    console.log('starting headless browser MCU for room=' + name);
    // -- start headless borowser for mcu --
    room.headlessProc = startHeadlessChrome(name);
    //console.log(' -- after exec room proc=' + room.headlessProc);
    if (! room.headlessProc) {
      console.error('CANNOT start headless MCU');
      return false;
    }
  }
  //console.log('--- prepareRoom end---');

  return true;
}

function countUpMembersInRoom(roomname) {
  let room = getRoom(roomname);
  if (room) {
    room.members += 1;
    console.log('countUpMembersInRoom count=' + room.members);
    return room.members;
  }
  else {
    console.warn('room NOT READY: name=' + roomname);
    return -1;
  }
}

function coundDownMembersInRoom(roomname) {
  let room = getRoom(roomname);
  if (room) {
    room.members -= 1;
    console.log('coundDownMembersInRoom count=' + room.members);
    return room.members;
  }
  else {
    console.warn('room NOT READY: name=' + roomname);
    return -1;
  }
}

function handleRoomClose(roomname) {
  let room = getRoom(roomname);
  if (room) {
    room.headlessProc = null;
    room.mcuReady = false;
  }
}

function closeRoom(roomname) {
  console.log('==== closing room === name='+ roomname);
  let room = getRoom(roomname);
  if (room) {
    if(room.headlessProc) {
      stopHeadlessChrome(room.headlessProc);
      room.headlessProc = null;
      room.mcuReady = false;
    }
    delete rooms[roomname];
    room = null;
  }
}

function setCloseTimer(roomname) {
  console.log('--setCloseTimer(%s)--', roomname)
  let room = getRoom(roomname);
  if (room && (! room.closeTimer)) {
    console.log('--set Timeout for close');
    room.closeTimer = setTimeout( (r) => {
       closeRoom(r)
    }, 1000*CLOSE_MCU_TIMER_SEC, roomname);
  }
}

function clearCloseTimer(roomname) {
  let room = getRoom(roomname);
  if (room && room.closeTimer) {
    console.log('-- clearCloseTimer room=' + roomname);
    clearTimeout(room.closeTimer);
    room.closeTimer = null;
  }
}

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

function startHeadlessChrome(roomname) {
  let openURL = buildURL(roomname);
  let mcuArgs = buildArgs(openURL);
  let proc = childProcess.execFile(mcuOptions.headlessFullpath,
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

  proc.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    handleRoomClose(roomname);
  });

  return proc;
}

function buildURL(roomname) {
  let url = mcuOptions.headlessUrl + '?room=' + roomname;
  console.log('mcu URL=' + url);
  return url;
}

function buildArgs(url) {
  let args = mcuOptions.headlessArgs;
  args.push(url);
  //console.log(args);
  return args;
}

function stopHeadlessChrome(proc) {
  if (proc) {
    proc.kill('SIGKILL'); // OK
    console.log('---terminate headless chrome ----');
    proc = null;
  }
}

// --- start mcu ---
//startHeadlessChrome();

