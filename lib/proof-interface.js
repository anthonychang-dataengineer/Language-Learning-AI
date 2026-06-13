//takes the vocab bank, which also has word gap #, word freqneucy (taken from word frequency list), and calculatyed word priority
//some code looks at that bank and checks for words only with priority > 15 or some number
//Claude is told to generate a sentence: use words only from words below that threshold AND the next word right above that 15 threshold
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import prompt from "prompt-sync";
import readline from "readline";

const vocabBank = JSON.parse(fs.readFileSync('data/vocabBank.json','utf-8'));

const SCORE_THRESHOLD =  149;
//sorts vocabBank from lowest score to highest
vocabBank.sort((a,b) => a.learning_need_score - b.learning_need_score) ;

//it assings a variable. For all the entries in JSON, call it a vocabItem. filter below the priority threshold, based on word.priority threshold
const lowScoreWordsInDict = vocabBank.filter(vocabItem => vocabItem.learning_need_score <= SCORE_THRESHOLD);
//takes # of items for low score words
const nextWordToLearnIndex = lowScoreWordsInDict.length;
//Since the array starts at 0, we DON'T do nextWordToLearnIndex+1. We just do nextWordToLearnIndex. 
// E.g. if the word is the 4th in vocabBank, the length is 4, but the array position is 3. So to take the next word, do vocabBank[4]
const nextWordToLearnDict = vocabBank[nextWordToLearnIndex];

const lowScoreWords = lowScoreWordsInDict.map(item => item.word);
const nextWordToLearn = nextWordToLearnDict.word;


console.log('low score words:', lowScoreWords)
console.log('next word:', nextWordToLearn)
//LESSON
//User sees the sentence
//user types in his guess at a translation of the sentence
//Claude deduced, based on the sentence, how well the user knows each word
//     This might be the biggest point of contention, because its unclear how Claude can accurately judge
//claude then updates the word gap #


//pulls in env file
dotenv.config({ path: ".env" });
const anthropic = new Anthropic(); //reads ANTHROPIC_API_KEY

//defines schema for first prompt
const firstSchema = {
  type: "object",
  properties: {
    sentence: { type: "string" },
    sentence_pinyin: { type: "string" },
    sentence_words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          score: { type: "number" },
        },
        required: ["word", "score"],
        additionalProperties: false,
      },
    },
  },
  required: ["sentence", "sentence_pinyin", "sentence_words"],
  additionalProperties: false,
};


//calls Anthropic to take the words we have, the lowscore and nextword, to generate a sentence
const lesson_sentence_JSON_output = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 600,
            messages: [
                {
                    role: "user",
                    content: `Generate a legible and natural Mandarin sentence using these rules:
                    You MUST incorporate this word: \n${nextWordToLearn} \n
                    Any other words in the sentence must come from this list, no where else:
                    \n=== ${lowScoreWords.join("\n")} \n
                    Choose a different sentence each time.
                    Only output:
                    The words you took from the second list to make the sentence (the word's score should be set to 0 be default), 
                    the sentence, and its pinyin`,
                },
            ],
            output_config: {
                format: {
                    type: "json_schema",
                    schema: firstSchema,
                },
                
            },
        });
        //output for the sentence, the pinyin and the words it used
        const lesson_sentence_output = JSON.parse(lesson_sentence_JSON_output.content[0].text)
        const lesson_sentence = lesson_sentence_output.sentence;
        const lesson_sentence_pinyin = lesson_sentence_output.sentence_pinyin;
        const lesson_sentence_words = lesson_sentence_output.sentence_words;

        console.log("This is your sentence: \n", lesson_sentence);
        console.log("This is your pinyin: \n", lesson_sentence_pinyin);
        console.log("This is your list of words: \n", lesson_sentence_words);

//user input
const input = prompt();
const userAttempt = input("Input your best translation of this sentence: ")
/*const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const userAttempt = "";
rl.question("Type your translation here: "), (userAttempt) => {
    console.log("You type:", userAttempt);
}*/

//defines schema for second prompt
const secondSchema = {
  type: "object",
  properties: {
    sentence_words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          score: { type: "number" },
        },
        required: ["word", "score"],
        additionalProperties: false,
      },
    },
    commentary: { type: "string" },
  },
  required: ["sentence_words","commentary"],
  additionalProperties: false,
};

const attempt_grading_JSON_output = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 600,
            messages: [
                {
                    role: "user",
                    content: `Look at this lesson sentence: \n
                    ${lesson_sentence} \n
                    It was created using the words in this list:\n
                    ${lesson_sentence_words}\n
                    Look at this user translation attempt: \n
                    ${userAttempt} \n
                    Determine how well the user understands and comprehends each unique word. 
                    Give a numeric score from 1-3. Update the score for each word in the word list I provided and return it.
                    In addition, provide commentary on their comprehension`,
                },
            ],
              output_config: {
                format: {
                    type: "json_schema",
                    schema: secondSchema,
                },
                
            },
        });

        const attempt_grading_output = JSON.parse(attempt_grading_JSON_output.content[0].text)
        const attempt_grading_words = attempt_grading_output.sentence_words;
        const attempt_grading_commentary = attempt_grading_output.commentary;

        console.log("This is your grade: \n", attempt_grading_words);
        console.log("Notes: \n", attempt_grading_commentary);

//now we have the core, build up from here, and add UI, and adjust logic
//I think for Chinese at least, a good principle for learning is indeed, keep a master list of charatcers
//the thing is that real words are usually NOT individual characters. So any lesson must incorporate words
//And so I will stick with a master list of characters
//And then perhaps...
//It still looks at the threshold by character
//And when it creates senetences, it still creates the sentence with words
//And then when a new word is seen (using existing characters), it gets added to the JSON with its own scores
//then THOSE scores will be used for priority, I think
//lets think about it if one were to learn english. theyd have a list of phonemes like "house", "store", or "kill", "over"
//you'd start with those set of phonemes as a starter, and the AI would generate sentences with house and kill
//the sentence could end up with words like "storehouse" or "overkill"
//an english learner would guess what the sentence is
//and then "storehouse" and "overkill" would be added under the item "house" and "kill"
//so then, would "house" and "kill" have scores? Not sure. But "house" within "house" would have scores
//and when the AI searches, it searches for scores on the second level
//Its simply that the phonemes are a default starting point and "next step" point in order to have some structure on what words we should look for
//you do have the downside that it only will create words that are not as useful for a beginner if its limited to the previous
//like its a huge jump from "kill" to "overkill"
//although I guess I could utilize HSK list of words so that it's like, "use all these words in sentences"
//and then it still updates the vocabBank under the charatcers
//But it also gives flexibility to add your own word that you find out about
//you input it (or its suggested because of the theme you want)
//and then its saved under the characters
//but would there be a need for charatcers at that point? instead of just a list of words?
//So perhaps there should be a freuqneyc list of WORDS that will be the basis
//and then there could be a supplemtary thing where every time you see the words, it notes that in a separate list of charatcers
//The list of characters is scored up or down based on how often you are familiar with it, based on how familiar you are with the word
//This is used so that it helps decide which new word to show. If the word has a charatcer youre more familiar with, it will show that