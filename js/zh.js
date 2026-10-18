/* 中文 for Heroes TT: the words on the page, the toasts, the banners, the end screen and the ? panel (Kit.lang,
   from kit/lang.js). The word bursts drawn in 3D (BONK!, SAVED!, SLAM DUNK!...) go through Kit.lang.t() in js/art.js.
   The kids' names, the heroes' names (ZOOM, LUNA, ZOMBO...) and the game's name (HEROES TT) stay in English on purpose. */
(function () {
  const L = Kit.lang;
  const t = (en) => L.t(en);
  const list = (o) => Object.keys(o).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY & TOMMY', 'TEDDY + TOMMY', 'HEROES TT', 'Heroes TT', 'TT', 'Claude Code',
    'ZOOM', 'LUNA', 'BRUNO', 'BOLT', 'ZOMBO', 'GOOEY', 'ZIPPY', 'CLANK', 'Esc',
    `${HTT.TITLE} · Teddy & Tommy`, HTT.TITLE]);

  const ABILITIES = {
    'JAB + STRAIGHT': '刺拳 + 直拳', 'JUMP SHOT': '跳投', DASH: '冲刺', 'SLAM DUNK': '灌篮',
    'PEACE WAVE': '比耶冲击波', 'HUG SHIELD': '抱抱护盾', 'SLEEPY BUBBLES': '瞌睡泡泡', 'BIG Y': '大大的 Y',
    'ZIP KICK': '闪电踢', 'ZOOM!': '加速！', 'SKATE DASH': '滑板冲刺', TORNADO: '龙卷风',
    'MOON BOOMERANG': '月亮回旋镖', 'STAR SHOWER': '流星雨', 'MOON HOP': '月亮跳', 'FULL MOON': '满月',
    'BEAR SWIPE': '熊掌拍', 'BIG ROAR': '大吼一声', 'HONEY ARMOR': '蜂蜜盔甲', 'BELLY FLOP': '肚皮砸',
    'ZOMBIE SWIPES': '僵尸乱抓', 'GOO BALL': '黏液球', 'SHAMBLE RUSH': '僵尸猛冲', 'BIG BELLY BOUNCE': '大肚皮弹',
    'GOO SPLASH': '黏液飞溅', 'SLIME SHIELD': '史莱姆护盾', 'STICKY PUDDLE': '黏黏水坑', 'GOO FORT': '黏液城堡',
    'ZIPPY SLAP': '快手拍', 'ZIP!': '嗖！', 'ROLLER RUSH': '轮滑冲刺', 'ZOMBIE DANCE': '僵尸舞',
    'ZAP!': '电一下！', 'STATIC FIELD': '静电场', 'ROCKET BOOTS': '火箭靴', 'ROBO BEAM': '机器人光束',
    'CLANK PUNCH': '铁拳', 'BONK WAVE': '咚咚波', 'TIN ARMOR': '铁皮盔甲', 'GROUND POUND': '震地拳',
  };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const OBJ = { 'GOLDEN BASKETBALL': '金色篮球', 'PEACE SHRINE': '和平神殿' };

  const words = {
    // the 3D word bursts
    'JAB!': '刺拳！', 'WHACK!': '啪！', 'POW!': '砰！', 'BOOM!': '轰！', 'POP!': '噗！', 'BONK!': '咚！', 'CRUMBS!': '碎成渣！',
    'CRUMBLE!': '倒啦！', 'SAVED!': '救到啦！', 'HIGH FIVE!': '击掌！', 'TEAM-UP!': '兄弟合体！', 'SLAM!': '砸！',
    // HUD
    'TEAM TT': 'TT 队', ZOMBIES: '僵尸队', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'LEVEL UP! PICK ONE:': '升级啦！选一个：',
    BRUISER: '拳击手', HELPER: '小帮手', SPEEDY: '飞毛腿', SHOOTER: '射手', TANK: '坦克',
    STRONG: '力气大', 'hit 25% harder': '打得更重', TOUGH: '更结实', '25% more health': '血量更多',
    QUICK: '更快', 'abilities come back faster': '技能冷却更快', 'run faster': '跑得更快',
    'COOKIE MUNCH': '吃饼干', 'heal when you bonk someone': '打晕对手时回血', 'SUPER ARMOR': '超级盔甲', 'get hurt less': '受伤更少',
    'BOTH TEAMS ARE THERE!': '两队都在抢！', 'LV 10': '10 级',
    // title screen
    "A team battle arena! Knock down the zombies' cookie castle!": '团队对战竞技场！推倒僵尸的饼干城堡！',
    '1 player · key 1': '单人 · 按 1', '1 player · key 2': '单人 · 按 2', '2 players together · key 3': '双人一起玩 · 按 3',
    '🐣 EASY': '🐣 简单', 'more health, slow zombies': '血量多，僵尸慢', '🔥 NORMAL': '🔥 普通', 'for big kids': '大孩子玩',
    Difficulty: '难度', 'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'walk (you hit by yourself)': '走（会自动打）', 'abilities · heroic (level 10)': '技能 · 大招（10 级）',
    'call your brother · team-up': '叫兄弟 · 兄弟合体', 'pick a talent': '选天赋',
    "Put your thumb down on the left and push to walk (you hit by yourself). The round buttons are your abilities, and your brother's face calls him in.":
      '左边按住拇指推一推就能走（会自动打）。圆形按钮是技能，点兄弟的脸就能叫他来。',
    // pause and end
    '↻ START AGAIN': '↻ 重新开始', 'P · Esc · Space to resume · R start again · Q menu · M sound': 'P · Esc · 空格 继续 · R 重新开始 · Q 回菜单 · M 声音',
    'OH NO!': '哎呀！', '↻ PLAY AGAIN': '↻ 再玩一次', 'Enter play again · Esc menu': '回车 再玩一次 · Esc 回菜单',
    "You knocked down the zombies' cookie castle!": '你推倒了僵尸的饼干城堡！',
    'The zombies munched our cookie castle. Try again!': '僵尸把我们的饼干城堡吃掉了。再试一次！',
    '⏱️ time': '⏱️ 时间', '⭐ level': '⭐ 等级', '💥 bonks': '💥 打晕', '🏰 buildings knocked down': '🏰 推倒的建筑',
    '🏀 objectives': '🏀 抢到的宝物', '🐻 critter camps': '🐻 小动物营地',
    // toasts and banners
    'KNOCK DOWN THE COOKIE CASTLE!': '推倒饼干城堡！',
    'Walk down a lane with your minions. You hit by yourself!': '跟着小兵沿着路走。你会自动打！',
    "The zombies' cookie castle is crumbs!": '僵尸的饼干城堡碎成渣啦！', 'The zombies got our cookie castle!': '僵尸抢走了我们的饼干城堡！',
    'Their minions come out BIG in that lane!': '那条路上他们的小兵会变大！', 'Your minions come out BIG in that lane!': '那条路上你的小兵会变大！',
    'The castle has a shield! Knock down a fort first.': '城堡有护盾！先推倒一座堡垒。',
    'LEVEL 10!': '10 级啦！', 'HEROIC READY: press R': '大招准备好了：按 R', 'HEROIC READY: press R or I': '大招准备好了：按 R 或 I',
    'The zombies are level 10 too!': '僵尸也 10 级了！', 'LEVEL UP! PICK A TALENT': '升级啦！选一个天赋',
    'Go to the middle and stand next to it!': '去地图中间，站在它旁边！',
    'GOLDEN SLAM!': '金色灌篮！', 'Golden balls bonk the zombie towers!': '金色篮球砸向僵尸的塔！',
    'PEACE PARADE!': '和平大游行！', 'A giant teddy bear marches with you!': '一只巨大的泰迪熊和你一起前进！',
    'The zombies got the golden ball!': '僵尸抢到了金色篮球！', 'A giant robot marches for the zombies!': '一个巨大的机器人帮僵尸前进！',
    'OH NO! THEY KNOCKED DOWN OUR TOWER!': '哎呀！他们推倒了我们的塔！', 'OH NO! THEY KNOCKED DOWN OUR FORT!': '哎呀！他们推倒了我们的堡垒！',
    'YOU KNOCKED DOWN A ZOMBIE TOWER!': '你推倒了僵尸的塔！', 'YOU KNOCKED DOWN A ZOMBIE FORT!': '你推倒了僵尸的堡垒！',
    // the ? panel
    'walk (you hit by yourself) ': '走（会自动打）', abilities: '技能', 'heroic (from level 10)': '大招（10 级起）',
    'title: Teddy · Tommy · both · easy': '标题页：Teddy · Tommy · 双人 · 简单',
    'Playing alone, both sets of keys work, and T or Enter calls your brother as often as you like.': '一个人玩时两套按键都能用，T 或回车随时都能叫兄弟来，想叫几次都行。',
    "Put your thumb down on the left and push to walk. The round buttons are your abilities (the big one first), and your brother's face calls him. Two players: each uses their own half.":
      '左边按住拇指推一推就能走。圆形按钮是技能（大的那个先用），点兄弟的脸就能叫他来。两个人玩：各用屏幕的一半。',
  };
  L.add(Object.assign({}, ABILITIES, OBJ, words));
  for (const [en, zh] of Object.entries(ABILITIES)) L.add({ [en.replace(/!$/, '') + '!']: zh.replace(/！$/, '') + '！' });

  L.rule(/^LEVEL (\d+)$/, '$1 级');
  L.rule(/^TEAM TT: LEVEL (\d+)!$/, 'TT 队升到 $1 级啦！');
  L.rule(/^CALL (\w+)$/, '叫 $1');
  L.rule(/^(\w+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(\w+) WOKE YOU UP!$/, '$1 把你叫醒啦！');
  L.rule(/^(\w+) TAKES A NAP!$/, '$1 去睡午觉啦！');
  L.rule(/^Call (\w+) to wake up!$/, '叫 $1 来叫醒你！');
  L.rule(/^BONKED (\w+)!$/, '打晕了 $1！');
  L.rule(/^💤 (\d+)$/, '💤 $1');
  L.rule(/^🛡️ saves by (\w+)$/, '🛡️ $1 帮你挡住');
  L.rule(new RegExp(`^(\\S+) (${list(TREAT)}) FROM (\\w+)!$`), (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(new RegExp(`^(\\S+) (${list(OBJ)})!$`), (m, e, o) => `${e} ${OBJ[o]}！`);
  L.rule(new RegExp(`^(\\S+) (${list(OBJ)}) SOON!$`), (m, e, o) => `${e} ${OBJ[o]}快出现了！`);
  L.rule(new RegExp(`^(\\S+) (${list(OBJ)}) IN (\\d+)$`), (m, e, o, n) => `${e} ${OBJ[o]}还有 ${n} 秒`);
  L.rule(/^(\S+) BOTH TEAMS ARE THERE!$/, '$1 两队都在抢！');
  L.rule(/^A GIANT (TEDDY BEAR|ROBOT) MARCHES DOWN THE (TOP|BOTTOM) LANE!$/, (m, who, lane) => `${who === 'ROBOT' ? '巨型机器人' : '巨型泰迪熊'}沿着${lane === 'TOP' ? '上路' : '下路'}前进！`);
  L.rule(/^THE (BEAR CUBS|ROBOT DOGS) JOINED (YOUR TEAM|THE ZOMBIES)!$/, (m, who, team) => `${who === 'BEAR CUBS' ? '小熊们' : '机器狗们'}加入了${team === 'YOUR TEAM' ? '你的队伍' : '僵尸队'}！`);
  void t;
})();
