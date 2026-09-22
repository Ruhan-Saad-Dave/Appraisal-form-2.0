// Position is a percentage of the available overflow, never of the crop itself.
export function profilePhotoCrop(width, height, { zoom = 1, x = 0, y = 0 }, size = 1) {
  const scale = Math.max(size / width, size / height) * Math.max(1, zoom);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const overflowX = Math.max(0, (drawWidth - size) / 2);
  const overflowY = Math.max(0, (drawHeight - size) / 2);
  return {
    width: drawWidth,
    height: drawHeight,
    x: -overflowX + Math.max(-100, Math.min(100, x)) / 100 * overflowX,
    y: -overflowY + Math.max(-100, Math.min(100, y)) / 100 * overflowY,
  };
}
