import { readFile, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

const favoritePath = path.join(os.homedir(), '.geak-audio-favorite.json');

const saveFavorite = async (favorite) => {
  try {
    await writeFile(favoritePath, JSON.stringify(favorite));
    return true;
  }
  catch (e) {
    return false;
  }
};

const loadFavorite = async () => {
  try {
    const content = await readFile(favoritePath);

    return JSON.parse(content);
  }
  catch (e) {
    return [];
  }
};

export default {
  load: loadFavorite,
  save: saveFavorite
};
