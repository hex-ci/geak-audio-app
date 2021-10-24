import { readFile, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

const playlistPath = path.join(os.homedir(), '.geak-audio-playlist.json');

const savePlaylist = async (playlist) => {
  try {
    await writeFile(playlistPath, JSON.stringify(playlist));
    return true;
  }
  catch (e) {
    return false;
  }
};

const loadPlaylist = async () => {
  try {
    const content = await readFile(playlistPath);

    return JSON.parse(content);
  }
  catch (e) {
    return [];
  }
};

export default {
  load: loadPlaylist,
  save: savePlaylist
};
