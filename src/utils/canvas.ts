import type { Scene, Textures } from 'phaser';

export function createCanvasContext(
  scene: Scene,
  key: string,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    throw new Error(`Canvas texture could not be created: ${key}`);
  }
  return texture.context;
}

export function refreshCanvasTexture(scene: Scene, key: string): void {
  const texture = scene.textures.get(key) as Textures.CanvasTexture;
  texture.refresh();
}
