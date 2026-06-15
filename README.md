This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## To work on
UI. I Think I have a good enough foundation that i can create an MVP
## To work on
The case where two entries are the same need to be worked on. The code finds the "0" mastery one but when you get a good score on the word it only updates the first entry. Second one stays unchanged forever
Solution: maybe add another unique thing where it includes definition? Then all words brought in will have to have defintions too
E.g.
  {
    "word": "还",
    "pinyin": "hái",
    "english_definition": "still",
    "frequency_rank": 155,
    "mastery": 89.48335279734783,
    "hsk_level": "hsk2",
    "teaching_value": 0.0678493367913043
  },
  {
    "word": "还",
    "pinyin": "huán",
    "english_definition": "to pay back",
    "frequency_rank": 156,
    "mastery": 0,
    "hsk_level": "hsk2",
    "teaching_value": 0.641025641025641
  },

## TO Work On
 1 stretch word in focus at a time, unless its a long sentence.
 Then 2 stretch words.
 And then its like probibalistic when 2 stretch words haoppen. Maybe like 1 out of 5 sentences.

 
## TO Work On
 Make it so the sentences are geared towards themes the person cares about
 Also, maybe there can be a custom set of words that the user is more likely to want to learn
 This is like the principle of those missionaris who learn the local language quick, because they have a limited context they're using words in

 
## TO Work On
More than just sentences, there can be whole stories or paragraphs containing multiple words
(How does it decide what words?)

## TO Work On
I DON'T think the lessons should be broken up into a discrete set of words, like Duolingo. It should be rolling.

## TO Work On
Rank the words not just on frequency but on # times they show up, compared to each other. This might be able to be used for more accurate "determine how often you need to drill this". I dont know how yet
