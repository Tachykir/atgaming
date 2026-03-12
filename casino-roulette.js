/**
 * RULETKA EUROPEJSKA — STÓŁ KASYNOWY
 */
'use strict';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BETTING_WINDOW = 25;
const countdownTimers = {};

function spin() { return Math.floor(Math.random() * 37); }
function getColor(n) { if (n===0) return 'green'; if (RED_NUMBERS.has(n)) return 'red'; return 'black'; }

function evaluateBet(bet, result) {
  const { type, value } = bet;
  const color = getColor(result);
  if (type==='straight') return value===result ? bet.amount*35 : -bet.amount;
  if (type==='red')      return color==='red'   ? bet.amount   : -bet.amount;
  if (type==='black')    return color==='black' ? bet.amount   : -bet.amount;
  if (type==='odd')      return result>0&&result%2===1 ? bet.amount : -bet.amount;
  if (type==='even')     return result>0&&result%2===0 ? bet.amount : -bet.amount;
  if (type==='low')      return result>=1&&result<=18  ? bet.amount : -bet.amount;
  if (type==='high')     return result>=19&&result<=36 ? bet.amount : -bet.amount;
  if (type==='dozen1')   return result>=1&&result<=12  ? bet.amount*2 : -bet.amount;
  if (type==='dozen2')   return result>=13&&result<=24 ? bet.amount*2 : -bet.amount;
  if (type==='dozen3')   return result>=25&&result<=36 ? bet.amount*2 : -bet.amount;
  if (type==='col1')     return result>0&&result%3===1 ? bet.amount*2 : -bet.amount;
  if (type==='col2')     return result>0&&result%3===2 ? bet.amount*2 : -bet.amount;
  if (type==='col3')     return result>0&&result%3===0 ? bet.amount*2 : -bet.amount;
  return -bet.amount;
}

function startBettingWindow(table, io, seconds=BETTING_WINDOW) {
  clearTimeout(countdownTimers[table.id]);
  table.status = 'betting';
  table.gameState = {
    phase: 'betting', bets: {}, result: null,
    sessionChipsStart: Object.fromEntries((table.players||[]).map(p=>[p.socketId,p.sessionChips])),
  };
  let remaining = seconds;
  emitTableState(table, io);
  io.to('casino:'+table.id).emit('casinoCountdown',{tableId:table.id,seconds:remaining,max:seconds});
  function tick() {
    remaining--;
    io.to('casino:'+table.id).emit('casinoCountdown',{tableId:table.id,seconds:remaining,max:BETTING_WINDOW});
    if (remaining<=0) spinWheel(table,io); else countdownTimers[table.id]=setTimeout(tick,1000);
  }
  countdownTimers[table.id]=setTimeout(tick,1000);
}

function spinWheel(table, io) {
  clearTimeout(countdownTimers[table.id]);
  const gs=table.gameState; if (!gs) return;
  gs.phase='spinning';
  const result=spin(); gs.result=result; gs.color=getColor(result);
  io.to('casino:'+table.id).emit('casinoRouletteSpinning',{tableId:table.id,result,color:gs.color});
  setTimeout(()=>{
    gs.phase='results'; gs.playerResults={};
    table.players.forEach(p=>{
      const bets=gs.bets[p.socketId]||[]; let delta=0;
      bets.forEach(b=>{ delta+=evaluateBet(b,result); });
      p.sessionChips=Math.max(0,p.sessionChips+delta);
      gs.playerResults[p.socketId]={delta,chips:p.sessionChips};
    });
    table.status='results'; emitTableState(table,io);
    setTimeout(()=>endRound(table,io),5000);
  },4000);
}

function handleAction(table, socketId, event, data, io) {
  const gs=table.gameState; if (!gs||gs.phase!=='betting'||event!=='casinoRouletteBet') return;
  const p=table.players.find(p=>p.socketId===socketId); if (!p) return;
  const bet=Math.max(table.config.minBet,Math.min(table.config.maxBet,Number(data.amount)||table.config.minBet));
  if (!gs.bets[socketId]) gs.bets[socketId]=[];
  if (gs.bets[socketId].length>=12) return;
  const total=gs.bets[socketId].reduce((s,b)=>s+b.amount,0);
  if (total+bet>p.sessionChips) return;
  gs.bets[socketId].push({type:data.type,value:data.value,amount:bet});
  emitTableState(table,io);
}

function endRound(table, io) {
  const gs=table.gameState;
  if (table._casino&&gs) table.players.forEach(p=>{ if (!p.discordId) return; const d=p.sessionChips-(gs.sessionChipsStart?.[p.socketId]||0); table._casino.updateBalance(p.discordId,d).catch(()=>{}); table._casino.recordGame(p.discordId).catch(()=>{}); });
  table.players=table.players.filter(p=>p.sessionChips>0); table.round++; table.gameState=null;
  if (table.players.length>0) startBettingWindow(table,io); else { table.status='open'; emitTableState(table,io); }
}

function emitTableState(table, io) {
  const gs=table.gameState;
  io.to('casino:'+table.id).emit('casinoTableState',{table:getTablePublicFull(table),phase:gs?.phase||'idle',bets:gs?.bets||{},result:gs?.result??null,color:gs?.color||null,playerResults:gs?.playerResults||{}});
}

function getTablePublicFull(table) {
  return {id:table.id,game:table.game,name:table.name,config:table.config,status:table.status,round:table.round,players:table.players.map(p=>({socketId:p.socketId,discordId:p.discordId,name:p.name,avatar:p.avatar,sessionChips:p.sessionChips,seatIndex:p.seatIndex})),observerCount:table.observers?.length||0};
}

module.exports = {startBettingWindow,handleAction,endRound,emitTableState,getTablePublicFull,countdownTimers,RED_NUMBERS};
