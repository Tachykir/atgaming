// casino-db.js — Dual Blades (Dual Grid + Sync Bonus)
'use strict';

const DB_ACCESS='12345';
const DB_COLS=3, DB_ROWS=3;
const DB_BET_STEPS=[10,20,50,100,200,500,1000,2000,5000,10000,50000,100000,500000,1000000];

let dbTable=null, dbBetIdx=0, dbSpinning=false, dbAuto=false, dbAutoT=null;
let dbFreeSpins=0, dbSyncMeter=0, dbSyms=[], dbLinesD=[], dbUnlocked=false;
let dbStatSpins=0, dbStatPaid=0, dbBestWin=0, dbStatSpent=0;

function initDBUI(table){
  dbTable=table;
  const minBet=table.config.minBet||10;
  dbBetIdx=DB_BET_STEPS.findIndex(v=>v>=minBet); if(dbBetIdx<0)dbBetIdx=0;
  dbFreeSpins=0; dbSyncMeter=0; dbSpinning=false; dbAuto=false; dbUnlocked=false;
  dbStatSpins=0; dbStatPaid=0; dbBestWin=0; dbStatSpent=0;
  const nameEl=document.getElementById('db-name'); if(nameEl)nameEl.textContent=table.name;
  const pw=document.getElementById('db-pw-overlay'); if(pw)pw.style.display='flex';
  const inp=document.getElementById('db-pw-input'); if(inp){inp.value='';inp.classList.remove('error');setTimeout(()=>inp.focus(),100);}
  dbUpdateBalance(); dbBuildGrid('db-left-grid','dbl'); dbBuildGrid('db-right-grid','dbr');
  dbUpdateBetUI(); dbUpdateStats(); dbSetMsg('Podaj hasło aby grać');
  const wl=document.getElementById('db-win-log'); if(wl)wl.innerHTML='';
  const ab=document.getElementById('db-auto-btn'); if(ab){ab.classList.remove('on');ab.textContent='Auto';}
  dbUpdateSyncMeter(0); dbRenderFSBar();
  const fl=document.getElementById('db-sync-flash'); if(fl)fl.classList.remove('active');
  if(casinoDiscordId) loadSlotStats('dual_blades','db');
}

function dbCheckPw(){
  const inp=document.getElementById('db-pw-input'); if(!inp)return;
  if(inp.value===DB_ACCESS){
    const ov=document.getElementById('db-pw-overlay'); if(ov)ov.style.display='none';
    dbUnlocked=true; dbSetMsg('Ustaw zakład i naciśnij Spin ⚔️');
  } else {
    inp.classList.remove('error'); void inp.offsetWidth; inp.classList.add('error');
    inp.value=''; inp.placeholder='Błędne hasło!';
    setTimeout(()=>{inp.placeholder='•••••';inp.focus();},1500);
  }
}

function dbUpdateBalance(){const el=document.getElementById('db-balance');if(el&&casinoWallet)el.textContent=casinoWallet.balance.toLocaleString('pl-PL')+' AT$';}
function dbGetBet(){return DB_BET_STEPS[Math.min(dbBetIdx,DB_BET_STEPS.length-1)];}
function dbChBet(dir,mode){if(mode==='max')dbBetIdx=DB_BET_STEPS.length-1;else dbBetIdx=Math.max(0,Math.min(DB_BET_STEPS.length-1,dbBetIdx+dir));dbUpdateBetUI();}
function dbUpdateBetUI(){const bet=dbGetBet();const bv=document.getElementById('db-bet-val');if(bv)bv.textContent=bet.toLocaleString('pl-PL')+' AT$';}

function dbBuildGrid(containerId,prefix){
  const grid=document.getElementById(containerId); if(!grid)return;
  grid.innerHTML=''; grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:4px;';
  for(let c=0;c<DB_COLS;c++){
    const col=document.createElement('div'); col.style.cssText='display:flex;flex-direction:column;gap:4px;'; col.id=`${prefix}-col-${c}`;
    for(let r=0;r<DB_ROWS;r++){
      const cell=document.createElement('div'); cell.className='s5-cell'; cell.id=`${prefix}c${c}_${r}`;
      cell.style.cssText='height:58px;font-size:24px;display:flex;align-items:center;justify-content:center;border-radius:8px;'; cell.textContent='⚔️'; col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function dbRenderSingleGrid(grid,prefix,syms,wins,shadowCols){
  if(syms&&syms.length)dbSyms=syms;
  const winCells=new Set(); const lines=dbLinesD;
  if(wins&&lines.length) wins.forEach(w=>{const line=lines[w.line];if(line)for(let c=0;c<DB_COLS;c++)winCells.add(`${c},${line[c]}`);});
  const shadowSet=new Set(shadowCols||[]);
  for(let c=0;c<DB_COLS;c++) for(let r=0;r<DB_ROWS;r++){
    const el=document.getElementById(`${prefix}c${c}_${r}`); if(!el)continue;
    const s=dbSyms[grid[c][r]]; if(!s)continue;
    const inWin=winCells.has(`${c},${r}`); const isShadow=shadowSet.has(c);
    el.className='s5-cell'+(s.wild?' wild':s.scatter?' scatter':inWin?' win':'');
    el.innerHTML=s.e||'?'; el.style.height='58px'; el.style.fontSize='24px';
    el.style.animation=''; void el.offsetWidth; el.style.animation='s5land .18s ease-out both';
    if(isShadow){
      // Flash niebieski na całą kolumnę
      const colEl=document.getElementById(`${prefix}-col-${c}`);
      if(colEl){colEl.style.animation='';void colEl.offsetWidth;colEl.classList.add('db-shadow-flash');setTimeout(()=>colEl.classList.remove('db-shadow-flash'),600);}
    }
    el.style.boxShadow=isShadow?'0 0 14px rgba(99,102,241,.9)':inWin?'0 0 8px rgba(255,200,0,.7)':'';
  }
}

function dbAnimateSpin(prefix){
  const emojis=['⚔️','🗡️','✴️','🎭','💨','🌑','🌒','🪙'];
  for(let c=0;c<DB_COLS;c++) for(let r=0;r<DB_ROWS;r++){
    const el=document.getElementById(`${prefix}c${c}_${r}`); if(!el)continue;
    el.className='s5-cell spinning'; el.style.boxShadow=''; el.style.animation='';
    el._int=setInterval(()=>{el.textContent=emojis[Math.floor(Math.random()*emojis.length)];},80);
  }
}
function dbStopAnim(prefix){
  for(let c=0;c<DB_COLS;c++) for(let r=0;r<DB_ROWS;r++){
    const el=document.getElementById(`${prefix}c${c}_${r}`); if(el&&el._int){clearInterval(el._int);el._int=null;}
  }
}

function dbUpdateSyncMeter(val){
  const fill=document.getElementById('db-sync-fill'); const pts=document.getElementById('db-sync-pts');
  if(fill)fill.style.width=Math.min(100,(val/5)*100)+'%';
  if(pts)pts.textContent=`${val} / 5`;
}
function dbRenderFSBar(){
  const bar=document.getElementById('db-fs-bar'); if(!bar)return;
  bar.style.display=dbFreeSpins>0?'flex':'none';
  const cnt=document.getElementById('db-fs-count'); if(cnt)cnt.textContent=dbFreeSpins;
}
function dbFireSyncFlash(){
  const fl=document.getElementById('db-sync-flash'); if(!fl)return;
  fl.classList.remove('active'); void fl.offsetWidth; fl.classList.add('active');
  setTimeout(()=>fl.classList.remove('active'),700);
  // Flash ikony ⚡
  const icon=document.getElementById('db-sync-icon'); if(icon){
    icon.style.transform='scale(2)'; icon.style.color='#6366f1';
    setTimeout(()=>{icon.style.transform='';icon.style.color='';},400);
  }
}
function dbUpdateStats(){
  const si=id=>document.getElementById(id);
  if(si('db-stat-spins'))  si('db-stat-spins').textContent=dbStatSpins.toLocaleString('pl-PL');
  if(si('db-stat-paid'))   si('db-stat-paid').textContent=dbStatPaid.toLocaleString('pl-PL')+' AT$';
  if(si('db-stat-best'))   si('db-stat-best').textContent=dbBestWin>0?dbBestWin.toLocaleString('pl-PL')+' AT$':'—';
  if(si('db-stat-spent'))  si('db-stat-spent').textContent=dbStatSpent.toLocaleString('pl-PL')+' AT$';
  updateProfitDisplay('db-stat-profit',dbStatSpent,dbStatPaid);
}
function dbSetMsg(txt,cls){const m=document.getElementById('db-msg');if(m){m.textContent=txt;m.className='s5-msg'+(cls?' '+cls:'');}}
function dbAddWinLog(payout,tier,extra){
  const lg=document.getElementById('db-win-log'); if(!lg)return;
  const d=document.createElement('div'); d.className='s5-win-log-item '+(tier||'win');
  d.textContent=(extra?extra+' ':'')+( payout>0?'+'+payout.toLocaleString('pl-PL')+' AT$':'');
  lg.insertBefore(d,lg.firstChild); if(lg.children.length>25)lg.removeChild(lg.lastChild);
}

function dbSpin(){
  if(dbSpinning)return;
  if(!dbUnlocked){dbSetMsg('Podaj hasło dostępu!');return;}
  if(!casinoDiscordId){showToast('Zaloguj się przez Discord!','error');return;}
  if(!casinoTableId)return;
  const bet=dbGetBet()*2; // x2 bo dwie siatki
  if(dbFreeSpins===0&&casinoWallet&&casinoWallet.balance<bet){dbSetMsg('Za mało AT$!');return;}
  dbSpinning=true;
  const btn=document.getElementById('db-spin-btn'); if(btn){btn.disabled=true;btn.textContent='⏳';}
  dbAnimateSpin('dbl'); dbAnimateSpin('dbr');
  setTimeout(()=>{socket.emit('casinoDBSpin',{tableId:casinoTableId,bet:dbGetBet(),socketToken:casinoSocketToken,discordId:casinoDiscordId,password:DB_ACCESS});},260);
}
function dbToggleAuto(){
  dbAuto=!dbAuto; const b=document.getElementById('db-auto-btn');
  if(b){b.textContent=dbAuto?'■ Stop':'Auto';b.classList.toggle('on',dbAuto);}
  if(dbAuto&&!dbSpinning)dbSpin();
}

socket.on('casinoDBResult',function(data){
  dbStopAnim('dbl'); dbStopAnim('dbr');
  const{leftGrid,rightGrid,shadowCols,leftWins,rightWins,leftPay,rightPay,
    syncBonus,syncMult,syncMeter,syncFSAwarded,payout,balance,totBet,isFree,
    freeSpinsAwarded,freeSpinsRemaining,tier,label,syms,lines,mult}=data;
  if(syms)dbSyms=syms; if(lines)dbLinesD=lines;
  dbFreeSpins=freeSpinsRemaining||0; dbSyncMeter=syncMeter||0;
  dbRenderSingleGrid(leftGrid,'dbl',dbSyms,leftWins,shadowCols);
  dbRenderSingleGrid(rightGrid,'dbr',dbSyms,rightWins,shadowCols);
  dbUpdateSyncMeter(dbSyncMeter); dbRenderFSBar();
  if(syncBonus) dbFireSyncFlash();
  if(syncBonus&&payout>0)      dbSetMsg(`⚡ SYNC BONUS ×${syncMult} — +${payout.toLocaleString('pl-PL')} AT$`,'big');
  else if(payout>0)             dbSetMsg(`+${payout.toLocaleString('pl-PL')} AT$`);
  else                          dbSetMsg(isFree?`Free Spin — zostało: ${dbFreeSpins}`:'Postaw zakład i zakręć!');
  if(freeSpinsAwarded>0||syncFSAwarded>0) dbSetMsg(`⚡ ${freeSpinsAwarded||syncFSAwarded} Free Spins!`,'big');
  dbStatSpins++; dbStatPaid+=payout; if(payout>dbBestWin)dbBestWin=payout;
  dbStatSpent+=isFree?0:totBet;
  if(casinoWallet)casinoWallet.balance=balance;
  dbUpdateBalance(); dbUpdateStats();
  if(payout>0){dbAddWinLog(payout,tier,syncBonus?'⚡ SYNC':'');s5Fireworks(tier);addRecentWin('db-recent-list',payout,tier);}
  dbSpinning=false; const btn=document.getElementById('db-spin-btn'); if(btn){btn.disabled=false;btn.textContent='⚔️ SPIN';}
  if(dbAuto&&dbUnlocked)dbAutoT=setTimeout(dbSpin,1200);
});
