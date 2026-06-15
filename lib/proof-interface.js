//takes the vocab bank, which also has word gap #, word freqneucy (taken from word frequency list), and calculatyed word priority
//some code looks at that bank and checks for words only with priority > 15 or some number
//Claude is told to generate a sentence: use words only from words below that threshold AND the next word right above that 15 threshold
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
//import prompt from "prompt-sync";
import readline from "readline";
import express from "express";// Creates HTTP routes
import cors from "cors";// Allows browser requests

const vocabBank = JSON.parse(fs.readFileSync('data/vocabBank.json','utf-8'));


const MASTERY_THRESHOLD =  70;
//filters out known words, in this case, above 70 in mastery. 
// And then of the ones left, sorts it from lowest to highest based on frequency rank
//and it takes the first one, i.e. the next in rank of unknown words remaining
console.log(vocabBank
  .filter(item => item.mastery < MASTERY_THRESHOLD))


const stretchWord = vocabBank
  .filter(item => item.mastery < MASTERY_THRESHOLD)
  .sort((a,b) => a.frequency_rank - b.frequency_rank)[0] ;

//the known words are any words above the 70 threshold in mastery. We assume you know it
const knownWords = vocabBank.filter(item => item.mastery >= MASTERY_THRESHOLD);

console.log('stretch word:', stretchWord.word)

const app = express();//Create the server
app.use(cors());//Alow browser to make requests
app.use(express.json());//Parse JSON from browser
app.use(express.static('C:\\Users\\17322\\Desktop\\My Language Learning App\\my-language-learning-app\\lib'));//tells express to serve files from current folder, i.e. index.html

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
              grade: { type: "number" },
            },
            required: ["word", "grade"],
            additionalProperties: false,
          },
        },
      },
      required: ["sentence", "sentence_pinyin", "sentence_words"],
      additionalProperties: false,
    };

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
          grade: { type: "number" },
        },
        required: ["word", "grade"],
        additionalProperties: false,
      },
    },
    commentary: { type: "string" },
  },
  required: ["sentence_words","commentary"],
  additionalProperties: false,
};

let currentSentenceData = null;

app.get("/sentence", async (req, res) => {
  try {
    //calls Anthropic to take the words we have, the lowscore and nextword, to generate a sentence
    const lesson_sentence_JSON_output = await anthropic.messages.create({
                model: "claude-sonnet-4-6",
                max_tokens: 600,
                messages: [
                    {
                        role: "user",
                        content: `Generate a legible and natural Mandarin sentence using these rules:
                        CRITICAL REQUIREMENT: The sentence MUST incorporate this word: ${stretchWord.word} \n
                        And any other words in the sentence must come from this input list, no where else:
                        \n=== ${knownWords.map(item => item.word).join("\n")} \n
                        Choose a different sentence each time.
                        Output:
                        The words you took from the word list to make the sentence (the word's score should be set to 0 be default), 
                        -sentence: the Chinese sentence
                        -sentence_pinyin: the sentence's pinyin
                        -sentence_words: array of EXACT words from input list (no combining characters or separating), with a score set to 0 
                        CRITICAL OUTPUT REQUIREMENT:
                          - sentence_words array MUST contain ONLY words that appear in the input list above
                          - Each word must be EXACTLY as written in the list
                          - Do NOT create new words by combining characters
                          - Do NOT split words into characters`
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
            
            currentSentenceData = 
                  {sentence: lesson_sentence, 
                  pinyin: lesson_sentence_pinyin, 
                  words: lesson_sentence_words};

            res.json(currentSentenceData);//this is what sends the sentence claude created back to the browser?


    
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

//user input


app.post("/grade", async (req, res) => {
  try {
    const {userAttempt} = req.body; //Get the translation
    
    if (!currentSentenceData) {
      return res.status(400).json({ error: "No sentence generated. Call GET /sentence first." });
    }

    const lesson_sentence = currentSentenceData.sentence;
    const lesson_sentence_words = currentSentenceData.words;
    const attempt_grading_JSON_output = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 600,
              messages: [
                  {
                      role: "user",
                      content: `Look at this lesson sentence: \n
                      ${lesson_sentence} \n
                      It was created using ONLY these words (use exact matches only):
                      ${lesson_sentence_words.map(w => w.word).join(", ")}\n
                      Look at this user translation attempt: \n
                      ${userAttempt} \n
                      Determine how well the user understands and comprehends each unique word (as it appears from the input list). 
                      Give a numeric score from 0 to 100 (100 meaning they know it 100%). 
                      Output:
                        -sentence_words: the same input list, just update the scores
                        CRITICAL: 
                          - Only score words that appear EXACTLY in the input list above
                          - Do NOT score variations like "看看" if only "看" is in the list
                          - Return the EXACT SAME word objects from input, only update scores
                        -commentary: Commentary on their comprehension, give justification why you don't give 100 for the grade if so`,
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
          const claudeWordGrades = attempt_grading_output.sentence_words;
          const attempt_grading_commentary = attempt_grading_output.commentary;

          console.log("This is your grade: \n", claudeWordGrades);
          console.log("Notes: \n", attempt_grading_commentary);

          //the logic for updating mastery, where it rewards consistently for correctness and penalizes softly for lower scores
          const REWARD_RATE = 0.20
          const PENALTY_RATE = 0.08

          function updateMastery(item, claudeWordGrades) {
            const rate = claudeWordGrades > item.mastery ? REWARD_RATE : PENALTY_RATE
            item.mastery += (claudeWordGrades - item.mastery) * rate
            console.log(item.word, ", New Mastery: ", item.mastery)
          }
          

          //shifts through the vocabBank and updates each word from Claude's grading and updates their masteries
          for (const {word, grade} of claudeWordGrades) {
            const entry = vocabBank.find(item => item.word === word)
            if (entry) updateMastery(entry, grade)
                

          }
          //simply done so I can see the updated teaching value scores in the next loop
          const wordsUsed = claudeWordGrades.map(item => item.word)
          //recalculates the teaching value for ALL vocabBank, now that the masteries are updated
          vocabBank.forEach(item => {
            item.teaching_value = (100 - item.mastery) * (1/item.frequency_rank)
            /*if (wordsUsed.includes(item.word)) {
              console.log(item.word, item.teaching_value)
            }*/
          })

          //writes it back to the JSON file
          //in real life there apparently is the risk that an array might be corrupted, and then something corrupted will overwrite the JSON file
          //in that case you might want to write to a temp file first or have a backup or something
          fs.writeFileSync('data/vocabBank.json', JSON.stringify(vocabBank, null, 2))
          console.log("vocabBank updated!")

          res.json({words: claudeWordGrades, commentary: attempt_grading_commentary});
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

const PORT = 3000;
//starts the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

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

//switch it so the stretch words switch up and isnt just 1 the whole time? It can be chosen probabilaistically
//change how fast you learn?
//also maybe refine the prompt on how to grade words
//key point though is that you dont have to get 100 for you to know it. 
// E.g. 汉语 is literally "Chinese Language" but I wrote "Chinese" which still is the exact same idea, certainly in context. I got a score of 85, which is good enough
//dupliczte words with different meanings: e.g.还
//Or, make it so that after the threshold, it looks at like the next 5 or ten words as candidates for stretch words. 
// And its probibalistic in using each word, based onf the current levels of mastery. 
// e.g. a word with mastery 50 is less likely to be the stretch word than one with 30, in that rolling 10 word batch
//maybe a UI next