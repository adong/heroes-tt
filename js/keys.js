/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: HTT.TITLE, // the name lives in js/title.js
  cols: ['Player 1', 'Player 2'],
  keys: [
    ['walk (you hit by yourself)', 'W A S D', '↑ ← ↓ →'],
    ['abilities', 'F G H', 'J K L'],
    ['heroic (from level 10)', 'R', 'I'],
    ['call your brother · team-up', 'T', 'Enter'],
    ['pick a talent', '1 2', '9 0'],
    ['pause · sound', 'P or Esc · M', ''],
    ['title: Teddy · Tommy · both · easy', '1 2 3 E', ''],
  ],
  note: 'Playing alone, both sets of keys work, and T or Enter calls your brother as often as you like.',
  touch: 'Put your thumb down on the left and push to walk. The round buttons are your abilities (the big one first), and your brother\'s face calls him. Two players: each uses their own half.',
});
