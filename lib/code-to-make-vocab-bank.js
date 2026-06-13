import fs from "fs";
import csv from "csv-parser";

//read the csv file
const importedRows = []
fs.createReadStream(String.raw`C:\Users\17322\Desktop\My Language Learning App\HSK Word List\hsk updated with Claude\hsk1_with_n_frequencies.csv`)
    .pipe(csv())
    .on('data', (row) => importedRows.push(row))
    .on('end', () => { //on the end of reading all of these rows, start creating and populatiung the json
        
        console.log(importedRows[0])

    const vocabBank = importedRows.map(importedRows=> (
        {
            word: importedRows.Word,
            pinyin: importedRows.Pinyin,
            english_definition: importedRows["English Definition"],
            frequency_rank: importedRows["Relative Frequency"],
            mastery: 2
        }
    )
    )
    //calculates priority and adds it
    vocabBank.forEach(word=> (
        word.learning_need_score = word.mastery*word.frequency_rank
    ))

    console.log(vocabBank[0])
    //write to json file
    fs.writeFileSync(
        'data/vocabBank.json',
        JSON.stringify(vocabBank, null, 2)
    )


    })//closing of reading stream