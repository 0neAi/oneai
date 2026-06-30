let wss = null;

function setWebSocketServer(server) {
  wss = server;
}

function getWebSocketServer() {
  return wss;
}

module.exports = { setWebSocketServer, getWebSocketServer };
