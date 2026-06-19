import fs from "fs";
import csv from "csv-parser";

//read the csv file
let wordList = [];
let eachVocabBank = [];
(async () => {//for some reason, Javascript requires you to make it explicit that you will run something, and wait for the the code inside async to finish, and THEN you are allowed to do other stuff
    for (let i = 0; i <= 6; i++) { 
        

         
        //importedRows[i] = [];
        const filePath = `C:\\Users\\17322\\Desktop\\My Language Learning App\\HSK Word List\\hsk updated with Claude\\hsk${i}_with_n_frequencies.csv`
        const importedList =  await new Promise((resolve) => {//importedData is declared as a promise, that will be resolved. And on resolve, then you can do stuff
            const importedRows = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (csvRow) => importedRows.push(csvRow))//this reads every row from the csv and pushes /adds it to each imported row
                .on('end', () => resolve(importedRows))
        });
        wordList.push(importedList)//add that list that just came from the csv, to the wordList array
        
    }  
})().then(() => {
    console.log(wordList[2][0])
    let offsetAmount = 0;//initialize the variable that will be used to offset the frequency rank
    for (let i = 2; i <= 6; i++) {//iterate through each hsk, starting with hsk2
        offsetAmount = offsetAmount + wordList[i].length//the offset amount will be the size of the first hsk. 
        console.log(i)

        for (let j = 0; j < wordList[i].length; j++) {//the hsk1 offset is then added to hsk2 frequency rank. (rank 4 in hsk2 is 150+4 = 154) 
        // By the time it is done for hsk2, the new offset will be hsk1 size plus hsk2 size
            wordList[i][j]["Relative Frequency"] = j + 1 + offsetAmount
        }
    }
    console.log(wordList[2][0])

    let hsk_mastery = 70;
    for (let i = 0; i <= 6; i++) {
        if (i <= 2){
            hsk_mastery = 70//this is simp,y to populate hsk1 so we have some words that are above th 70 threshold
        }else{
            hsk_mastery = 0
        }
        eachVocabBank[i] = [];
        eachVocabBank[i] = wordList[i].map(eachRow => (//turns the 2d array into a dictionary?
            {
                word: eachRow.Word,
                pinyin: eachRow.Pinyin,
                english_definition: eachRow["English Definition"],
                frequency_rank: eachRow["Relative Frequency"],
                mastery: hsk_mastery,
                hsk_level: "hsk"+ (i)
            }
        ))
        //calculates priority and adds it
         eachVocabBank[i].forEach(word=> (
            word.teaching_value = (100 - word.mastery)*(1/word.frequency_rank)//this seems to work for now for "nextness". 
            // Later I might want to make freqnecy and mastery more evenly weighted so might use logs. but for now, this is ok. 
            // Might want to do that, maybe use actual word freqneucy percentages. 
            // might come in handy if im going to do probabilty of some words showing up
        ))
    }


    const allVocabBanks = eachVocabBank.flat();//combines all the arrays

    console.log(allVocabBanks)
    //write to json file
        fs.writeFileSync(
            'data/vocabBank.json',
            JSON.stringify(allVocabBanks, null, 2)
        )
    
});

