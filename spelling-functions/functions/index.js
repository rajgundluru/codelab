const {conversation} = require('@assistant/conversation');
const functions = require('firebase-functions');
const https = require('https');
const app = conversation();
const cors = require('cors')({origin: true});

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();


async function getWordDetailsFromDictionaryAPI(word) {
  var responseData="";
  var req = https.request({
    host: 'api.dictionaryapi.dev',
    port: 443,
    path:'/api/v2/entries/en/' + word,
    method:'GET'
  }, (res) => {
    res.setEncoding('utf8');
    res.on('data', d => {
        responseData+=d;
    })
    res.on('end',function(){
        var object = JSON.parse(responseData)
        const wordListRef = db.collection('wordlist');
        wordListRef.doc(object[0].word).set(
          object[0]
        );
       return responseData;
     });
  });
  req.end();
}

exports.createSpellingPracticeWord = functions.firestore
  .document('wordlist/{word}')
  .onCreate((snap, context) => {
    const newValue = snap.data();
    const word = newValue.word;
    getWordDetailsFromDictionaryAPI(word);
});


app.handle('getSpellingWordList', conv => {
  const wordListRef = db.collection('wordlist').limit(50);
  const snapshot = wordListRef;

  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }  
  VocabularyList = []

  return snapshot.get().then(snapshot => {
    snapshot.forEach(doc => {
      if (doc.data().word) {
          var definition = 'unknown';
          var audio = 'unknown';
          try {
            if(doc.data().hasOwnProperty('meanings')) {
              if(doc.data().meanings[0].hasOwnProperty('definitions')) {
                  definition = doc.data().meanings[0].definitions[0].definition;
              }
            }
            if(doc.data().hasOwnProperty('phonetics')) {
              if(doc.data().phonetics.length > 0)
                audio = doc.data().phonetics[0].audio;
            }
          } catch (error) {
            console.log(error);
          }

          var obj = {
            word: doc.data().word,
            answer: doc.data().word.split("").join(" "),
            definition: definition,
            audio: audio
          }
          VocabularyList.push(obj);
      }
      
      //Shuffle the array
      var currentIndex = VocabularyList.length, temporaryValue, randomIndex;
      while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = VocabularyList[currentIndex];
        VocabularyList[currentIndex] = VocabularyList[randomIndex];
        VocabularyList[randomIndex] = temporaryValue;
      }
    
      conv.session.params.vocabWord = VocabularyList;
      conv.session.params.vocabWordIndex = 0;
    });
  });
})

//Function returns a single word
app.handle('getSpellingWord',  conv => {
  if (!conv.session.params.vocabWord.empty) {
    conv.session.params.vocabWordIndex+=1;
    const ssml = '<speak>' +
    '<audio src="'+ conv.session.params.vocabWord[conv.session.params.vocabWordIndex].audio +'">Use phonetics to spell the word.</audio> ' +
    '</speak>';
    conv.add(ssml);
  }
  else
    conv.add('Gret job! You have completed  the Spelling Bee');
});

app.handle('repeatSpellingWord',  conv => {
  if (!conv.session.params.vocabWord.empty) {
    const ssml = '<speak>' +
    '<audio src="'+ conv.session.params.vocabWord[conv.session.params.vocabWordIndex].audio +'">Use phonetics to spell the word. </audio> ' +
    '</speak>';
    conv.add(ssml);
  }
  else
    conv.add('Gret job! You have completed  the Spelling Bee');
});

app.handle('definitionOfSpellingWord',  conv => {
  conv.add( 'It means ' + conv.session.params.vocabWord[conv.session.params.vocabWordIndex].definition);
});

app.handle('verifySpellingWord', conv => {
  try {
    userResponse = conv.intent.params.userresponse.resolved.join("");
    if (userResponse.toLowerCase() === conv.session.params.vocabWord[conv.session.params.vocabWordIndex].word.toLowerCase()) {
      conv.add('You are correct. Say next to continue.');
    }
    else {
      conv.add('Sorry, wrong answer. The correct answer is ' + conv.session.params.vocabWord[conv.session.params.vocabWordIndex].answer + ' . Say next to continue.');
    }   
  } catch (error) {
    conv.add('Sorry. I did not understand your response' );
  }  
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
  
    