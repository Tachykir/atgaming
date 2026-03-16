// casino-nr.js — Neon Racer (Both Ways + Speed Meter + Turbo)
'use strict';

const NR_ACCESS='12345';
const NR_COLS=5, NR_ROWS=3;
const NR_BET_STEPS=[10,20,50,100,200,500,1000,2000,5000,10000,50000,100000,500000,1000000];

let nrTable=null, nrBetIdx=0, nrLines=20, nrSpinning=false, nrAuto=false, nrAutoT=null;
let nrFreeSpins=0, nrIsTurbo=false, nrTurboLeft=0, nrSpeedMeter=0;
let nrSyms=[], nrLinesD=[], nrUnlocked=false;
let nrStatSpins=0, nrStatPaid=0, nrBestWin=0, nrStatSpent=0;

function initNRUI(table){
  nrTable=table;
  const minBet=table.config.minBet||10;
  nrBetIdx=NR_BET_STEPS.findIndex(v=>v>=minBet); if(nrBetIdx<0)nrBetIdx=0;
  nrLines=20; nrFreeSpins=0; nrIsTurbo=false; nrTurboLeft=0; nrSpeedMeter=0;
  nrSpinning=false; nrAuto=false; nrUnlocked=false;
  nrStatSpins=0; nrStatPaid=0; nrBestWin=0; nrStatSpent=0;
  const nameEl=document.getElementById('nr-name'); if(nameEl)nameEl.textContent=table.name;
  const pw=document.getElementById('nr-pw-overlay'); if(pw)pw.style.display='flex';
  const inp=document.getElementById('nr-pw-input'); if(inp){inp.value='';inp.classList.remove('error');setTimeout(()=>inp.focus(),100);}
  nrUpdateBalance(); nrBuildGrid(); nrUpdateBetUI(); nrUpdateStats();
  nrSetMsg('Podaj hasło aby grać');
  const wl=document.getElementById('nr-win-log'); if(wl)wl.innerHTML='';
  const ab=document.getElementById('nr-auto-btn'); if(ab){ab.classList.remove('on');ab.textContent='Auto';}
  nrUpdateSpeedMeter(0); nrRenderFSBar(); nrRenderTurboBar();
  const ov=document.getElementById('nr-win-ov'); if(ov)ov.classList.remove('show');
  const gs=document.getElementById('nr-game-screen'); if(gs)gs.classList.remove('nr-turbo-active');
  if(casinoDiscordId) loadSlotStats('neon_racer','nr');
}

function nrCheckPw(){
  const inp=document.getElementById('nr-pw-input'); if(!inp)return;
  if(inp.value===NR_ACCESS){
    const ov=document.getElementById('nr-pw-overlay'); if(ov)ov.style.display='none';
    nrUnlocked=true; nrSetMsg('Ustaw zakład i naciśnij Spin 🏎️');
  } else {
    inp.classList.remove('error'); void inp.offsetWidth; inp.classList.add('error');
    inp.value=''; inp.placeholder='Błędne hasło!';
    setTimeout(()=>{inp.placeholder='•••••';inp.focus();},1500);
  }
}

function nrUpdateBalance(){const el=document.getElementById('nr-balance');if(el&&casinoWallet)el.textContent=casinoWallet.balance.toLocaleString('pl-PL')+' AT$';}
function nrGetBet(){return NR_BET_STEPS[Math.min(nrBetIdx,NR_BET_STEPS.length-1)];}
function nrChBet(dir,mode){if(mode==='max')nrBetIdx=NR_BET_STEPS.length-1;else nrBetIdx=Math.max(0,Math.min(NR_BET_STEPS.length-1,nrBetIdx+dir));nrUpdateBetUI();}
function nrChLines(dir,mode){if(mode==='max')nrLines=21;else nrLines=Math.max(1,Math.min(21,nrLines+dir));nrUpdateBetUI();}
function nrUpdateBetUI(){
  const bet=nrGetBet(),tot=bet*nrLines;
  const bv=document.getElementById('nr-bet-val'); if(bv)bv.textContent=bet.toLocaleString('pl-PL')+' AT$';
  const lv=document.getElementById('nr-lines-val'); if(lv)lv.textContent=nrLines;
  const tv=document.getElementById('nr-tot-val'); if(tv)tv.textContent=tot.toLocaleString('pl-PL')+' AT$';
}

function nrBuildGrid(){
  const grid=document.getElementById('nr-reels-grid'); if(!grid)return;
  grid.innerHTML=''; grid.style.cssText='display:grid;grid-template-columns:repeat(5,1fr);gap:4px;';
  for(let c=0;c<NR_COLS;c++){
    const col=document.createElement('div'); col.style.cssText='display:flex;flex-direction:column;gap:4px;';
    for(let r=0;r<NR_ROWS;r++){
      const cell=document.createElement('div'); cell.className='s5-cell'; cell.id=`nrc${c}_${r}`;
      cell.style.cssText='height:66px;font-size:26px;display:flex;align-items:center;justify-content:center;border-radius:8px;'; cell.textContent='🏎️'; col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function nrRenderGrid(grid,syms,winLines){
  if(syms&&syms.length)nrSyms=syms;
  const winCells=new Set(); const lines=nrLinesD;
  if(winLines&&lines.length) winLines.forEach(w=>{const line=lines[w.line];if(line)for(let c=0;c<NR_COLS;c++)winCells.add(`${c},${line[c]}`+(w.dir==='right'?'R':''));});
  // Dla Both Ways zaznaczamy po prostu wygraną komórkę niezależnie od kierunku
  const allWinCells=new Set();
  if(winLines&&lines.length) winLines.forEach(w=>{const line=lines[w.line];if(line){const colOrder=w.dir==='right'?[...Array(NR_COLS).keys()].reverse():[...Array(NR_COLS).keys()];for(let i=0;i<w.count;i++){const c=colOrder[i];allWinCells.add(`${c},${line[c]}`);}}});
  for(let c=0;c<NR_COLS;c++) for(let r=0;r<NR_ROWS;r++){
    const el=document.getElementById(`nrc${c}_${r}`); if(!el)continue;
    const s=nrSyms[grid[c][r]]; if(!s)continue;
    const inWin=allWinCells.has(`${c},${r}`);
    el.className='s5-cell'+(s.wild?' wild':s.scatter?' scatter':inWin?' win':'');
    el.innerHTML=s.e||'?'; el.style.height='66px'; el.style.fontSize='26px';
    el.style.animation=''; void el.offsetWidth; el.style.animation='s5land .18s ease-out both';
    el.style.boxShadow=inWin?'0 0 10px rgba(34,197,94,.7)':'';
  }
}

function nrAnimateSpin(){
  const emojis=['🏎️','🏆','⛑️','🎡','⛽','🏁','🪙','💡','💨'];
  for(let c=0;c<NR_COLS;c++) for(let r=0;r<NR_ROWS;r++){
    const el=document.getElementById(`nrc${c}_${r}`); if(!el)continue;
    el.className='s5-cell spinning'; el.style.boxShadow=''; el.style.animation='';
    el._int=setInterval(()=>{el.textContent=emojis[Math.floor(Math.random()*emojis.length)];},80);
  }
}
function nrStopAnim(){
  for(let c=0;c<NR_COLS;c++) for(let r=0;r<NR_ROWS;r++){
    const el=document.getElementById(`nrc${c}_${r}`); if(el&&el._int){clearInterval(el._int);el._int=null;}
  }
}

function nrUpdateSpeedMeter(pct){
  const fill=document.getElementById('nr-speed-fill'); const pts=document.getElementById('nr-speed-pts');
  const p=Math.min(100,Math.max(0,pct));
  if(fill){
    fill.style.width=p+'%';
    const hue=Math.max(0,120-p*1.2);
    fill.style.background=`hsl(${hue},100%,50%)`;
    if(p>=80) fill.style.boxShadow=`0 0 8px hsl(${hue},100%,50%)`;
    else fill.style.boxShadow='';
  }
  if(pts)pts.textContent=Math.round(p)+'%';
}

function nrAnimateSpeedJump(prev,next){
  // Animuj zmianę metra
  const fill=document.getElementById('nr-speed-fill'); if(!fill)return;
  fill.style.transition='width .6s cubic-bezier(.2,.8,.3,1),background .3s';
  nrUpdateSpeedMeter(next);
  // Jeśli pełny — flash
  if(next>=100||prev<100&&next>=100){
    fill.style.boxShadow='0 0 20px #22c55e';
    setTimeout(()=>fill.style.boxShadow='',800);
  }
}

function nrRenderFSBar(){
  const bar=document.getElementById('nr-fs-bar'); if(!bar)return;
  bar.style.display=nrFreeSpins>0?'flex':'none';
  const cnt=document.getElementById('nr-fs-count'); if(cnt)cnt.textContent=nrFreeSpins;
}
function nrRenderTurboBar(){
  const bar=document.getElementById('nr-turbo-bar'); if(!bar)return;
  bar.style.display=nrIsTurbo?'flex':'none';
  const cnt=document.getElementById('nr-turbo-count'); if(cnt)cnt.textContent=nrTurboLeft;
  const gs=document.getElementById('nr-game-screen');
  if(gs){ if(nrIsTurbo)gs.classList.add('nr-turbo-active'); else gs.classList.remove('nr-turbo-active'); }
}
function nrShowWin(payout,mult,label,tier){
  const ov=document.getElementById('nr-win-ov'); if(!ov)return;
  ov.className='s5-win-ov show s5-ov-'+tier;
  const t=document.getElementById('nr-win-title'); if(t)t.textContent=label;
  const a=document.getElementById('nr-win-amt');   if(a)a.textContent='+'+payout.toLocaleString('pl-PL')+' AT$';
  const m=document.getElementById('nr-win-mult');  if(m)m.textContent=(mult||0).toFixed(1)+'× zakładu';
  setTimeout(()=>{ if(ov.classList.contains('show'))nrDismissWin(); },tier==='frito'?7000:tier==='giga'?5000:3500);
}
function nrDismissWin(){const ov=document.getElementById('nr-win-ov');if(ov)ov.classList.remove('show');}
function nrUpdateStats(){
  const si=id=>document.getElementById(id);
  if(si('nr-stat-spins'))  si('nr-stat-spins').textContent=nrStatSpins.toLocaleString('pl-PL');
  if(si('nr-stat-paid'))   si('nr-stat-paid').textContent=nrStatPaid.toLocaleString('pl-PL')+' AT$';
  if(si('nr-stat-best'))   si('nr-stat-best').textContent=nrBestWin>0?nrBestWin.toLocaleString('pl-PL')+' AT$':'—';
  if(si('nr-stat-spent'))  si('nr-stat-spent').textContent=nrStatSpent.toLocaleString('pl-PL')+' AT$';
  updateProfitDisplay('nr-stat-profit',nrStatSpent,nrStatPaid);
}
function nrSetMsg(txt,cls){const m=document.getElementById('nr-msg');if(m){m.textContent=txt;m.className='s5-msg'+(cls?' '+cls:'');}}
function nrAddWinLog(payout,tier,extra){
  const lg=document.getElementById('nr-win-log'); if(!lg)return;
  const d=document.createElement('div'); d.className='s5-win-log-item '+(tier||'win');
  d.textContent=(extra?extra+' ':'')+( payout>0?'+'+payout.toLocaleString('pl-PL')+' AT$':'');
  lg.insertBefore(d,lg.firstChild); if(lg.children.length>25)lg.removeChild(lg.lastChild);
}

function nrSpin(){
  if(nrSpinning)return;
  if(!nrUnlocked){nrSetMsg('Podaj hasło dostępu!');return;}
  if(!casinoDiscordId){showToast('Zaloguj się przez Discord!','error');return;}
  if(!casinoTableId)return;
  const tot=nrGetBet()*nrLines;
  if(nrFreeSpins===0&&!nrIsTurbo&&casinoWallet&&casinoWallet.balance<tot){nrSetMsg('Za mało AT$!');return;}
  nrSpinning=true;
  const btn=document.getElementById('nr-spin-btn'); if(btn){btn.disabled=true;btn.textContent='⏳';}
  nrAnimateSpin();
  setTimeout(()=>{socket.emit('casinoNRSpin',{tableId:casinoTableId,bet:tot,lines:nrLines,socketToken:casinoSocketToken,discordId:casinoDiscordId,password:NR_ACCESS});},260);
}
function nrToggleAuto(){
  nrAuto=!nrAuto; const b=document.getElementById('nr-auto-btn');
  if(b){b.textContent=nrAuto?'■ Stop':'Auto';b.classList.toggle('on',nrAuto);}
  if(nrAuto&&!nrSpinning)nrSpin();
}

socket.on('casinoNRResult',function(data){
  nrStopAnim();
  const{grid,winLines,payout,balance,totBet,isFree,freeSpinsAwarded,freeSpinsRemaining,
    isTurbo,turboSpinsLeft,turboTriggered,turboMult,speedMeter,previousSpeed,tier,label,syms,lines,nitroSpeedBoost,mult}=data;
  if(syms)nrSyms=syms; if(lines)nrLinesD=lines;
  nrFreeSpins=freeSpinsRemaining||0; nrIsTurbo=isTurbo||false; nrTurboLeft=turboSpinsLeft||0;

  nrRenderGrid(grid,syms,winLines);
  nrAnimateSpeedJump(previousSpeed||0,speedMeter||0);
  nrSpeedMeter=speedMeter||0;
  nrRenderFSBar(); nrRenderTurboBar();

  if(turboTriggered)       nrSetMsg('🏁 TURBO MODE! ×3 Mnożnik!','big');
  else if(isTurbo&&payout>0) nrSetMsg(`🏎️ TURBO ×${turboMult} — +${payout.toLocaleString('pl-PL')} AT$`,'big');
  else if(payout>0)        nrSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);
  else                     nrSetMsg(isFree?`Free Spin — zostało: ${nrFreeSpins}`:'Postaw zakład i zakręć!');

  if(freeSpinsAwarded>0)   nrSetMsg(`💨 ${freeSpinsAwarded} Free Spins!`,'big');

  // Nitro boost animacja
  if(nitroSpeedBoost>0&&!turboTriggered){
    const pts=document.getElementById('nr-speed-pts'); if(pts){
      const orig=pts.textContent; pts.textContent=`+${nitroSpeedBoost}% 💨`;
      pts.style.color='#22c55e'; pts.style.fontWeight='800';
      setTimeout(()=>{pts.textContent=Math.round(nrSpeedMeter)+'%';pts.style.color='';pts.style.fontWeight='';},900);
    }
  }

  if(payout>0&&(tier==='mega'||tier==='huge'||tier==='giga'||tier==='frito')) nrShowWin(payout,mult||0,label||'Win',tier);

  nrStatSpins++; nrStatPaid+=payout; if(payout>nrBestWin)nrBestWin=payout;
  nrStatSpent+=isFree?0:totBet;
  if(casinoWallet)casinoWallet.balance=balance;
  nrUpdateBalance(); nrUpdateStats();
  if(payout>0){nrAddWinLog(payout,tier,isTurbo?'🏁 TURBO':'');s5Fireworks(tier);addRecentWin('nr-recent-list',payout,tier);}
  nrSpinning=false; const btn=document.getElementById('nr-spin-btn'); if(btn){btn.disabled=false;btn.textContent='🏎️ SPIN';}
  if(nrAuto&&nrUnlocked)nrAutoT=setTimeout(nrSpin,nrIsTurbo?700:1200);
});
