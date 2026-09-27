import { blank, sprite, stamp, type Sprite } from './sprite.ts'

/** A vine of little flowers that sits across the head between the ears. */
function flowerCrown(): Sprite {
  const W = 24
  let s = blank(W, 7)
  s = stamp(s, sprite(['G'.repeat(W - 4)]), 2, 4)
  s = stamp(s, sprite(['.g..g..g...g..g..g..g.']), 1, 5)
  const flower = (petal: string, heart: string) =>
    sprite(['.ooo.', `o${petal}${petal}${petal}o`, `o${petal}${heart}${petal}o`, `o${petal}${petal}${petal}o`, '.ooo.'].map((r, i) => (i === 0 || i === 4 ? r : r.replace(/^o|o$/g, 'o'))))
  // symmetric around the fox's centre line (x = 11.5 in this sprite)
  const spots: [number, string, string][] = [[0, 'm', 'y'], [5, 'c', 'Y'], [10, 'v', 'y'], [15, 'c', 'Y'], [19, 'm', 'y']]
  for (const [x, p, h] of spots) s = stamp(s, flower(p, h), x, x === 10 ? 1 : 2)
  return s
}

export type Slot = 'head' | 'face' | 'neck'

export interface ClothingArt {
  sprite: Sprite
  /** Position on the 42x32 sitting-fox canvas (may be negative for tall hats). */
  x: number
  y: number
}

// Sprites are positioned relative to the sitting fox: ears at cols 2-9 / 22-29,
// head top at row 6, eyes at rows 12-15, chin/neck around rows 17-21.
export const CLOTHING_ART: Record<string, ClothingArt> = {
  beret: {
    x: 7,
    y: 0,
    sprite: sprite([
      '.........oo.......',
      '....ooooorRoooo...',
      '..oorrrrrrrrrrroo.',
      '.orrrrrrrrrrrrrrro',
      'orrrrrrrrrrrrrrrRo',
      'oRrrrrrrrrrrrrrRRo',
      '.ooRRRRRRRRRRRRoo.',
      '...oooooooooooo...',
    ]),
  },
  flowerCrown: {
    x: 4,
    y: 3,
    sprite: flowerCrown(),
  },
  beanie: {
    x: 8,
    y: -3,
    sprite: sprite([
      '......oooo......',
      '.....ovwvvo.....',
      '.....ovvvVo.....',
      '....ooovVooo....',
      '..oovvvvvvvvoo..',
      '.ovvVvvVvvVvvVo.',
      '.ovvVvvVvvVvvVo.',
      'ovvvVvvVvvVvvVvo',
      'oVVVVVVVVVVVVVVo',
      'oVvVvVvVvVvVvVvo',
      '.oooooooooooooo.',
    ]),
  },
  frogHat: {
    x: 6,
    y: -3,
    sprite: sprite([
      '..oooo......oooo..',
      '.owwwwo....owwwwo.',
      'oowwxxo....oxxwwoo',
      'ogowwxooooooxwwogo',
      'oggooggggggggooggo',
      'oggggggggggggggggo',
      'ogpgggggggggggggpgo'.slice(0, 18),
      'oggggoggggggogggo.'.replace('o.', 'go'),
      'oGGGGGoooooGGGGGGo',
      '.oooooo....oooooo.',
    ]),
  },
  bow: {
    x: 19,
    y: 1,
    sprite: sprite([
      '.oo.....oo.',
      'oPmo...oPmo',
      'oPmmoooPmmo',
      'ommmoPommmo',
      'ommmoooommo',
      '.ooomo.ooo.',
      '...omo.omo.',
      '...oo...oo.',
    ]),
  },
  strawberryHat: {
    x: 8,
    y: -4,
    sprite: sprite([
      '.......oo.......',
      '......oGo.......',
      '...ooogGgooo....',
      '..ogggGgggggo...',
      '..oooGgggGooo...',
      '..orrooggoorro..',
      '.orrrrryrrrrrro.',
      'orrwrrrrrrryrrro',
      'orryrrrrryrrrrro',
      'orrrrryrrrrrrrRo',
      'oRRrRRRRRRyRRRRo',
      '.oooooooooooooo.',
    ]),
  },
  roundGlasses: {
    x: 5,
    y: 11,
    sprite: sprite([
      '..YYYY......YYYY..',
      '.Y....Y....Y....Y.',
      'YY....YYYYYY....YY',
      '.Y....Y....Y....Y.',
      '.Y....Y....Y....Y.',
      '..YYYY......YYYY..',
    ].map((r) => ('..' + r).padEnd(22, '.'))),
  },
  heartShades: {
    x: 6,
    y: 11,
    sprite: sprite([
      '.RR..RR......RR..RR.',
      'RmmRRmmR....RmmRRmmR',
      'RimmmmmRRRRRRimmmmmR',
      'RmmmmmmR....RmmmmmmR',
      '.RmmmmR......RmmmmR.',
      '..RmmR........RmmR..',
      '...RR..........RR...',
    ]),
  },
  judgeWig: {
    x: 1,
    y: 3,
    sprite: sprite(
      [
        '..........ooooo',
        '........oowwwww',
        '......oowzwwzww',
        '.....owzwwzwwzw',
        '..oowwwwwwwwwww',
        '.owzwwooooooooo',
        '.owwwo.........',
        '.owzwo.........',
        '.owwwo.........',
        '.owzwo.........',
        '.owwwo.........',
        '..ooo..........',
      ].map((r) => r + [...r].reverse().join('')),
      { z: '#e2e2ea' },
    ),
  },
  gradCap: {
    x: 6,
    y: -2,
    sprite: sprite([
      '.......oooooo.......',
      '....oooxxxxxxooo....',
      '.ooxxxxxxxxxxxxxxoo.',
      'oxxxxxxxxxyyyyyyyxxo',
      '.ooxxxxxxxxxxxxxxyo.',
      '....oooxxxxxxoooyo..',
      '.....oxxxxxxxxxoyo..',
      '.....oxxxxxxxxxoYY..',
      '......ooooooooo.YY..',
    ]),
  },
  necktie: {
    x: 13,
    y: 18,
    sprite: sprite(['.oooo.', '.oUUo.', '..oo..', '.oUUo.', 'oUYUUo', 'oUUYUo', 'oYUUYo', 'oUYUUo', '.oUYo.', '..oo..']),
  },
  scarf: {
    x: 3,
    y: 17,
    sprite: sprite([
      '...oooooooooooooooooooo...',
      '..orrRrrRrrRrrRrrRrrRrro..',
      '.orrrRrrRrrRrrRrrRrrRrrro.',
      '.oRrrRrrRrrRrrRrrRrrRrrRo.',
      '..oooooooooooooorrRrro....',
      '...............occcco.....',
      '...............orrrro.....',
      '...............occcco.....',
      '...............orrrro.....',
      '...............oror.o.....',
    ]),
  },
  bellCollar: {
    x: 6,
    y: 18,
    sprite: sprite([
      '..oooooooooooooooo..',
      '.ommmmmmmmmmmmmmmmo.',
      '.oPmmmmmmmmmmmmmmPo.',
      '..oooooooYYoooooooo.'.slice(0, 20),
      '........oywYo.......',
      '........oyyYo.......',
      '........oooooo......'.slice(0, 20),
    ]),
  },
  bandana: {
    x: 6,
    y: 18,
    sprite: sprite([
      'oooooooooooooooooooo',
      'oUUwUUUUUUUUUUUUwUUo',
      '.oUUUUwUUUUUUwUUUUo.',
      '..oUUUUUUwUUUUUUUo..',
      '...oUUwUUUUUUwUUo...',
      '....oUUUUwUUUUUo....',
      '.....oUUUUUUwUo.....',
      '......oUwUUUUo......',
      '.......oUUUUo.......',
      '........oUUo........',
      '.........oo.........',
    ]),
  },
}
