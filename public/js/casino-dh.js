// casino-dh.js — Dragon Hoard (Hold & Respin)
'use strict';

const DH_ACCESS = '12345';
const DH_COLS = 4, DH_ROWS = 5;
const DH_BET_STEPS = [10,20,50,100,200,500,1000,2000,5000,10000,50000,100000,500000,1000000];

let dhTable=null, dhBetIdx=0, dhLines=20, dhSpinning=false, dhAuto=false, dhAutoT=null;
let dhFreeSpins=0, dhRespinMode=false, dhRespinsLeft=0, dhLockedGems=[];
let dhSyms=[], dhLinesD=[], dhUnlocked=false;
let dhStatSpins=0, dhStatPaid=0, dhBestWin=0, dhStatSpent=0;

function initDHUI(table) {
  dhTable = table;
  const minBet = table.config.minBet || 10;
  dhBetIdx = DH_BET_STEPS.findIndex(v => v >= minBet);
  if (dhBetIdx < 0) dhBetIdx = 0;
  dhLines=20; dhFreeSpins=0; dhRespinMode=false; dhRespinsLeft=0; dhLockedGems=[];
  dhSpinning=false; dhAuto=false; dhUnlocked=false;
  dhStatSpins=0; dhStatPaid=0; dhBestWin=0; dhStatSpent=0;
  const nameEl = document.getElementById('dh-name');
  if (nameEl) nameEl.textContent = table.name;
  const pw = document.getElementById('dh-pw-overlay');
  if (pw) pw.style.display = 'flex';
  const inp = document.getElementById('dh-pw-input');
  if (inp) { inp.value=''; inp.classList.remove('error'); setTimeout(()=>inp.focus(), 100); }
  dhUpdateBalance(); dhBuildGrid(); dhUpdateBetUI(); dhUpdateStats();
  dhSetMsg('Podaj hasło aby grać');
  const wl = document.getElementById('dh-win-log'); if (wl) wl.innerHTML='';
  const ab = document.getElementById('dh-auto-btn'); if (ab) { ab.classList.remove('on'); ab.textContent='Auto'; }
  dhRenderRespinBar(); dhRenderFSBar(); dhRenderJPDisplay(null);
  const ov = document.getElementById('dh-win-ov'); if (ov) ov.classList.remove('show');
  if (casinoDiscordId) loadSlotStats('dragon_hoard','dh');
}

function dhCheckPw() {
  const inp = document.getElementById('dh-pw-input'); if (!inp) return;
  if (inp.value === DH_ACCESS) {
    const ov = document.getElementById('dh-pw-overlay'); if (ov) ov.style.display='none';
    dhUnlocked = true; dhSetMsg('Ustaw zakład i naciśnij Spin 🐉');
  } else {
    inp.classList.remove('error'); void inp.offsetWidth; inp.classList.add('error');
    inp.value=''; inp.placeholder='Błędne hasło!';
    setTimeout(()=>{ inp.placeholder='•••••'; inp.focus(); }, 1500);
  }
}

function dhUpdateBalance() {
  const el = document.getElementById('dh-balance');
  if (el && casinoWallet) el.textContent = casinoWallet.balance.toLocaleString('pl-PL')+' AT$';
}
function dhGetBet() { return DH_BET_STEPS[Math.min(dhBetIdx, DH_BET_STEPS.length-1)]; }
function dhChBet(dir, mode) {
  if (mode==='max') dhBetIdx=DH_BET_STEPS.length-1;
  else dhBetIdx = Math.max(0, Math.min(DH_BET_STEPS.length-1, dhBetIdx+dir));
  dhUpdateBetUI();
}
function dhChLines(dir, mode) {
  if (mode==='max') dhLines=20; else dhLines=Math.max(1,Math.min(20,dhLines+dir));
  dhUpdateBetUI();
}
function dhUpdateBetUI() {
  const bet=dhGetBet(), tot=bet*dhLines;
  const bv=document.getElementById('dh-bet-val'); if(bv) bv.textContent=bet.toLocaleString('pl-PL')+' AT$';
  const lv=document.getElementById('dh-lines-val'); if(lv) lv.textContent=dhLines;
  const tv=document.getElementById('dh-tot-val'); if(tv) tv.textContent=tot.toLocaleString('pl-PL')+' AT$';
}

function dhBuildGrid() {
  const grid = document.getElementById('dh-reels-grid'); if (!grid) return;
  grid.innerHTML='';
  grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:4px;';
  for (let c=0;c<DH_COLS;c++) {
    const col=document.createElement('div'); col.style.cssText='display:flex;flex-direction:column;gap:4px;';
    for (let r=0;r<DH_ROWS;r++) {
      const cell=document.createElement('div');
      cell.className='s5-cell'; cell.id=`dhc${c}_${r}`;
      cell.style.cssText='height:52px;font-size:22px;display:flex;align-items:center;justify-content:center;border-radius:8px;';
      cell.textContent='🐉'; col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function dhRenderGrid(grid, syms, lockedGems, newGems) {
  if (syms&&syms.length) dhSyms=syms;
  const lockedSet=new Set((lockedGems||[]).map(g=>`${g.col},${g.row}`));
  const newSet=new Set((newGems||[]).map(g=>`${g.col},${g.row}`));
  const gemColors={mini:'#94a3b8',minor:'#22c55e',major:'#3b82f6',grand:'#f59e0b'};
  for (let c=0;c<DH_COLS;c++) for (let r=0;r<DH_ROWS;r++) {
    const el=document.getElementById(`dhc${c}_${r}`); if (!el) continue;
    const key=`${c},${r}`; const s=dhSyms[grid[c][r]]; if (!s) continue;
    const isLocked=lockedSet.has(key); const isNew=newSet.has(key);
    el.className='s5-cell'+(s.wild?' wild':s.scatter?' scatter':'');
    el.innerHTML=s.e||'?'; el.style.height='52px'; el.style.fontSize='22px';
    if (s.gem) {
      const color=gemColors[s.gemTier]||'#ffd200';
      el.style.background=color+'22'; el.style.borderRadius='8px';
      el.style.outline=`${isLocked?3:2}px solid ${color}`;
      if (isLocked) el.classList.add('dh-gem-locked');
      if (isNew) { el.style.animation=''; void el.offsetWidth; el.style.animation='s5land .3s ease-out both'; el.style.boxShadow=`0 0 18px ${color}`; setTimeout(()=>el.style.boxShadow='',500); }
    } else {
      el.style.background=''; el.style.outline=''; el.style.borderRadius='8px'; el.style.boxShadow='';
      el.classList.remove('dh-gem-locked');
      el.style.animation=''; void el.offsetWidth; el.style.animation='s5land .18s ease-out both';
    }
  }
}

function dhAnimateSpin() {
  const lockedSet=new Set(dhLockedGems.map(g=>`${g.col},${g.row}`));
  const emojis=['🐉','👑','⚔️','🛡️','💠','🔷','💎','🌟','🧪','📜'];
  for (let c=0;c<DH_COLS;c++) for (let r=0;r<DH_ROWS;r++) {
    const el=document.getElementById(`dhc${c}_${r}`); if (!el||lockedSet.has(`${c},${r}`)) continue;
    el.className='s5-cell spinning'; el.style.outline=''; el.style.background=''; el.style.boxShadow='';
    el.classList.remove('dh-gem-locked');
    el._int=setInterval(()=>{ el.textContent=emojis[Math.floor(Math.random()*emojis.length)]; },80);
  }
}
function dhStopAnim() {
  for (let c=0;c<DH_COLS;c++) for (let r=0;r<DH_ROWS;r++) {
    const el=document.getElementById(`dhc${c}_${r}`); if(el&&el._int){clearInterval(el._int);el._int=null;}
  }
}

function dhRenderRespinBar() {
  const bar=document.getElementById('dh-respin-bar'); if (!bar) return;
  bar.style.display=dhRespinMode?'flex':'none';
  const cnt=document.getElementById('dh-respin-count'); if(cnt) cnt.textContent=dhRespinsLeft;
}
function dhRenderFSBar() {
  const bar=document.getElementById('dh-fs-bar'); if(!bar) return;
  bar.style.display=dhFreeSpins>0?'flex':'none';
  const cnt=document.getElementById('dh-fs-count'); if(cnt) cnt.textContent=dhFreeSpins;
}
function dhRenderJPDisplay(jackpots) {
  const el=document.getElementById('dh-jp-display'); if(!el) return;
  if (!jackpots) { el.innerHTML=''; return; }
  const tiers={mini:'#94a3b8',minor:'#22c55e',major:'#3b82f6',grand:'#f59e0b'};
  el.innerHTML=Object.entries(jackpots).map(([t,v])=>
    `<div style="background:${tiers[t]}22;border:1px solid ${tiers[t]};border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;color:${tiers[t]}">${t.toUpperCase()} <span style="font-family:'DM Mono',monospace">${v.toLocaleString('pl-PL')}</span></div>`
  ).join('');
}
function dhShowWin(payout,mult,label,tier) {
  const ov=document.getElementById('dh-win-ov'); if(!ov) return;
  ov.className='s5-win-ov show s5-ov-'+tier;
  const t=document.getElementById('dh-win-title'); if(t) t.textContent=label;
  const a=document.getElementById('dh-win-amt');   if(a) a.textContent='+'+payout.toLocaleString('pl-PL')+' AT$';
  const m=document.getElementById('dh-win-mult');  if(m) m.textContent=(mult||0).toFixed(1)+'× zakładu';
  setTimeout(()=>{ if(ov.classList.contains('show')) dhDismissWin(); }, tier==='frito'?7000:tier==='giga'?5000:3500);
}
function dhDismissWin() { const ov=document.getElementById('dh-win-ov'); if(ov) ov.classList.remove('show'); }

function dhUpdateStats() {
  const si=id=>document.getElementById(id);
  if(si('dh-stat-spins'))  si('dh-stat-spins').textContent=dhStatSpins.toLocaleString('pl-PL');
  if(si('dh-stat-paid'))   si('dh-stat-paid').textContent=dhStatPaid.toLocaleString('pl-PL')+' AT$';
  if(si('dh-stat-best'))   si('dh-stat-best').textContent=dhBestWin>0?dhBestWin.toLocaleString('pl-PL')+' AT$':'—';
  if(si('dh-stat-spent'))  si('dh-stat-spent').textContent=dhStatSpent.toLocaleString('pl-PL')+' AT$';
  updateProfitDisplay('dh-stat-profit',dhStatSpent,dhStatPaid);
}
function dhSetMsg(txt,cls) {
  const m=document.getElementById('dh-msg'); if(m){ m.textContent=txt; m.className='s5-msg'+(cls?' '+cls:''); }
}
function dhAddWinLog(payout,tier,extra) {
  const lg=document.getElementById('dh-win-log'); if(!lg) return;
  const d=document.createElement('div'); d.className='s5-win-log-item '+(tier||'win');
  d.textContent=(extra?extra+' ':'')+( payout>0?'+'+payout.toLocaleString('pl-PL')+' AT$':'');
  lg.insertBefore(d,lg.firstChild); if(lg.children.length>25) lg.removeChild(lg.lastChild);
}

function dhSpin() {
  if (dhSpinning) return;
  if (!dhUnlocked) { dhSetMsg('Podaj hasło dostępu!'); return; }
  if (!casinoDiscordId) { showToast('Zaloguj się przez Discord!','error'); return; }
  if (!casinoTableId) return;
  const tot=dhGetBet()*dhLines;
  if (!dhRespinMode&&dhFreeSpins===0&&casinoWallet&&casinoWallet.balance<tot) { dhSetMsg('Za mało AT$!'); return; }
  dhSpinning=true;
  const btn=document.getElementById('dh-spin-btn'); if(btn){btn.disabled=true;btn.textContent='⏳';}
  dhAnimateSpin();
  setTimeout(()=>{ socket.emit('casinoDHSpin',{tableId:casinoTableId,bet:tot,lines:dhLines,socketToken:casinoSocketToken,discordId:casinoDiscordId,password:DH_ACCESS}); },250);
}
function dhToggleAuto() {
  dhAuto=!dhAuto; const b=document.getElementById('dh-auto-btn');
  if(b){b.textContent=dhAuto?'■ Stop':'Auto';b.classList.toggle('on',dhAuto);}
  if(dhAuto&&!dhSpinning) dhSpin();
}

socket.on('casinoDHResult',function(data) {
  dhStopAnim();
  const{grid,winLines,payout,balance,totBet,isFree,freeSpinsAwarded,freeSpinsRemaining,
    isRespin,respinsLeft,respinTriggered,respinEnded,jackpotWins,lockedGems,newGems,
    tier,label,syms,lines,jackpots,mult}=data;
  if(syms) dhSyms=syms; if(lines) dhLinesD=lines;
  dhLockedGems=lockedGems||[]; dhRespinMode=isRespin||false;
  dhRespinsLeft=respinsLeft||0; dhFreeSpins=freeSpinsRemaining||0;
  dhRenderGrid(grid,syms,lockedGems,newGems);
  dhRenderRespinBar(); dhRenderFSBar(); dhRenderJPDisplay(jackpots);
  if(winLines&&winLines.length) winLines.forEach(w=>{ const line=dhLinesD[w.line]; if(!line) return;
    for(let c=0;c<DH_COLS;c++){const el=document.getElementById(`dhc${c}_${line[c]}`); if(el){el.classList.add('win');setTimeout(()=>el.classList.remove('win'),1200);}} });
  if(respinEnded&&jackpotWins&&jackpotWins.length){
    const jlbl={mini:'Mini',minor:'Minor',major:'Major',grand:'🌟 GRAND'};
    const jclr={mini:'win',minor:'big',major:'mega',grand:'frito'};
    jackpotWins.forEach(j=>dhAddWinLog(j.amount,jclr[j.tier]||'mega',`🐉 ${jlbl[j.tier]||j.tier} Jackpot`));
  }
  if(respinTriggered)       dhSetMsg('🔒 Respin Mode! Gemy zablokowane!','big');
  else if(freeSpinsAwarded) dhSetMsg(`🐲 ${freeSpinsAwarded} Free Spins!`,'big');
  else if(isFree&&dhFreeSpins>0) dhSetMsg(`Free Spin — zostało: ${dhFreeSpins}`);
  else if(payout>0) dhSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);
  else dhSetMsg('Postaw zakład i zakręć!');
  if(payout>0&&(tier==='mega'||tier==='huge'||tier==='giga'||tier==='frito')) dhShowWin(payout,mult||0,label||'Win',tier);
  dhStatSpins++; dhStatPaid+=payout; if(payout>dhBestWin)dhBestWin=payout;
  dhStatSpent+=isFree?0:totBet;
  if(casinoWallet) casinoWallet.balance=balance;
  dhUpdateBalance(); dhUpdateStats();
  if(payout>0){dhAddWinLog(payout,tier,isFree?'🆓':'');s5Fireworks(tier);addRecentWin('dh-recent-list',payout,tier);}
  dhSpinning=false; const btn=document.getElementById('dh-spin-btn'); if(btn){btn.disabled=false;btn.textContent='🐉 SPIN';}
  if(dhAuto&&dhUnlocked) dhAutoT=setTimeout(dhSpin,dhRespinMode?600:1200);
});
