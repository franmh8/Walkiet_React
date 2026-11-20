import assert from 'node:assert/strict';
import {chatLocation, locationTiles} from '../src/native/chat/location/chatLocation';
const point = chatLocation('https://www.google.com/maps?q=20.12345,-99.23456')!;
assert.equal(point.label, '20.12345, -99.23456');
assert.equal(chatLocation(undefined, '📍 Ubicación Real [20.12345, -99.23456]')?.url, point.url);
for (const url of ['javascript:alert(1)', 'https://www.google.com.evil.test/maps?q=1,2', 'https://evil.test/maps?q=1,2', 'https://www.google.com/maps?q=NaN,1', 'https://www.google.com/maps?q=,', 'https://www.google.com/maps?q=91,1', 'https://www.google.com/maps?q=1,181', 'https://www.google.com/maps?q=1,2,3']) assert.equal(chatLocation(url), null, url);
assert.equal(chatLocation('https://www.google.com/maps?q=0%2C0')?.label, '0.00000, 0.00000');
assert.equal(chatLocation('https://www.google.com/maps?q=1,2&redirect=https://evil.test')?.url, 'https://www.google.com/maps?q=1,2', 'Abrir utiliza un enlace canónico, sin parámetros adicionales.');
assert.equal(locationTiles(chatLocation('https://www.google.com/maps?q=90,0')!, 252, 124).length, 0, 'No presenta una coordenada polar como si fuera otra latitud.');
for (const longitude of [-180, -99.23456, 0, 179.99999, 180]) {
  const tiles = locationTiles({...point, longitude}, 252, 124);
  assert.equal(tiles.length, 4);
  for (const tile of tiles) assert.match(tile.uri, /^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/);
  const left = Math.min(...tiles.map(tile => tile.left)), top = Math.min(...tiles.map(tile => tile.top));
  assert.ok(left <= 0 && left + 512 >= 252 && top <= 0 && top + 512 >= 124, 'Las teselas cubren toda la miniatura centrada.');
  for (const tile of tiles) {const [, x, y] = new URL(tile.uri).pathname.split('/').slice(1).map(v=>parseInt(v));assert.ok(x>=0&&x<32768&&y>=0&&y<32768);}
}
console.log('OK ubicación: mensajes anteriores, URLs/coordenadas válidas, enlace canónico, cobertura de mapa centrada, antimeridiano y polos.');
