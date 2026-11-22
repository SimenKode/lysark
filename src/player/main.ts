// Entry point of the player bundle that is written into exported HTML.
import { mountPlayer, type PlayerData } from './player';

const holder = document.getElementById('lysark-data');
const root = document.getElementById('lysark-app');
if (holder?.textContent && root) {
  mountPlayer(root, JSON.parse(holder.textContent) as PlayerData);
}
