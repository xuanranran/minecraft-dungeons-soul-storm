import {retryable} from './resources.mjs';
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error('地图数据读取失败，请重试。');
  return response.json();
}
export const loadMapIndex = retryable(() => json('./data/maps/index.json?v=layout2'));
const worlds = new Map();
export async function loadMapWorld(id) {
  const index = await loadMapIndex();
  const dimension = index.dimensions.find(d => d.id === id) || index.dimensions[0];
  if (!worlds.has(dimension.id)) worlds.set(dimension.id, retryable(() => json(dimension.data)));
  return {...dimension, markers: await worlds.get(dimension.id)()};
}
