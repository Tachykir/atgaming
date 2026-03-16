// casino-aa.js — Arcane Academy (Cascading Reels + Multiplier Trail)
'use strict';

const AA_ACCESS = '12345';
const AA_COLS=10, AA_ROWS=10;
const AA_BET_STEPS=[10,20,50,100,200,500,1000,2000,5000,10000,50000,100000,500000,1000000];

let aaTable=null, aaBetIdx=0, aaSpinning=false, aaAuto=false, aaAutoT=null;
let aaFreeSpins=0, aaSyms=[], aaUnlocked=false;
let aaStatSpins=0, aaStatPaid=0, aaBestWin=0, aaStatSpent=0;
let aaCurrentGrid=null;

function initAAUI(table) {
  aaTable=table;
  const minBet=table.config.minBet||10;
  aaBetIdx=AA_BET_STEPS.findIndex(v=>v>=minBet); if(aaBetIdx<0)aaBetIdx=0;
  aaFreeSpins=0; aaSpinning=false; aaAuto=false; aaUnlocked=false; aaCurrentGrid=null;
  aaStatSpins=0; aaStatPaid=0; aaBestWin=0; aaStatSpent=0;
  const nameEl=document.getElementById('aa-name'); if(nameEl)nameEl.textContent=table.name;
  const pw=document.getElementById('aa-pw-overlay'); if(pw)pw.style.display='flex';
  const inp=document.getElementById('aa-pw-input'); if(inp){inp.value='';inp.classList.remove('error');setTimeout(()=>inp.focus(),100);}
  aaUpdateBalance(); aaBuildGrid(); aaUpdateBetUI(); aaUpdateStats();
  aaSetMsg('Podaj hasło aby grać'); aaSetCascadeInfo('','');
  const wl=document.getElementById('aa-win-log'); if(wl)wl.innerHTML='';
  const ab=document.getElementById('aa-auto-btn'); if(ab){ab.classList.remove('on');ab.textContent='Auto';}
  aaRenderFSBar();
  const ov=document.getElementById('aa-win-ov'); if(ov)ov.classList.remove('show');
  if(casinoDiscordId) loadSlotStats('arcane_academy','aa');
}

function aaCheckPw() {
  const inp=document.getElementById('aa-pw-input'); if(!inp)return;
  if(inp.value===AA_ACCESS){
    const ov=document.getElementById('aa-pw-overlay'); if(ov)ov.style.display='none';
    aaUnlocked=true; aaSetMsg('Ustaw zakład i naciśnij Spin 🔮');
  } else {
    inp.classList.remove('error'); void inp.offsetWidth; inp.classList.add('error');
    inp.value=''; inp.placeholder='Błędne hasło!';
    setTimeout(()=>{inp.placeholder='•••••';inp.focus();},1500);
  }
}

function aaUpdateBalance(){const el=document.getElementById('aa-balance');if(el&&casinoWallet)el.textContent=casinoWallet.balance.toLocaleString('pl-PL')+' AT$';}
function aaGetBet(){return AA_BET_STEPS[Math.min(aaBetIdx,AA_BET_STEPS.length-1)];}
function aaChBet(dir,mode){if(mode==='max')aaBetIdx=AA_BET_STEPS.length-1;else aaBetIdx=Math.max(0,Math.min(AA_BET_STEPS.length-1,aaBetIdx+dir));aaUpdateBetUI();}
function aaUpdateBetUI(){const bet=aaGetBet();const bv=document.getElementById('aa-bet-val');if(bv)bv.textContent=bet.toLocaleString('pl-PL')+' AT$';}

function aaBuildGrid(){
  const grid=document.getElementById('aa-reels-grid'); if(!grid)return;
  grid.innerHTML=''; grid.style.cssText='display:grid;grid-template-columns:repeat(10,1fr);gap:3px;';
  for(let c=0;c<AA_COLS;c++){
    const col=document.createElement('div'); col.style.cssText='display:flex;flex-direction:column;gap:3px;';
    for(let r=0;r<AA_ROWS;r++){
      const cell=document.createElement('div'); cell.className='s5-cell'; cell.id=`aac${c}_${r}`;
      cell.style.cssText='height:38px;font-size:16px;display:flex;align-items:center;justify-content:center;border-radius:6px;'; cell.textContent='🔮'; col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function aaRenderGrid(grid,syms,clusterCells,animate){
  if(syms&&syms.length)aaSyms=syms;
  const highlight=new Set((clusterCells||[]).map(([c,r])=>`${c},${r}`));
  for(let c=0;c<AA_COLS;c++) for(let r=0;r<AA_ROWS;r++){
    const el=document.getElementById(`aac${c}_${r}`); if(!el)continue;
    const s=aaSyms[grid[c][r]]; if(!s)continue;
    const inCluster=highlight.has(`${c},${r}`);
    el.className='s5-cell'+(s.wild?' wild':s.scatter?' scatter':inCluster?' win':'');
    el.innerHTML=s.e||'?'; el.style.height='38px'; el.style.fontSize='16px';
    el.style.boxShadow=inCluster?'0 0 12px rgba(168,85,247,.8)':'';
    if(animate&&!inCluster){el.style.animation='';void el.offsetWidth;el.classList.add('aa-cascade-pop');}
    else if(animate&&inCluster){/* highlight stays */}
  }
}

// Animacja znikania komórek klastra
function aaAnimateDisappear(cells, callback){
  cells.forEach(([c,r])=>{
    const el=document.getElementById(`aac${c}_${r}`); if(!el)return;
    el.classList.add('aa-disappearing');
  });
  setTimeout(callback, 220);
}

// Animacja spadających symboli
// Nowe symbole opadają po kaskadzie — grawitacja per kolumna i wiersz
function aaAnimateFall(newGrid, syms){
  if(syms&&syms.length)aaSyms=syms;
  for(let c=0;c<AA_COLS;c++) for(let r=0;r<AA_ROWS;r++){
    const el=document.getElementById(`aac${c}_${r}`); if(!el)continue;
    const s=aaSyms[newGrid[c][r]]; if(!s)continue;
    el.className='s5-cell'+(s.wild?' wild':s.scatter?' scatter':'');
    el.innerHTML=s.e||'?'; el.style.height='38px'; el.style.fontSize='16px';
    el.style.boxShadow='';
    // Opóźnienie: kolumna * 40ms + wiersz * 30ms — spada z góry kolumna po kolumnie
    const delay = c * 40 + r * 30;
    el.style.opacity='0'; el.style.transform='translateY(-24px)'; el.style.transition='none';
    setTimeout(()=>{
      el.style.transition='transform 0.2s cubic-bezier(.25,.46,.45,.94), opacity 0.15s ease';
      el.style.opacity='1'; el.style.transform='translateY(0)';
      setTimeout(()=>{ el.style.transition=''; el.style.transform=''; el.style.opacity=''; }, 220);
    }, delay);
  }
}

// ── ANIMACJA OPADANIA (zamiast spinning) ─────────────────────────
// Symbole wpadają z góry kolumna po kolumnie, każdy wiersz z opóźnieniem
const AA_DROP_SYMS = ['🔮','💫','📚','⭐','🪄','⚗️','🍃','💡'];

function aaAnimateDrop(onDone) {
  const totalCols = AA_COLS;
  let finished = 0;

  for (let c = 0; c < totalCols; c++) {
    const colDelay = c * 55; // każda kolumna startuje 55ms później
    for (let r = 0; r < AA_ROWS; r++) {
      const el = document.getElementById(`aac${c}_${r}`);
      if (!el) continue;
      const rowDelay = colDelay + r * 40; // każdy wiersz w kolumnie 40ms później
      el.className = 's5-cell';
      el.style.boxShadow = '';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-32px)';
      el.style.transition = 'none';
      el.textContent = AA_DROP_SYMS[Math.floor(Math.random() * AA_DROP_SYMS.length)];

      setTimeout(() => {
        el.style.transition = 'transform 0.22s cubic-bezier(.25,.46,.45,.94), opacity 0.18s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';

        // Po ostatnim symbolu całej siatki — wywołaj callback
        if (c === totalCols - 1 && r === AA_ROWS - 1) {
          setTimeout(() => {
            // Reset transitiona żeby nie przeszkadzał dalej
            for (let cc = 0; cc < AA_COLS; cc++) for (let rr = 0; rr < AA_ROWS; rr++) {
              const e = document.getElementById(`aac${cc}_${rr}`);
              if (e) { e.style.transition = ''; e.style.transform = ''; e.style.opacity = ''; }
            }
            if (onDone) onDone();
          }, 250);
        }
      }, rowDelay);
    }
  }
}

function aaStopAnim(){
  for(let c=0;c<AA_COLS;c++) for(let r=0;r<AA_ROWS;r++){
    const el=document.getElementById(`aac${c}_${r}`); if(el&&el._int){clearInterval(el._int);el._int=null;}
  }
}

function aaRenderFSBar(){
  const bar=document.getElementById('aa-fs-bar'); if(!bar)return;
  bar.style.display=aaFreeSpins>0?'flex':'none';
  const cnt=document.getElementById('aa-fs-count'); if(cnt)cnt.textContent=aaFreeSpins;
}
function aaSetCascadeInfo(mult,extra){
  const mb=document.getElementById('aa-cascade-mult'); if(mb)mb.textContent=mult?`×${mult} Mnożnik`:'';
  const inf=document.getElementById('aa-cascade-info'); if(inf)inf.textContent=extra||'';
}
function aaShowWin(payout,mult,label,tier){
  const ov=document.getElementById('aa-win-ov'); if(!ov)return;
  ov.className='s5-win-ov show s5-ov-'+tier;
  const t=document.getElementById('aa-win-title'); if(t)t.textContent=label;
  const a=document.getElementById('aa-win-amt');   if(a)a.textContent='+'+payout.toLocaleString('pl-PL')+' AT$';
  const m=document.getElementById('aa-win-mult');  if(m)m.textContent=(mult||0).toFixed(1)+'× zakładu';
  setTimeout(()=>{ if(ov.classList.contains('show'))aaDismissWin(); },tier==='frito'?7000:tier==='giga'?5000:3500);
}
function aaDismissWin(){const ov=document.getElementById('aa-win-ov');if(ov)ov.classList.remove('show');}
function aaUpdateStats(){
  const si=id=>document.getElementById(id);
  if(si('aa-stat-spins'))  si('aa-stat-spins').textContent=aaStatSpins.toLocaleString('pl-PL');
  if(si('aa-stat-paid'))   si('aa-stat-paid').textContent=aaStatPaid.toLocaleString('pl-PL')+' AT$';
  if(si('aa-stat-best'))   si('aa-stat-best').textContent=aaBestWin>0?aaBestWin.toLocaleString('pl-PL')+' AT$':'—';
  if(si('aa-stat-spent'))  si('aa-stat-spent').textContent=aaStatSpent.toLocaleString('pl-PL')+' AT$';
  updateProfitDisplay('aa-stat-profit',aaStatSpent,aaStatPaid);
}
function aaSetMsg(txt,cls){const m=document.getElementById('aa-msg');if(m){m.textContent=txt;m.className='s5-msg'+(cls?' '+cls:'');}}
function aaAddWinLog(payout,tier,extra){
  const lg=document.getElementById('aa-win-log'); if(!lg)return;
  const d=document.createElement('div'); d.className='s5-win-log-item '+(tier||'win');
  d.textContent=(extra?extra+' ':'')+( payout>0?'+'+payout.toLocaleString('pl-PL')+' AT$':'');
  lg.insertBefore(d,lg.firstChild); if(lg.children.length>25)lg.removeChild(lg.lastChild);
}

function aaSpin(){
  if(aaSpinning)return;
  if(!aaUnlocked){aaSetMsg('Podaj hasło dostępu!');return;}
  if(!casinoDiscordId){showToast('Zaloguj się przez Discord!','error');return;}
  if(!casinoTableId)return;
  const bet=aaGetBet();
  if(aaFreeSpins===0&&casinoWallet&&casinoWallet.balance<bet){aaSetMsg('Za mało AT$!');return;}
  aaSpinning=true; aaSetCascadeInfo('','');
  const btn=document.getElementById('aa-spin-btn'); if(btn){btn.disabled=true;btn.textContent='⏳';}
  // Animacja opadania — emit dopiero po jej zakończeniu
  aaAnimateDrop(() => {
    socket.emit('casinoAASpin',{tableId:casinoTableId,bet,socketToken:casinoSocketToken,discordId:casinoDiscordId,password:AA_ACCESS});
  });
}
function aaToggleAuto(){
  aaAuto=!aaAuto; const b=document.getElementById('aa-auto-btn');
  if(b){b.textContent=aaAuto?'■ Stop':'Auto';b.classList.toggle('on',aaAuto);}
  if(aaAuto&&!aaSpinning)aaSpin();
}

socket.on('casinoAAResult',function(data){
  // Nie ma już interwałów do zatrzymania — animateDrop nie używa setInterval
  const{finalGrid,cascadeLog,totalPayout,cascadeCount,finalMultiplier,balance,totBet,isFree,
    freeSpinsAwarded,freeSpinsRemaining,tier,label,syms,mult}=data;
  if(syms)aaSyms=syms;
  aaFreeSpins=freeSpinsRemaining||0;

  // ── Sekwencja animacji kaskad ──────────────────────────────────
  // Każdy krok: pokaż klastry (highlight) → znikanie → opadanie nowej siatki
  let stepDelay=0;
  const CASCADE_STEP = 950; // ms na jedną kaskadę

  if(cascadeLog && cascadeLog.length > 0){
    // Krok 0: pokaż pierwszą siatkę (już opadała w aaSpin → aaAnimateDrop)
    // Tylko renderuj bez dodatkowej animacji
    setTimeout(()=>{
      aaRenderGrid(cascadeLog[0].grid, syms, [], false);
    }, 0);

    cascadeLog.forEach((step, i) => {
      const allCells = step.clusters.reduce((acc,cl)=>acc.concat(cl.cells),[]);

      // 1. Pokaż podświetlenie klastrów
      setTimeout(()=>{
        aaRenderGrid(step.grid, syms, allCells, false);
        aaSetCascadeInfo(step.mult, `Kaskada ${i+1} — +${step.afterMult.toLocaleString('pl-PL')} AT$`);
        aaSetMsg(`Kaskada ${i+1}  ×${step.mult} — +${step.afterMult.toLocaleString('pl-PL')} AT$`);
        aaAddWinLog(step.afterMult, 'win', `×${step.mult}`);
      }, stepDelay + 200);

      // 2. Animacja znikania klastrów
      setTimeout(()=>{
        aaAnimateDisappear(allCells, ()=>{});
      }, stepDelay + 550);

      // 3. Nowe symbole opadają — używamy aaAnimateFall (grawitacja per kolumna)
      const nextGrid = (i+1 < cascadeLog.length) ? cascadeLog[i+1].grid : finalGrid;
      setTimeout(()=>{
        aaAnimateFall(nextGrid, syms);
      }, stepDelay + 780);

      stepDelay += CASCADE_STEP;
    });
  } else {
    // Brak kaskad — finalGrid już pokazany przez aaAnimateDrop, tylko wyrenderuj
    setTimeout(()=>{ aaRenderGrid(finalGrid, syms, [], false); }, 0);
  }

  // ── Finał po wszystkich kaskadach ─────────────────────────────
  const finDelay = stepDelay + 300;
  setTimeout(()=>{
    aaRenderGrid(finalGrid, syms, [], false);
    aaRenderFSBar(); aaSetCascadeInfo('','');

    if(totalPayout > 0){
      const cascadeInfo = cascadeCount>1 ? ` (${cascadeCount} kaskad ×${finalMultiplier})` : '';
      aaSetMsg(`🎉 ${label||'Win'}${cascadeInfo} — +${totalPayout.toLocaleString('pl-PL')} AT$`, 'big');
      if(cascadeCount>1) aaAddWinLog(totalPayout, tier, `(${cascadeCount}× kaskad)`);
      if(tier==='mega'||tier==='huge'||tier==='giga'||tier==='frito')
        aaShowWin(totalPayout, mult||0, label||'Win', tier);
      s5Fireworks(tier);
      addRecentWin('aa-recent-list', totalPayout, tier);
    } else {
      aaSetMsg(isFree ? `Free Spin — zostało: ${aaFreeSpins}` : 'Postaw zakład i zakręć!');
    }
    if(freeSpinsAwarded > 0) aaSetMsg(`📚 ${freeSpinsAwarded} Free Spins!`, 'big');

    aaStatSpins++; aaStatPaid+=totalPayout;
    if(totalPayout > aaBestWin) aaBestWin=totalPayout;
    aaStatSpent += isFree ? 0 : totBet;
    if(casinoWallet) casinoWallet.balance=balance;
    aaUpdateBalance(); aaUpdateStats();

    aaSpinning=false;
    const btn=document.getElementById('aa-spin-btn');
    if(btn){btn.disabled=false; btn.textContent='🔮 SPIN';}
    if(aaAuto && aaUnlocked) aaAutoT=setTimeout(aaSpin, 1300);
  }, finDelay);
});
