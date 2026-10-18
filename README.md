# Heroes TT

[![Heroes TT title screen](docs/screenshot.jpg)](https://adong.github.io/heroes-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.

Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

A kid-sized team battle arena for Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit.
Two teams of five heroes walk two lanes with their minions, knock down towers and forts, and race to crumble the other side's **cookie castle**.
Team Teddy & Tommy plays against a silly Zombie & Robot team. Nobody gets hurt: bonked heroes take a nap in bed back at base, and minions pop into stars and coins.
There are no image, model or audio files: the map, the heroes, the minions and the buildings are built from boxes and balls, every texture is painted on a canvas, and every sound is synthesised.

"Heroes TT" is a working title. It lives in one constant, `HTT.TITLE` in `js/title.js`, and the page title, logo and ? panel all follow it.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/heroes-tt.html` is the whole game in one page (about 860 KB). AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name heroes-tt`

On the title screen, tap your face to play alone (**TEDDY** or **TOMMY**), or tap **TEDDY + TOMMY** for two players on the same team, on one keyboard or one iPad. Pick 🐣 **EASY** (the default) or 🔥 **NORMAL** first, if you like. Bots play every other hero on both teams.

## Controls

| | Player 1 | Player 2 | Touch |
|---|---|---|---|
| walk (you hit the nearest enemy by yourself) | W A S D | ↑ ← ↓ → | put your thumb down on the left and push |
| abilities 1 · 2 · 3 | F G H | J K L | the round buttons (the big one is ability 1) |
| heroic (from level 10) | R | I | the small round button |
| call your brother (1 player) · team-up (2 players) | T | Enter | his face |
| pick a talent when you level up | 1 2 | 9 0 | tap the card |
| pause · sound | P or Esc · M | | ❚❚ · 🔊 under the map |

- **Playing alone**, both sets of keys work, so the arrows, J K L, I and Enter do too.
- **Aiming is automatic:** shots, dashes and leaps go toward the nearest enemy hero in reach (or the nearest enemy), so little hands only have to press the button.
- **Two players on an iPad:** each brother has his own half of the screen. Put a thumb down anywhere on your half to walk; your ability buttons sit next to the middle, and the team-up button is between them.
- **Title screen keys:** 1 plays Teddy, 2 Tommy, 3 both, E toggles easy, Enter plays again.

## How it works

- **The map:** a big backyard seen from above, with a white picket fence around it. Team Teddy & Tommy's base is on the left (blue), the Zombie & Robot base on the right (pink). Two sandy lanes run from base to base, one along the top and one along the bottom.
- **Buildings:** each team has, in each lane, a **tower** (toy blocks with a hoop on top for the brothers, purple blocks with a red robot eye for the zombies) and a **fort** (a little castle). At the back of each base stands the **cookie castle**: cookie walls with chocolate chips, icing and giant cookies on the turrets. Buildings shoot at anything that comes close, minions first.
- **The castle's shield:** a cookie castle has a bubble shield while both of its forts stand. Knock down one fort and the castle can be hit. Knock the castle down and you win.
- **Minions** march down both lanes every 30 seconds: toy soldiers (blue jackets, red jackets with pop-guns, and a toy cannon every third wave) against mini zombies, little zapping robots and a goo cart. They fight whatever they meet. They get a bit stronger every minute, and once a team knocks down a fort, its minions in that lane come out **big**, so every match ends.
- **Critter camps:** bear cubs (top) and robot dogs (bottom) live in the middle of the map. They only fight back when poked. Beat a camp and the critters join your team and march down the nearest lane. The camp comes back 75 seconds later.
- **Map objectives** appear in the middle, the first at 1:30 and the next two minutes after each capture, taking turns:
  - 🏀 **Golden Basketball:** stand next to it with nobody from the other team there for 5 seconds. Golden balls fly over and slam the front building in each lane (almost half its health) and pop the minions around it.
  - ✌️ **Peace Shrine:** a stone arch with a rainbow. Capture it the same way and a giant friend marches down the lane with fewer enemy buildings: a **giant teddy bear** for the brothers, a **giant robot** for the zombies.
  - The ring on the ground fills in your team's colour as you capture; if both teams are there, nobody's ring fills.
- **Bonked, not hurt:** a hero who runs out of health takes a nap on a bed at his base with a 💤, then wakes up full and walks back out. The nap gets a little longer as the teams level up (3 s plus a third of a second per level on Easy).
- **Health:** the fountain at your base heals you fast. Out of a fight you heal slowly. Popped enemy minions sometimes drop a 🍪 cookie that heals whoever on that team walks over it.
- **Team XP:** everyone on a team shares one level (up to 20). XP comes in a little all the time, and from minions popped near you, critters, buildings, and bonking enemy heroes. Each level adds 4.5% health and power.
- **Talents** at levels 4, 7 and 10: pick one of two (keys 1 / 2, or 9 / 0 for player 2, or tap). If nobody picks within 25 seconds, the first one is chosen. Bots pick straight away.

  | Level | | |
  |---|---|---|
  | 4 | 💪 STRONG: hit 25% harder | ❤️ TOUGH: 25% more health |
  | 7 | ⚡ QUICK: abilities come back faster | 👟 SPEEDY: run faster |
  | 10 | 🍪 COOKIE MUNCH: heal when you bonk someone, and cookies heal double | 🛡️ SUPER ARMOR: get hurt less |

- **The heroic** (each hero's big fourth move) unlocks for the whole team at level 10, with a "LEVEL 10!" banner.
- **The HUD:** the two teams' levels and XP bars and the match clock at the top, the map objective under them (with a countdown when it's coming), a minimap top right, your card bottom left (health, abilities with cooldown rings, talents), and an arrow at the edge of the screen pointing at the objective when it's off-screen.

## Heroes

Every hero has a basic attack (it fires by itself at the nearest enemy in range), three abilities and a heroic.

**Team Teddy & Tommy**

| Hero | Role | F · G · H | Heroic (R) |
|---|---|---|---|
| **TEDDY** | bruiser, boxing up close | 🥊 JAB + STRAIGHT (Tyson-style, the straight knocks back) · 🏀 JUMP SHOT · 💨 DASH | 🏀 **SLAM DUNK:** leaps in, lands with a hoop and a giant ball, stuns everyone around |
| **TOMMY** | helper, peace signs from a distance | ✌️ PEACE WAVE (his Y pose: heals friends, pushes enemies back) · 🛡️ HUG SHIELD (on the friend who needs it most) · 🫧 SLEEPY BUBBLES (a slow patch) | 🙌 **BIG Y:** a big shield and a heal for the whole team, wherever they are |
| **ZOOM** | speedy | 👟 ZIP KICK · ⚡ ZOOM! (runs faster) · 🛹 SKATE DASH | 🌪️ TORNADO |
| **LUNA** | shooter | 🌙 MOON BOOMERANG (goes out and comes back) · 🌠 STAR SHOWER · 🐇 MOON HOP | 🌕 FULL MOON (a huge boomerang moon that also hits buildings) |
| **BRUNO** | tank (the bear) | 🐾 BEAR SWIPE · 📣 BIG ROAR (stuns) · 🍯 HONEY ARMOR | 💥 BELLY FLOP |

**The Zombie & Robot team** mirrors them: **ZOMBO** (bruiser: zombie swipes, goo ball, shamble rush, big belly bounce), **GOOEY** (helper zombie: goo splash, slime shield, sticky puddle, goo fort), **ZIPPY** (speedy zombie: slap, zip, roller rush, zombie dance), **BOLT** (the kit's robot: chain zap, static field, rocket boots, robo beam) and **CLANK** (tank robot: clank punch, bonk wave, tin armor, ground pound).

The brothers and their friends are the kit's characters (`Kit.roster`); ZOMBO is the kit's zombie, and GOOEY, ZIPPY and CLANK are new looks made from the same kit parts in `js/art.js`.

## Companion

**Playing alone**, the other brother is your companion: Tommy for Teddy, and Teddy for Tommy (`Kit.roster.buddyFor`). Call him with **T** (or Enter), or tap the big button with his face, **as often as you like**. There's no waiting: he keeps protecting you as long as you keep calling him.

- **He zooms in** to your side, smaller than the team heroes (his roster `buddyScale`), with a golden ring and his own name tag. This works even though he's also on your team as a bot somewhere else on the map.
- **He says hi** with his signature move: Tommy does his ✌️ Y pose; Teddy does his jab and straight, then his jump shot.
- **He tosses you a treat** (🍦 💧 🧃 🍪 🍉 🍌) that heals a quarter of your health: **"🍦 ICE CREAM FROM TOMMY!"**
- **He blocks every hit on you** while he's there (12 s on Easy, 10 s on Normal), with **"TOMMY SAVED YOU!"** (or **"TEDDY SAVED YOU!"**) and a SAVED! burst. He also helps: Teddy jabs whatever's close, Tommy sends out little ✌️ waves that push enemies back.
- **Call again** for another hello, another treat and the whole visit again. The ring around his button shows how long he's staying.
- **Napping?** Calling him wakes you up: **"TOMMY WOKE YOU UP!"**
- **At the end** he does his goodbye move and zooms off.
- The end screen counts how many hits he saved you from.

## Modes

- **1 player:** you play Teddy or Tommy; bots play the other four on your team and all five zombies and robots.
- **2 players (co-op):** both brothers on the same team, on one keyboard (player 1 on the left, player 2 on the right) or one iPad (each on his own half). The camera keeps both in view and zooms out when they split up.
  - **T / Enter is the TEAM-UP:** both brothers get a shield and some health back, do their moves, and a star blast goes off around each of them. If they're close together it's a **HIGH FIVE** and the blast is bigger. It also wakes up a brother who's napping. Then it rests for 12 s (Easy) or 20 s (Normal); its ring refills as it does.
- 🐣 **EASY** (the default, for Tommy, 5):
  - the hero you play has 40% more health, and everything hits you 30% softer;
  - the zombie bots hit 10% softer, think more slowly, aim a bit off and use their abilities less;
  - short naps for your team (3 s plus a little per level), the zombie towers and castle are tougher (so the match lasts), and the companion stays 12 s.
- 🔥 **NORMAL** (for Teddy, 8): both teams the same.
- Matches end when a cookie castle falls. Bot-vs-bot matches take about 5 to 10 minutes on Easy and 6 to 19 minutes on Normal (see the soak below); a kid playing one of the heroes makes it a little longer.

## Make it yours

- **`js/sim.js`** has the numbers at the top: `LEVELS` (Easy and Normal), the map and lanes, `STRUCTS` (towers, forts, castles), `WAVE` and `MINIONS`, the objectives, `XP` and `TALENTS`, every hero in `HEROES` (health, speed, basic attack, the four abilities), the companion (`BUDDY`, `TREATS`) and the team-up. Run `node tools/check.js --soak` after changing them.
- **`js/brain.js`** is the bots: when they go home, where they stand in a lane, when they use each ability.
- **`js/art.js`** builds everything you see; `LOOKS` has the new zombie and robot heroes.

## How it's tested

The rules (`js/sim.js`) and the bots (`js/brain.js`) have no Three.js in them. The browser game and a headless check run the same code.

```bash
node tools/check.js
```

```bash
node tools/check.js --soak --seeds=6
```

- **Rules (29):** the companion (Tommy for Teddy and Teddy for Tommy, the hello and treat, every hit blocked while he's there, calling again, going home, hits landing again after, waking a napping brother); the 2-player team-up (wakes a brother, shields both, then rests); the heroic locked before level 10; talents (bots pick, yours wait, TOUGH adds health); the castle shield and the win; the Golden Basketball capture and slam; the Peace Shrine's giant friend; critters joining your team; Easy really being gentler; heroes hitting by themselves.
- **Soak:** bot-vs-bot matches (all ten heroes are bots) on Easy and Normal. Each one must end with a cookie castle knocked down within 30 minutes.
- **Sabotage** proves the checks can fail. Each of these must be caught:
  - nobody can hurt anything: the soak must report a match that never ends;
  - buildings that take no damage: the soak must fail;
  - a companion who forgets to guard: the rules must catch it;
  - a heroic that works before level 10: the rules must catch it.
- **Last run:** rules 29 of 29, sabotage 4 of 4 caught, and 12 of 12 soak matches ended with a castle down (6 seeds each on Easy and Normal).
  - **Easy:** the brothers' team won all 6, in 5.0 to 10.3 minutes, reaching level 10 after 3 to 4.3 minutes.
  - **Normal:** 6.0 to 19.2 minutes, level 10 after 4.2 to 5.4 minutes. The brothers' team won all 6 in this run (the zombies won 1 of 6 in an earlier one): with identical kits on both sides the bots split 7 to 9, so the small edge comes from Luna's boomerang being better at clearing minions than Bolt's zap. A kid playing one of the brothers' heroes evens that out.

**Console hooks** (`window.game`), for the browser:

```js
game.start({ players: ['teddy', 'tommy'], level: 'easy' })  // straight into a match
game.step(2)            // advance 2 s and draw (the Browser pane throttles animation while hidden)
game.state()            // mode, clock, team levels, your hero(es), the companion, the objective, buildings left
game.input(0, { mx: 1, my: 0 })   // hold player 0's stick; game.input(0, null) lets go
game.cast(0, 0)         // player 0 uses ability 1 (3 = the heroic); game.talent(1, 0) picks the right talent
game.buddy()            // call your brother (1 player); game.teamUp(0) is the 2-player team-up
game.xp(500)            // give your team XP; game.obj('ball' | 'shrine') brings the objective now
game.autopilot(true)    // let the bots play your hero too
game.win(0)             // knock down the zombies' castle (game.win(1): theirs wins)
game.freeze(true)       // stop real-time ticking; game.keepAwake() stops the auto-pause when the tab hides
game.check()            // rules and sabotage; game.soak({ level: 'easy', seeds: 2 }) runs the soak in the browser
```

Add `?touch=1` to the address to see the touch controls on a computer.

## Files

```
index.html       page, HUD, title, pause and end screens (CSS inline)
js/title.js      the game's name (HTT.TITLE)
js/sim.js        the rules: map, lanes, buildings, minions, camps, objectives, heroes and abilities, XP, talents, companion, team-up
js/brain.js      the bots (both teams, the title-screen demo, game.autopilot and the soak)
js/check.js      rules, soak and sabotage (browser console and Node)
js/sfx.js        the game's own synth sounds
js/art.js        canvas textures, the map, buildings, minions, critters, heroes, objectives, effects
js/game.js       renderer, camera, the loop, events to effects, HUD, minimap, menus, keys and touch, test hooks
js/keys.js       the ? panel's keys (Kit.help)
js/zh.js         the 中文 words and rules (Kit.lang): page text, toasts, banners, the ? panel and the 3D word bursts
tools/check.js   runs js/check.js in Node (no npm)
kit/             copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); don't edit it here
dist/heroes-tt.html the single-page build
```

## Not verified

- **Sound:** every effect, the fanfare and the music are wired up, but nobody listened in this build.
- **Real touch devices:** touch was tested in the Browser pane with simulated pointer events at phone landscape (740 × 360) and iPad (1024 × 768) sizes with `?touch=1`, in 1 and 2 players. It wasn't tried on a real iPhone or iPad, so how the joystick feels under a real thumb is unknown.
- **Real-time feel:** play was mostly driven with `game.step()` and the autopilot; nobody played a whole match at the keys in real time.
- **Difficulty for the real kids:** the soak proves bot-vs-bot matches always end and that Easy favours the brothers' team; it can't say whether Tommy will find Easy easy, whether 8–10 minutes holds with a kid playing, or whether Teddy will find Normal fun. The numbers at the top of `js/sim.js` are there to tune after they try it.
- **Phone portrait:** the game is laid out for landscape; held upright it works but the camera stands further back.
