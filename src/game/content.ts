import type { Slot } from '../art/clothes.ts'

export interface Item {
  id: string
  name: string
  blurb: string
}

export const TREATS: Item[] = [
  { id: 'strawberry', name: 'Strawberry', blurb: 'sweet, juicy, perfect.' },
  { id: 'onigiri', name: 'Onigiri', blurb: 'a rice ball with a happy face.' },
  { id: 'dango', name: 'Dango', blurb: 'three chewy friends on a stick.' },
  { id: 'cookie', name: 'Choco cookie', blurb: 'still warm from the oven.' },
  { id: 'cupcake', name: 'Pink cupcake', blurb: 'with a cherry on top!' },
  { id: 'cocoa', name: 'Hot cocoa', blurb: 'marshmallows, obviously.' },
  { id: 'taiyaki', name: 'Taiyaki', blurb: 'a fish-shaped cake. yum.' },
  { id: 'peach', name: 'Peach', blurb: 'soft and fuzzy, like fox ears.' },
]

export const GIFTS: Item[] = [
  { id: 'fairyLights', name: 'Fairy lights', blurb: 'twinkly lights for the walls.' },
  { id: 'plant', name: 'Leafy plant', blurb: 'a green friend for the corner.' },
  { id: 'books', name: 'Storybooks', blurb: 'for bedtime reading.' },
  { id: 'mushroomLamp', name: 'Mushroom lamp', blurb: 'glows softly at night.' },
  { id: 'cactus', name: 'Tiny cactus', blurb: 'a spiky windowsill buddy.' },
  { id: 'yarn', name: 'Yarn ball', blurb: 'for pouncing. very important.' },
  { id: 'teddy', name: 'Teddy bear', blurb: 'a cuddle buddy for lonely days.' },
  { id: 'painting', name: 'Painting', blurb: 'a sunny meadow for the wall.' },
  { id: 'snowGlobe', name: 'Snow globe', blurb: 'a whole tiny winter inside.' },
  { id: 'cushion', name: 'Floor cushion', blurb: 'the comfiest sitting spot.' },
  { id: 'heartRug', name: 'Heart rug', blurb: 'makes the room extra lovely.' },
]

export interface Clothing extends Item {
  slot: Slot
  /** Earned through the fox's law career rather than as a reward. */
  career?: boolean
  /** Only offered as a reward in this season. */
  season?: 'october' | 'winter'
  /** Given on a special day (her birthday), never a random reward. */
  special?: boolean
}

export const CLOTHES: Clothing[] = [
  { id: 'beret', slot: 'head', name: 'Red beret', blurb: 'très chic.' },
  { id: 'flowerCrown', slot: 'head', name: 'Flower crown', blurb: 'picked from the meadow.' },
  { id: 'beanie', slot: 'head', name: 'Knit beanie', blurb: 'warm head, happy fox.' },
  { id: 'frogHat', slot: 'head', name: 'Frog hat', blurb: 'ribbit.' },
  { id: 'bow', slot: 'head', name: 'Pink bow', blurb: 'for extra-cute days.' },
  { id: 'strawberryHat', slot: 'head', name: 'Strawberry hat', blurb: 'berry fashionable.' },
  { id: 'roundGlasses', slot: 'face', name: 'Round glasses', blurb: 'for serious studying.' },
  { id: 'heartShades', slot: 'face', name: 'Heart shades', blurb: 'too cool for school.' },
  { id: 'scarf', slot: 'neck', name: 'Cozy scarf', blurb: 'hand-knitted with love.' },
  { id: 'bellCollar', slot: 'neck', name: 'Bell collar', blurb: 'jingle jingle.' },
  { id: 'bandana', slot: 'neck', name: 'Blue bandana', blurb: 'adventure-ready.' },
  { id: 'pumpkinHat', slot: 'head', name: 'Pumpkin hat', blurb: 'october only! spooky and cute.', season: 'october' },
  { id: 'earmuffs', slot: 'head', name: 'Earmuffs', blurb: 'a winter exclusive. toasty ears.', season: 'winter' },
  { id: 'partyHat', slot: 'head', name: 'Party hat', blurb: 'from your birthday ♡', special: true },
  { id: 'necktie', slot: 'neck', name: 'Law-firm tie', blurb: 'dress for the job you want.', career: true },
  { id: 'gradCap', slot: 'head', name: 'Grad cap', blurb: 'juris doctor fox.', career: true },
  { id: 'judgeWig', slot: 'head', name: 'Judge wig', blurb: 'order in the court!', career: true },
]

export interface AdventureDef {
  id: string
  place: string
  verb: string
  souvenir: string
  souvenirName: string
  stories: string[]
}

export const ADVENTURES: AdventureDef[] = [
  {
    id: 'maple',
    place: 'Maple Forest',
    verb: 'jumping in leaf piles',
    souvenir: 'mapleLeaf',
    souvenirName: 'Maple leaf',
    stories: [
      'i rolled around in a giant pile of leaves until i was more leaf than fox. i saved the prettiest one for you!',
      'all the trees were orange and red, like a cozy fire. this leaf fell right on my nose, so i knew it was yours.',
    ],
  },
  {
    id: 'meadow',
    place: 'Berry Meadow',
    verb: 'picking berries',
    souvenir: 'berries',
    souvenirName: 'Wild blueberries',
    stories: [
      'i picked berries all afternoon. i only ate... most of them. these ones are for you!',
      'a bumblebee showed me the best bushes. we are friends now. i brought you the plumpest berries.',
    ],
  },
  {
    id: 'pond',
    place: 'Lily Pond',
    verb: 'visiting the frogs',
    souvenir: 'lilyPad',
    souvenirName: 'Lily pad',
    stories: [
      'i met a frog named gerald. he was very polite. he asked me to give you this lily pad.',
      'i sat by the pond and watched the dragonflies. the water was so sparkly. i wish you were there!',
    ],
  },
  {
    id: 'hill',
    place: 'Stargazing Hill',
    verb: 'counting stars',
    souvenir: 'star',
    souvenirName: 'Fallen star',
    stories: [
      'i counted 847 stars, then one fell right into my paws! it is still a little bit warm.',
      'i made a wish on a shooting star. i can’t tell you what it was, but it was about you.',
    ],
  },
  {
    id: 'beach',
    place: 'Seaside',
    verb: 'chasing waves',
    souvenir: 'shell',
    souvenirName: 'Pink seashell',
    stories: [
      'the waves kept chasing me and i kept chasing them back. hold this shell to your ear to hear me having fun.',
      'i dug a very deep hole in the sand. at the bottom was this shell! it was waiting for you.',
    ],
  },
  {
    id: 'grove',
    place: 'Mushroom Grove',
    verb: 'exploring the grove',
    souvenir: 'mushroom',
    souvenirName: 'Lucky mushroom',
    stories: [
      'the mushrooms here glow at night! i brought back a lucky one. it’s for looking at, not for eating.',
      'i got a little lost but a nice snail showed me the way home. he also gave me this.',
    ],
  },
  {
    id: 'library',
    place: 'the Law Library',
    verb: 'reading in the law library',
    souvenir: 'bookmark',
    souvenirName: 'Flower bookmark',
    stories: [
      'i snuck into the law library and read a whole casebook. i have many questions about adverse possession. i made you a bookmark!',
      'the librarian owl said i was very quiet (i was napping on the reporters). i pressed a flower between the pages for you.',
    ],
  },
  {
    id: 'courthouse',
    place: 'the Courthouse Steps',
    verb: 'people-watching at the courthouse',
    souvenir: 'feather',
    souvenirName: 'Pigeon feather',
    stories: [
      'i sat on the courthouse steps and watched everyone rush in with their briefcases. a pigeon gave me this feather. i think he was a witness.',
      'i peeked into a courtroom. the judge had a very serious face and a very nice robe. someday that\u2019ll be you. (i\u2019ll be the bailiff.)',
    ],
  },
  {
    id: 'woods',
    place: 'Pinecone Woods',
    verb: 'racing squirrels',
    souvenir: 'pinecone',
    souvenirName: 'Pinecone',
    stories: [
      'a squirrel and i had a race. i lost, but i found this perfect pinecone, so really i won.',
      'the woods smelled like rain and pine. i found the roundest pinecone in the whole forest for you.',
    ],
  },
]

export const REWARD_KINDS = ['adventure', 'gift', 'treat', 'clothes', 'note'] as const
export type RewardKind = (typeof REWARD_KINDS)[number]

export const REWARD_INFO: Record<RewardKind, { title: string; blurb: string; icon: string }> = {
  adventure: { title: 'go on an adventure', blurb: 'comes home with a postcard + souvenir', icon: 'backpack' },
  gift: { title: 'give a gift', blurb: 'something new for the room', icon: 'gift' },
  treat: { title: 'give a treat', blurb: 'fills the tummy, lifts the mood', icon: 'strawberry' },
  clothes: { title: 'get new clothes', blurb: 'something cute to wear', icon: 'bow' },
  note: { title: 'write you a note', blurb: 'a little letter, just for you', icon: 'mail' },
}

export const byId = <T extends Item>(list: T[], id: string) => list.find((x) => x.id === id)
