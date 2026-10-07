// ═══════════════════════════════════════════════════════════
//  JACKPOT FRENZY — JavaScript
// ═══════════════════════════════════════════════════════════

let jfSpinning=false, jfAuto=false, jfAutoT=null;
let jfSyms=[], jfCols=5;
const JF_ROWS=10;
let jfStatSpins=0,jfStatPaid=0,jfBestWin=0,jfStatSpent=0;
let jfFreeSpins=0,jfMiniSumVal=0;
let jfBet=10, jfMaxBet=10000, jfMinBet=10;
let jfStickyCoins=[];
let jfCauldronMax=5000;
const JF_CELL_W=52, JF_CELL_H=44, JF_CELL_FONT=20;

function initJFUI(table) {
  jfBet=table.config.minBet||10;
  jfMinBet=table.config.minBet||10;
  jfMaxBet=table.config.maxBet||10000;
  jfCauldronMax=5000;
  document.getElementById('jf-bet-input').value=jfBet;
  jfSpinning=false; jfAuto=false; jfFreeSpins=0; jfMiniSumVal=0;
  jfStatSpins=0; jfStatPaid=0; jfBestWin=0; jfStatSpent=0;
  jfStickyCoins=[]; jfCols=5;
  // Preload symboli z obrazkami (przed pierwszym spinem)
  if(!jfSyms.length) {
    jfSyms=[
      {id:'seven',  e:'', img:'/images/jf/seven.png'},
      {id:'bar3',   e:'', img:'/images/jf/bar3.png'},
      {id:'bar2',   e:'', img:'/images/jf/bar2.png'},
      {id:'bar',    e:'', img:'/images/jf/bar.png'},
      {id:'bell',   e:'', img:'/images/jf/bell.png'},
      {id:'grape',  e:'', img:'/images/jf/grape.png'},
      {id:'orange', e:'', img:'/images/jf/orange.png'},
      {id:'cherry', e:'', img:'/images/jf/cherry.png'},
      {id:'coin_g', e:'', img:'/images/jf/coin_g.png', coin:'green'},
      {id:'coin_r', e:'', img:'/images/jf/coin_r.png', coin:'red'},
      {id:'coin_b', e:'', img:'/images/jf/coin_b.png', coin:'blue'},
      {id:'coin_br',e:'', img:'/images/jf/coin_br.png',coin:'bronze',wild:true},
      {id:'silver', e:'', img:'/images/jf/silver.png', sticky:true, wild:true, silver:true},
      {id:'gold',   e:'', img:'/images/jf/gold.png',   sticky:true, wild:true, gold:true},
    ];
  }
  jfBuildGrid(5, false);
  jfUpdateCauldrons({green:0,red:0,blue:0},jfCauldronMax);
  var el=document.getElementById('jf-fs-bar'); if(el){el.classList.remove('show');el.style.display='none';}
  var ms=document.getElementById('jf-mini-sum'); if(ms) ms.classList.remove('show');
  var wl=document.getElementById('jf-win-log'); if(wl) wl.innerHTML='';
  jfRenderChips(table.config.minBet);
  jfUpdateBalance();
  var ab=document.getElementById('jf-auto-btn'); if(ab){ab.textContent='Auto';ab.classList.remove('on');}
  // Przebuduj grid przy resize
  window._jfResizeHandler && window.removeEventListener('resize', window._jfResizeHandler);
  window._jfResizeHandler = function() { if(jfCols) jfBuildGrid(jfCols, false); };
  window.addEventListener('resize', window._jfResizeHandler);
  setTimeout(window._jfResizeHandler, 80); // po pokazaniu ekranu — dopasuj siatkę do faktycznego miejsca
  if(casinoDiscordId) {
    fetch('/api/casino/slot-stats/jackpot_frenzy').then(r=>r.json()).then(d=>{
      if(!d) return;
      jfStatSpins=d.spins||0; jfStatPaid=d.won||0; jfBestWin=d.bestWin||0; jfStatSpent=d.spent||0;
      jfUpdateStats();
    }).catch(()=>{});
  }
}

function jfUpdateBalance() {
  var el=document.getElementById('jf-balance');
  if(el&&casinoWallet) el.textContent=casinoWallet.balance.toLocaleString('pl-PL')+' AT$';
}

function jfSetMax() {
  var v=casinoWallet?Math.min(casinoWallet.balance,jfMaxBet):jfMaxBet;
  jfBet=v; document.getElementById('jf-bet-input').value=v;
}

function jfRenderChips(minBet) {
  var max=jfMaxBet||10000;
  var chips=[minBet,Math.round(max*0.1),Math.round(max*0.5),max]
    .filter(function(v,i,a){return v>0&&a.indexOf(v)===i;});
  var el=document.getElementById('jf-chip-btns'); if(!el) return;
  el.innerHTML=chips.map(function(c){
    var lbl=c>=1000000?(c/1000000).toFixed(c%1000000===0?0:1)+'M':c>=1000?(c/1000).toFixed(c%1000===0?0:1)+'k':c;
    return '<button class="jf-chip" onclick="jfSetBet('+c+')" title="'+c.toLocaleString('pl-PL')+' AT$">'+lbl+'</button>';
  }).join('');
}

function jfSetBet(v) { jfBet=v; var el=document.getElementById('jf-bet-input'); if(el) el.value=v; }

function jfBuildGrid(cols, isDublet) {
  jfCols=cols;
  var g=document.getElementById('jf-grid'); if(!g) return;
  var wrap=document.getElementById('jf-grid-wrap');
  // Oblicz dostępną przestrzeń (3 kolumny: 180px lewa + 160px prawa + 16px gap*2 + 20px padding)
  var availW = (window.innerWidth||1536) - 180 - 160 - 36;
  // Wysokość: viewport - header(42) - kociołki(86) - fs-bar(0/36) - stats(52) - padding(30)
  var availH = (window.innerHeight||900) - 42 - 86 - 52 - 30;
  // Gdy ekran jest widoczny — zmierz faktyczne miejsce na siatkę (telefon w poziomie, inne układy)
  var colEl = document.querySelector('#screen-casino-jf .jf-grid-col');
  if (colEl && colEl.clientHeight > 120 && colEl.clientWidth > 120) { availW = colEl.clientWidth - 4; availH = colEl.clientHeight - 4; }
  var cellByW = Math.floor((availW - cols*2 - 12) / cols);
  var cellByH = Math.floor((availH - 10*2 - 12) / 10);
  var cellSize = Math.max(window.innerHeight < 560 ? 18 : 38, Math.min(cellByW, cellByH, 100));
  var fontSize = Math.max(12, Math.floor(cellSize * 0.48));
  var gridW = cols*cellSize + cols*2 + 12;
  var gridH = 10*cellSize + 10*2 + 12;

  g.style.gridTemplateColumns = 'repeat('+cols+','+cellSize+'px)';
  if(wrap) {
    if(isDublet) {
      // Animacja rozszerzania przy Dublecie
      wrap.style.transition = 'width .5s cubic-bezier(.25,.46,.45,.94)';
      setTimeout(function(){ wrap.style.width = gridW+'px'; wrap.style.height = gridH+'px'; }, 50);
    } else {
      wrap.style.width = gridW+'px';
      wrap.style.height = gridH+'px';
    }
  }

  // Generuj komórki (zachowaj sticky z poprzedniego gridu)
  var existingIds = new Set();
  g.querySelectorAll('.jf-cell').forEach(function(el){ existingIds.add(el.id); });

  g.innerHTML='';
  for(var c=0;c<cols;c++) for(var r=0;r<JF_ROWS;r++) {
    var el=document.createElement('div');
    var isNew = !existingIds.has('jfc'+c+'_'+r);
    el.className='jf-cell' + (isDublet && isNew ? ' dublet-new' : '');
    el.id='jfc'+c+'_'+r;
    el.style.width=cellSize+'px';
    el.style.height=cellSize+'px';
    el.style.fontSize=fontSize+'px';
    if(isDublet && isNew) el.style.animationDelay = (c*0.04)+'s';
    // Wypełnij losowym symbolem od razu
    if(jfSyms.length) {
      var playSyms=jfSyms.filter(function(s){return s.img&&!s.sticky;});
      if(playSyms.length) {
        var rs=playSyms[Math.floor(Math.random()*playSyms.length)];
        el.innerHTML='<img src="'+rs.img+'" alt="'+rs.id+'" style="opacity:.35">';
      }
    }
    g.appendChild(el);
  }
}
function jfAnimateOut(sMap) {
  for(var c=0;c<jfCols;c++) for(var r=0;r<JF_ROWS;r++) {
    if(sMap[c+','+r]) continue;
    var el=document.getElementById('jfc'+c+'_'+r); if(!el) continue;
    el.classList.remove('fall-in','cluster','coin-pop');
    el.classList.add('fall-out');
  }
}

function jfRenderGrid(grid,clusters,stickyCoins,newSticky,animIn) {
  var cSet=new Set(); (clusters||[]).forEach(function(cl){cl.cells.forEach(function(p){cSet.add(p[0]+','+p[1]);});});
  var sMap={}; (stickyCoins||[]).forEach(function(s){sMap[s.col+','+s.row]=s;});
  var nSet=new Set(); (newSticky||[]).forEach(function(s){nSet.add(s.col+','+s.row);});
  for(var c=0;c<jfCols;c++) for(var r=0;r<JF_ROWS;r++) {
    var el=document.getElementById('jfc'+c+'_'+r); if(!el) continue;
    var si=grid[c]&&grid[c][r]!==undefined?grid[c][r]:0;
    var s=jfSyms[si]||{e:'?'};
    var key=c+','+r, sticky=sMap[key];
    el.className='jf-cell';
    var inCluster=cSet.has(key);
    if(sticky) {
      el.className+=sticky.type==='silver'?' sticky-silver':' sticky-gold';
    } else if(inCluster && s.wild) {
      // Wild w klastrze: pomarańczowe podświetlenie żeby widać ścieżkę połączenia
      el.classList.add('cluster-wild');
    } else if(inCluster) {
      el.classList.add('cluster');
    } else if(s.id==='coin_br') {
      el.className+=' coin-bronze';
    } else if(s.coin) {
      el.className+=' coin-'+s.coin;
    }
    if(animIn&&!sticky) { el.classList.add('fall-in'); el.style.animationDelay=(c*0.035)+'s'; }
    else el.style.animationDelay='';
    if(nSet.has(key)) el.classList.add('coin-pop');
    var badge='';
    if(sticky&&sticky.type==='silver'&&sticky.mult) {
      badge='<span class="jf-coin-badge">x'+sticky.mult+'</span>';
      var sImg=jfSyms.find(function(x){return x.id==='silver';});
      el.innerHTML=(sImg&&sImg.img?'<img src="'+sImg.img+'" alt="silver">':'🥈')+badge;
    } else if(sticky&&sticky.type==='gold'&&sticky.jp) {
      var jl2={mini:'Mini',minor:'Minor',major:'Major',mega:'Mega',grand:'GRAND'};
      badge='<span class="jf-coin-badge">'+(jl2[sticky.jp]||sticky.jp)+'</span>';
      var gImg=jfSyms.find(function(x){return x.id==='gold';});
      el.innerHTML=(gImg&&gImg.img?'<img src="'+gImg.img+'" alt="gold">':'🥇')+badge;
    } else if(s.img) {
      el.innerHTML='<img src="'+s.img+'" alt="'+s.id+'">';
    } else {
      el.innerHTML=s.e||'?';
    }
  }
}

function jfUpdateCauldrons(cauldron,max) {
  ['green','red','blue'].forEach(function(color) {
    var pts=cauldron[color]||0, pct=Math.min(100,(pts/max)*100);
    var fill=document.getElementById('jf-fill-'+color); if(fill) fill.style.width=pct+'%';
    var lbl=document.getElementById('jf-pts-'+color); if(lbl) lbl.textContent=pts.toLocaleString('pl-PL')+' / '+max.toLocaleString('pl-PL');
  });
}

function jfUpdateJPDisplay(progressiveJP) {
  var el=document.getElementById('jf-jp-display'); if(!el||!progressiveJP) return;
  var labels={mini:'Mini',minor:'Minor',major:'Major',mega:'Mega',grand:'GRAND'};
  el.innerHTML=Object.entries(progressiveJP).map(function(e){return '<span class="jf-jp-chip">'+labels[e[0]]+': '+Math.round(e[1]).toLocaleString('pl-PL')+'</span>';}).join('');
}

function jfUpdateFSBar(count,active,miniGames) {
  var bar=document.getElementById('jf-fs-bar'); if(!bar) return;
  if(active&&count>0){bar.classList.add('show');bar.style.display='block';}
  else{bar.classList.remove('show');bar.style.display='none';}
  var cnt=document.getElementById('jf-fs-count'); if(cnt) cnt.textContent=count;
  var act=document.getElementById('jf-fs-active'); if(act&&miniGames) {
    var b='';
    if(miniGames.multiplier) b+='<span class="jf-fs-badge green">\uD83C\uDF40 Mn\u00F3\u017Cniki</span>';
    if(miniGames.jackpot)    b+='<span class="jf-fs-badge red">\uD83D\uDCB0 Jackpoty</span>';
    if(miniGames.dublet)     b+='<span class="jf-fs-badge blue">\uD83D\uDC8E Dublet</span>';
    act.innerHTML=b;
  }
}

function jfUpdateMiniSum(sum,show) {
  var el=document.getElementById('jf-mini-sum'); if(!el) return;
  el.classList.toggle('show',show);
  var v=document.getElementById('jf-mini-sum-val'); if(v) v.textContent=sum.toLocaleString('pl-PL')+' AT$';
}

function jfAddWinLog(payout,tier,label) {
  var lg=document.getElementById('jf-win-log'); if(!lg) return;
  var el=document.createElement('div');
  el.className='s5-log-tag '+(tier||'win');
  el.textContent=(label?label+' ':'')+(payout>0?'+'+payout.toLocaleString('pl-PL')+' AT$':'');
  lg.insertBefore(el,lg.firstChild);
  while(lg.children.length>8) lg.removeChild(lg.lastChild);
}

function jfUpdateStats() {
  var si=function(id){return document.getElementById(id);};
  if(si('jf-stat-spins'))  si('jf-stat-spins').textContent=jfStatSpins.toLocaleString('pl-PL');
  if(si('jf-stat-paid'))   si('jf-stat-paid').textContent=jfStatPaid.toLocaleString('pl-PL')+' AT$';
  if(si('jf-stat-best'))   si('jf-stat-best').textContent=jfBestWin>0?jfBestWin.toLocaleString('pl-PL')+' AT$':'—';
  if(si('jf-stat-spent'))  si('jf-stat-spent').textContent=jfStatSpent.toLocaleString('pl-PL')+' AT$';
  updateProfitDisplay('jf-stat-profit',jfStatSpent,jfStatPaid);
}

function jfSpin() {
  if(jfSpinning) return;
  var betEl=document.getElementById('jf-bet-input'); jfBet=parseInt(betEl&&betEl.value)||jfBet;
  if(!casinoTableId||!casinoSocketToken) return showToast('Nie połączono','error');
  jfSpinning=true;
  var btn=document.getElementById('jf-spin-btn'); if(btn){btn.disabled=true;btn.textContent='⏳';}
  var sMap={}; jfStickyCoins.forEach(function(s){sMap[s.col+','+s.row]=s;});
  jfAnimateOut(sMap);
  setTimeout(function(){socket.emit('casinoJFSpin',{tableId:casinoTableId,bet:jfBet,socketToken:casinoSocketToken,discordId:casinoDiscordId});},200);
}

function jfToggleAuto() {
  jfAuto=!jfAuto;
  var b=document.getElementById('jf-auto-btn'); if(b){b.textContent=jfAuto?'■ Stop':'Auto';b.classList.toggle('on',jfAuto);}
  if(jfAuto&&!jfSpinning) jfSpin();
}

socket.on('casinoJFResult',function(data) {
  var grid=data.grid,clusters=data.clusters,payout=data.payout,balance=data.balance;
  var totBet=data.totBet,isFree=data.isFree,miniSpins=data.miniSpins||0;
  var miniWinSum=data.miniWinSum||0,miniGames=data.miniGames,cauldron=data.cauldron;
  var cauldronMax=data.cauldronMax||5000;
  var triggeredCauldrons=data.triggeredCauldrons||[],chainTriggered=data.chainTriggered||[];
  var stickyCoins=data.stickyCoins||[],newSticky=data.newSticky||[];
  var miniEnded=data.miniEnded,multSum=data.multSum||0,jackpotWins=data.jackpotWins||[];
  var finalPayout=data.finalPayout||0,cols=data.cols||5;
  var syms=data.syms,progressiveJP=data.progressiveJP,tier=data.tier||'win';

  if(syms&&syms.length) jfSyms=syms;
  jfStickyCoins=stickyCoins;
  jfCauldronMax=cauldronMax;

  if(cols!==jfCols) jfBuildGrid(cols, cols>jfCols);

  jfRenderGrid(grid,clusters,stickyCoins,newSticky,true);
  jfUpdateCauldrons(cauldron,cauldronMax);
  jfUpdateJPDisplay(progressiveJP);
  jfUpdateFSBar(miniSpins,miniSpins>0,miniGames);
  jfUpdateMiniSum(miniWinSum,miniSpins>0);
  jfUpdateBalance();

  triggeredCauldrons.forEach(function(color) {
    var cld=document.getElementById('jf-cld-'+color);
    if(cld){cld.classList.remove('triggered');void cld.offsetWidth;cld.classList.add('triggered');}
    var names={green:'\uD83C\uDF40 Mn\u00F3\u017Cniki',red:'\uD83D\uDCB0 Jackpoty',blue:'\uD83D\uDC8E Dublet'};
    var msg=(chainTriggered.includes(color)?'⛓️ Chain: ':'🎉 ')+(names[color]||color)+' aktywne!';
    var tiers={green:'big',red:'mega',blue:'big'};
    jfAddWinLog(0,tiers[color]||'big',msg);
  });

  if(payout>0&&!miniEnded) {
    jfAddWinLog(payout,tier,'');
    s5Fireworks(tier);
  }

  jfStatSpins++;
  jfStatPaid+=payout;
  if(payout>jfBestWin) jfBestWin=payout;
  jfStatSpent+=isFree?0:totBet;
  if(casinoWallet) casinoWallet.balance=balance;
  jfUpdateStats();

  if(miniEnded) setTimeout(function(){jfShowReveal(multSum,jackpotWins,finalPayout);},400);

  jfSpinning=false;
  var btn=document.getElementById('jf-spin-btn'); if(btn){btn.disabled=false;btn.textContent='🏆 SPIN';}
  if(jfAuto) jfAutoT=setTimeout(jfSpin,miniSpins>0?500:1200);
});

function jfShowReveal(multSum,jackpotWins,finalPayout) {
  var ov=document.getElementById('jf-reveal-overlay');
  var items=document.getElementById('jf-reveal-items');
  var total=document.getElementById('jf-reveal-total');
  if(!ov) return;
  items.innerHTML='';
  if(multSum>0) {
    var el=document.createElement('div'); el.className='jf-reveal-item';
    el.innerHTML='<div class="ri-icon">\uD83E\uDD48</div><div class="ri-val">x'+multSum+'</div><div class="ri-pos">Łączny mnożnik</div>';
    items.appendChild(el);
  }
  var jl={mini:'Mini',minor:'Minor',major:'Major',mega:'Mega',grand:'GRAND'};
  var jc={mini:'#94a3b8',minor:'#22c55e',major:'#3b82f6',mega:'#a855f7',grand:'#f59e0b'};
  (jackpotWins||[]).forEach(function(jw) {
    var el=document.createElement('div'); el.className='jf-reveal-item';
    el.style.borderColor=jc[jw.jp]||'#fbbf24';
    el.innerHTML='<div class="ri-icon">\uD83E\uDD47</div><div class="ri-val" style="color:'+(jc[jw.jp]||'#fbbf24')+'">'+(jl[jw.jp]||jw.jp)+'</div><div class="ri-pos">'+jw.amount.toLocaleString('pl-PL')+' AT$</div>';
    items.appendChild(el);
  });
  if(total) total.textContent='🎉 +'+finalPayout.toLocaleString('pl-PL')+' AT$';
  ov.classList.add('show');
  var tier2=finalPayout>100000?'giga':finalPayout>10000?'mega':finalPayout>1000?'big':'win';
  jfAddWinLog(finalPayout,tier2,'🏆 Finał');
  addRecentWin('jf-recent-list',finalPayout,tier2);
  s5Fireworks(tier2);
}

function jfCloseReveal() {
  var ov=document.getElementById('jf-reveal-overlay'); if(ov) ov.classList.remove('show');
}

function jfShowInfo() {
  cxModal(`<h3>🏆 Jackpot Frenzy</h3><div class="cx-rules"><ul>
    <li>Cluster Pays: 5+ takich samych symboli stykających się bokami = wygrana (× stawki, rośnie z wielkością klastra).</li>
    <li>Coiny na planszy napełniają kociołki: 🍀 zielony, 💰 czerwony, 💎 niebieski (brązowy coin to Wild i też napełnia niebieski).</li>
    <li>Pełny kociołek = 8 darmowych spinów mini-gry (+20% szansy, że dołączą pozostałe kociołki):
      <ul><li>🍀 <b>Mnożniki</b> — srebrne monety (sticky Wild) z wartością ×1–×200 stawki, wypłacane na koniec.</li>
      <li>💰 <b>Jackpoty</b> — złote monety (sticky Wild), każda wypłaca jackpot Mini/Minor/Major/Mega/Grand.</li>
      <li>💎 <b>Dublet</b> — plansza powiększa się do 10×10 + srebrne monety.</li></ul></li>
    <li>Jackpoty to mnożniki stawki mini-gry (Mini ×3, Minor ×10, Major ×30, Mega ×150, Grand ×750) i rosną progresywnie z każdym płatnym spinem przy stole.</li>
    <li>Stawka mini-gry = średnia stawka, z jaką napełniałeś kociołki.</li>
    <li>RTP ≈ 95%.</li></ul></div>`);
}
