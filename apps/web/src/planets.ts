/* Keyed by id, so a body is the same colour wherever it is drawn. Colour only
   identifies here: every body is named in the diagram, and no state is carried
   by fill alone. */

const FILLS: Record<string, string> = {
  sun: '#FFD34D',
  mercury: '#D6D3D1',
  venus: '#FFD98A',
  earth: '#7EC8F0',
  mars: '#FF9E7A',
  jupiter: '#FFC46B',
  saturn: '#F2DFAE',
  uranus: '#A6E3E8',
  neptune: '#9FB0F2',
};

export function fillOf(id: string): string {
  return FILLS[id] ?? '#DDD6EC';
}
