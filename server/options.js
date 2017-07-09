'use strict';

module.exports =
{
	mcuOptions : {
    headlessFullpath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome', // for MacOS X
    headlessArgs: ['--headless',  '--disable-gpu',  '--remote-debugging-port=9222'],
    headlessUrl: 'http://localhost:3000/meeting_mcu.html',
    maxUserInRoom: 4,
    maxRooms: 2
  }
}
