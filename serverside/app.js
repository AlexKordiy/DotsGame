let WebSocketServer = new require('ws');

// подключенные клиенты
let clients = {};

// WebSocket-сервер на порту 8081
let webSocketServer = new WebSocketServer.Server({
  port: 8081
});
webSocketServer.on('connection', function (ws) {
  if (Object.keys(clients).length < 2) {
    let id = Math.random();

    clients[id] = ws;
    let criterion = Object.keys(clients).length % 2 == 0;

    console.log(criterion);
    ws.send(JSON.stringify({
      cmd: 'settings',
      value: {
        Gamer: {
          turn: (criterion) ? false : true,
          pair: (criterion) ? true : false,
          marker: (criterion) ? 2 : 1,
          fillStyle: (criterion) ? "blue" : "red",
          connected: true
        }
      }
    }));

    console.log("новое соединение " + id);

    if (Object.keys(clients).length == 2) {
      clients[Object.keys(clients)[0]].send(JSON.stringify({
        cmd: 'join',
        value: true
      }));
    }

    ws.on('message', function (message) {
      console.log('получено сообщение ' + message);

      if (id == Object.keys(clients)[0])
        clients[Object.keys(clients)[1]].send(message);
      else if (id == Object.keys(clients)[1])
        clients[Object.keys(clients)[0]].send(message);

    });

    ws.on('close', function () {
      console.log('соединение закрыто ' + id);
      if (id == Object.keys(clients)[0])
        Unpair([Object.keys(clients)[1]]);
      else if (id == Object.keys(clients)[1])
        Unpair([Object.keys(clients)[0]]);

      delete clients[id];
      console.log(Object.keys(clients));
    });
  }
  else ws.send(JSON.stringify({
    cmd: 'full',
    value: 'Команда уже сформирована!'
  }));
});
console.log('Сервер запущен, port: 8081');

function Unpair(key) {
  if (clients[key] !== undefined) {
    clients[key].send(JSON.stringify({
      cmd: 'unpair',
      value: {
        Gamer: {
          turn: false,
          pair: false,
          connected: false
        },
        text: 'Вы выиграли! Соперник покинул игру...'
      }
    }));
    delete clients[key];
    console.log('соединение закрыто ' + key);
  }
}