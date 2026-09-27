// Makes a new pair of mailbox codes for the letters feature and prints the
// one line of SQL that registers them (only their hashes are stored).
//   node scripts/new-mailbox.ts
// Then run the printed SQL once in Supabase → SQL editor. Keep both codes
// private: never commit them.
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { normalizeCode } from '../src/game/mailcode.ts'

const WORDS = [
  ...'acorn apple apron aster autumn bagel bamboo banjo basil beach bean bear bell berry birch biscuit blanket bloom blossom boat bonnet book boot bow bread breeze brook brush bubble bun bunny butter button cabin cake calm camel candle candy canoe cape caramel cedar cello charm cherry cider cinnamon clay clover cloud cocoa comet cookie coral cosmos cotton cozy crane crayon cream creek cricket crumb cub cup cupcake daisy dance dawn dew dimple dove dream drum dumpling dune echo elm ember fable fairy fawn feather fern fig finch fir flute fluff foam forest fox freckle frost fudge garden gem ginger glade glow gnome goose grape grove gumdrop harbor harp hazel heart hedge heron hill holly honey iris island ivy jam jelly jewel juniper kettle kite kitten koala lake lamb lamp lantern lark latte lavender leaf lemon lilac lily lime linen lotus lullaby lunar mango maple marble meadow melody melon mint mitten mochi moon moss muffin mushroom nectar nest nutmeg oak oasis ocean olive orbit orchid otter owl panda pansy parade peach peanut pear pebble pecan penguin peony pepper petal piano pickle pie pillow pine pinecone pixel plum pocket pond poppy posy pretzel pudding puffin pumpkin puzzle quail quill quilt rabbit rain rainbow raven reed ribbon river robin rose ruby sage sail satin scarf seal seed shell shore silk sky sled snow sock sparrow spice sprout star story sugar summer sun swan sweater tangerine tea teddy thimble thistle tide toast toffee tulip tune twig twinkle valley velvet violet waffle walnut wave whisker willow wind wish wren yarn zephyr zinnia'.split(' '),
]
const list = [...new Set(WORDS)]
if (list.length < 256) throw new Error(`need 256 words, have ${list.length}`)
const pool = list.slice(0, 256)

const words = Array.from({ length: 5 }, () => pool[randomInt(pool.length)])
const reader = `${words.join('-')}-${randomInt(100, 1000)}`
const raw = BigInt('0x' + randomBytes(16).toString('hex')).toString(36).padStart(24, '0').slice(0, 24)
const writer = `writer-${raw.match(/.{4}/g)!.join('-')}`
const hash = (c: string) => createHash('sha256').update(normalizeCode(c), 'utf8').digest('hex')

console.log(`her mailbox code:  ${reader}`)
console.log(`your writer key:   ${writer}`)
console.log('')
console.log('SQL (run once in Supabase → SQL editor):')
console.log(`insert into public.mailboxes (reader_hash, writer_hash) values ('${hash(reader)}', '${hash(writer)}');`)
