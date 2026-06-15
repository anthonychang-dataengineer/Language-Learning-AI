//takes the vocab bank, which also has word gap #, word freqneucy (taken from word frequency list), and calculatyed word priority
//some code looks at that bank and checks for words only with priority > 15 or some number
//Claude is told to generate a sentence: use words only from words below that threshold AND the next word right above that 15 threshold
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const vocabBank = JSON.parse(fs.readFileSync('data/vocabBank.json','utf-8'));

const VALUE_THRESHOLD =  70;

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

// Store current sentence in memory
let currentSentenceData = null;

// ROUTE 1: GET /sentence - Generate and return a new sentence
app.get("/sentence", async (req, res) => {
  try {
    //filters out known words, in this case, above 70 in mastery. 
    // And then of the ones left, sorts it from lowest to highest
    const stretchWord = vocabBank
      .filter(item => item.mastery < VALUE_THRESHOLD)
      .sort((a,b) => b.teaching_value - a.teaching_value)[0] ;

    //the know words are any words above the 70 threshold in mastery. We assume you know it
    const knownWords = vocabBank.filter(item => item.mastery >= VALUE_THRESHOLD);

    console.log('stretch word:', stretchWord.word)

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

    // Store the sentence data for later grading
    currentSentenceData = {
      sentence: lesson_sentence,
      pinyin: lesson_sentence_pinyin,
      words: lesson_sentence_words
    };

    // Return to client
    res.json({
      sentence: lesson_sentence,
      pinyin: lesson_sentence_pinyin,
      words: lesson_sentence_words
    });

  } catch (error) {
    console.error("Error generating sentence:", error);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE 2: POST /grade - Grade user's translation
app.post("/grade", async (req, res) => {
  try {
    const { userAttempt } = req.body;

    if (!currentSentenceData) {
      return res.status(400).json({ error: "No sentence generated. Call GET /sentence first." });
    }

    const lesson_sentence = currentSentenceData.sentence;
    const lesson_sentence_words = currentSentenceData.words;

    //calls Claude to grade the translation
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
    })

    //writes it back to the JSON file
    fs.writeFileSync('data/vocabBank.json', JSON.stringify(vocabBank, null, 2))
    console.log("vocabBank updated!")

    // Return grades to client
    res.json({
      words: claudeWordGrades,
      commentary: attempt_grading_commentary
    });

  } catch (error) {
    console.error("Error grading translation:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
