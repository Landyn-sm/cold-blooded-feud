/*
  ALL GAME CONTENT LIVES IN THIS FILE.
  Replace the placeholder questions, answers and points with the real survey data.
  - Answers can be listed in any order; the game sorts them highest points first.
  - A round can have 1 to 8 answers.
  - multiplier: 1 = single, 2 = double, 3 = triple points.
*/
(typeof window !== 'undefined' ? window : globalThis).GAME_DATA = {
  title: 'COLD-BLOODED FEUD',
  subtitle: 'The Tye-Dyed Iguana vs C.R.A.B.S.',
  surveyLine: 'We asked you. Here is what you said.',
  winScore: 300,            // first team to this score wins the main game
  stealAddsAnswer: false,   // false = a steal wins the pot only (current TV rule)

  // The rules slide. Each one pops up when the judge presses NEXT.
  rulesTitle: 'HOW TO PLAY',
  rules: [
    'FACE-OFF: one player from each team. Fastest buzzer answers first.',
    'The higher answer wins control. That team can PLAY or PASS.',
    'Guess every answer on the board. Three wrong answers and you are out.',
    'Three strikes? The other team gets ONE guess to STEAL the points.',
    'Round 3 is worth DOUBLE points. Round 4 is worth TRIPLE.',
    'First team to 300 wins and plays the LIGHTNING ROUND.'
  ],

  // The closing screen after the lightning round.
  closingTitle: 'THANKS FOR PLAYING!',
  closingLine: 'See you at The Tye-Dyed Iguana and the next C.R.A.B.S. show',

  teams: [
    { name: 'TEAM TDI',   players: ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'] },
    { name: 'TEAM CRABS', players: ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5'] }
  ],

  rounds: [
    {
      label: 'ROUND 1', multiplier: 1,
      question: 'PLACEHOLDER: Name a reptile beginners buy first.',
      answers: [
        { text: 'Answer 1', points: 30 }, { text: 'Answer 2', points: 22 },
        { text: 'Answer 3', points: 15 }, { text: 'Answer 4', points: 11 },
        { text: 'Answer 5', points: 8 },  { text: 'Answer 6', points: 6 },
        { text: 'Answer 7', points: 4 },  { text: 'Answer 8', points: 2 }
      ]
    },
    {
      label: 'ROUND 2', multiplier: 1,
      question: 'PLACEHOLDER: Name something a customer forgets to buy with a new reptile.',
      answers: [
        { text: 'Answer 1', points: 34 }, { text: 'Answer 2', points: 21 },
        { text: 'Answer 3', points: 16 }, { text: 'Answer 4', points: 12 },
        { text: 'Answer 5', points: 8 },  { text: 'Answer 6', points: 5 },
        { text: 'Answer 7', points: 3 }
      ]
    },
    {
      label: 'ROUND 3', multiplier: 2,
      question: 'PLACEHOLDER: Name something a parent says when their kid asks for a snake.',
      answers: [
        { text: 'Answer 1', points: 38 }, { text: 'Answer 2', points: 24 },
        { text: 'Answer 3', points: 15 }, { text: 'Answer 4', points: 11 },
        { text: 'Answer 5', points: 7 },  { text: 'Answer 6', points: 4 }
      ]
    },
    {
      label: 'ROUND 4', multiplier: 3,
      question: 'PLACEHOLDER: Name something you would see at a reptile expo.',
      answers: [
        { text: 'Answer 1', points: 41 }, { text: 'Answer 2', points: 26 },
        { text: 'Answer 3', points: 16 }, { text: 'Answer 4', points: 10 },
        { text: 'Answer 5', points: 6 }
      ]
    },
    {
      // Only used if nobody has reached winScore after Round 4.
      // One answer on the board: whoever says it wins the points.
      label: 'SUDDEN DEATH', multiplier: 3,
      question: 'PLACEHOLDER: Name a pet that escapes its enclosure.',
      answers: [{ text: 'Answer 1', points: 45 }]
    }
  ],

  fastMoney: {
    label: 'LIGHTNING ROUND',
    target: 200,          // combined points needed to win
    times: [20, 25],      // seconds for player 1 and player 2
    questions: [
      { question: 'PLACEHOLDER: Name a feeder insect.',
        answers: [{ text: 'Answer 1', points: 40 }, { text: 'Answer 2', points: 25 }, { text: 'Answer 3', points: 15 }, { text: 'Answer 4', points: 10 }, { text: 'Answer 5', points: 6 }, { text: 'Answer 6', points: 4 }] },
      { question: 'PLACEHOLDER: Name a popular pet lizard.',
        answers: [{ text: 'Answer 1', points: 42 }, { text: 'Answer 2', points: 23 }, { text: 'Answer 3', points: 14 }, { text: 'Answer 4', points: 10 }, { text: 'Answer 5', points: 7 }, { text: 'Answer 6', points: 4 }] },
      { question: 'PLACEHOLDER: Name a common new-owner mistake.',
        answers: [{ text: 'Answer 1', points: 36 }, { text: 'Answer 2', points: 27 }, { text: 'Answer 3', points: 16 }, { text: 'Answer 4', points: 11 }, { text: 'Answer 5', points: 6 }, { text: 'Answer 6', points: 4 }] },
      { question: 'PLACEHOLDER: Name a freshwater fish everyone recognizes.',
        answers: [{ text: 'Answer 1', points: 44 }, { text: 'Answer 2', points: 22 }, { text: 'Answer 3', points: 13 }, { text: 'Answer 4', points: 9 }, { text: 'Answer 5', points: 7 }, { text: 'Answer 6', points: 5 }] },
      { question: 'PLACEHOLDER: Name a good name for a pet iguana.',
        answers: [{ text: 'Answer 1', points: 35 }, { text: 'Answer 2', points: 24 }, { text: 'Answer 3', points: 17 }, { text: 'Answer 4', points: 12 }, { text: 'Answer 5', points: 8 }, { text: 'Answer 6', points: 4 }] }
    ]
  }
};
