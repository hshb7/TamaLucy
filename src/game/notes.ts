// Notes the fox writes. Lowercase, earnest, a little silly.
// Placeholders: {name} {fox} {label} {minutes} {streak}

export const GENERAL_NOTES = [
  'dear {name}, i watched you work so hard today. i am very proud of you.',
  '{name}! you are doing amazing. i am keeping your seat warm.',
  'i saved you the best acorn. it’s under my pillow. don’t tell anyone.',
  'reminder: drink some water! i just did. it was great.',
  'you are my favourite human. (i have only met a few, but still.)',
  'i tried to write you a poem but i only know the word "snack". snack snack snack. i love you.',
  'every time you focus, my tail gets a little fluffier. look how fluffy it is!!',
  'even small steps count. i take very small steps and i get everywhere.',
  'if today is hard, that’s okay. we can be cozy about it together.',
  'i practised my handwriting just for you. how is it? (be honest) (no, be nice)',
  'you make this little room feel like home.',
  'i think you are smart and kind and good at things. that’s it, that’s the note.',
  'stretch your arms up high! like a fox waking from a nap! ...did you do it?',
  'psst. you’re allowed to be proud of yourself.',
  'i made you a cup of tea but i drank it. i’ll make you another one in spirit.',
  'the sun came in through the window and i thought of you. warm and bright!',
  'rest is part of the work. even foxes nap between adventures.',
  'i don’t know exactly what you’re working on, but i believe in it. and in you.',
  'thank you for spending time with me. it’s my favourite part of the day.',
  'i’m not saying you’re the best, but i am thinking it very loudly.',
  'you + me = cozy team. that’s math.',
  'your future self is going to be so thankful for today’s you.',
  'hi. hello. hi. i just wanted to say hi.',
  'i told the teddy bear about you. it was very impressed.',
  'remember to eat something yummy today. you deserve a treat too!',
  'you focus, i guard the snacks. perfect teamwork.',
  'i hid a hug in this envelope. did you feel it? it’s a big one.',
  'whatever happens today, you’re still my favourite.',
]

export const MORNING_NOTES = [
  'good morning, {name}! i woke up early to cheer you on. (then i napped a bit.)',
  'morning focus is the best focus. the birds agree.',
]

export const NIGHT_NOTES = [
  'it’s getting late, sleepyhead. make sure you get some rest, okay?',
  'the stars are out! they’re proud of you too. so am i.',
]

export const LONG_NOTES = ['{minutes} whole minutes!! you’re like a focus wizard. i’m in awe.']

export const LABEL_NOTES = ['i hope "{label}" went well! i was cheering in my head the whole time.']

export const STREAK_NOTES = ['{streak} days in a row!! we’re on a roll. a fox roll.']

export const MISSED_NOTES = [
  'day 1: i waited by the window. day 2: i waited by the window, but lying down. today: you’re back!! i knew you’d come back.',
  'i missed you so much i reorganised my acorns four times. welcome home.',
  'the room was very quiet without you. i’m really glad you’re here.',
]

export function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
