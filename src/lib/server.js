import express from 'express';
import getServerPort from 'get-port';
import cloneDeep from 'lodash/cloneDeep';

const app = express();

let playlistData;
let server;
let port;

app.get('/playlist.json', (req, res) => {
  res.send(JSON.stringify(playlistData));
});

app.get('/get-file', (req, res) => {
  res.sendFile(req.query.path);
});

const startServer = async () => {
  port = await getServerPort();

  server = app.listen(port);
};

const setPlaylist = (data) => {
  playlistData = cloneDeep(data);
};

const getServer = () => server;

const getPort = () => port;

startServer();

export default {
  setPlaylist,
  getServer,
  getPort
};
