import { HandHistoryRecord, PlayerHandActionLog, PlayerSessionStats } from '../types/poker';
import { Language } from './translations';

export interface PlayerStyleClassification {
  style: PlayerSessionStats['playerStyle'];
  label: string;
  desc: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

/**
 * Classifies a poker player style based on standard HUD thresholds:
 * - NIT (Rock): VPIP < 18%, PFR < 14%
 * - TAG (Tight Aggressive): VPIP 18-26%, PFR 14-23%, AF >= 2.0
 * - LAG (Loose Aggressive): VPIP 27-40%, PFR 20-35%, AF >= 2.0
 * - FISH / LP (Loose Passive): VPIP > 28%, PFR < 15%, AF < 1.6
 * - MANIAC: VPIP > 42%, PFR > 32%, AF >= 3.0
 * - BALANCED: Standard / Developing sample
 */
export function classifyPlayerStyle(
  vpip: number,
  pfr: number,
  af: number,
  totalHands: number,
  lang: Language = 'az'
): PlayerStyleClassification {
  if (totalHands < 3) {
    return {
      style: 'BALANCED',
      label: lang === 'az' ? 'Yığılır (Nümunə azdır)' : 'Sampling',
      desc: lang === 'az' ? 'Dəqiq stil təyini üçün ən azı 3-5 əl oynanmalıdır.' : 'Needs 3+ hands to classify accurately.',
      badgeBg: 'bg-zinc-800/80',
      badgeBorder: 'border-zinc-700',
      badgeText: 'text-zinc-300',
    };
  }

  if (vpip > 42 && pfr > 30 && (af >= 3.0 || af === Infinity)) {
    return {
      style: 'MANIAC',
      label: lang === 'az' ? 'Maniak (Həddən artıq aqressiv)' : 'Maniac (Hyper Aggressive)',
      desc: lang === 'az' ? 'Demək olar ki hər ələ girir və fasiləsiz artırır/blef edir.' : 'Plays almost every hand with extreme aggression and high bluff frequency.',
      badgeBg: 'bg-red-500/20',
      badgeBorder: 'border-red-500/50',
      badgeText: 'text-red-400',
    };
  }

  if (vpip > 28 && pfr < 15 && af < 1.8) {
    return {
      style: 'FISH',
      label: lang === 'az' ? 'Loose Passive (Calling Station)' : 'Loose Passive (Calling Station)',
      desc: lang === 'az' ? 'Çox sayda ələ girir, lakin nadir hallarda artırır; tez-tez call edir.' : 'Enters many pots passively and calls down frequently with weak holdings.',
      badgeBg: 'bg-blue-500/20',
      badgeBorder: 'border-blue-500/50',
      badgeText: 'text-blue-400',
    };
  }

  if (vpip >= 27 && vpip <= 42 && pfr >= 19 && (af >= 2.0 || af === Infinity)) {
    return {
      style: 'LAG',
      label: lang === 'az' ? 'LAG (Loose Aggressive)' : 'LAG (Loose Aggressive)',
      desc: lang === 'az' ? 'Geniş kart diapazonu ilə cəsarətli və aqressiv təzyiq göstərir.' : 'Plays a wide range with high aggression and pressure.',
      badgeBg: 'bg-amber-500/20',
      badgeBorder: 'border-amber-500/50',
      badgeText: 'text-amber-400',
    };
  }

  if (vpip >= 17 && vpip <= 27 && pfr >= 13 && (af >= 1.8 || af === Infinity)) {
    return {
      style: 'TAG',
      label: lang === 'az' ? 'TAG (Tight Aggressive)' : 'TAG (Tight Aggressive)',
      desc: lang === 'az' ? 'Klassik peşəkar stil: yalnız güclü kartları seçir və aqressiv oynayır.' : 'Solid professional archetype: selective pre-flop and assertive post-flop.',
      badgeBg: 'bg-emerald-500/20',
      badgeBorder: 'border-emerald-500/50',
      badgeText: 'text-emerald-400',
    };
  }

  if (vpip < 18) {
    return {
      style: 'NIT',
      label: lang === 'az' ? 'Nit / Rock (Həddən artıq qapalı)' : 'Nit / Rock (Ultra Tight)',
      desc: lang === 'az' ? 'Yalnız ən yüksək premium kartlarla oyuna daxil olur.' : 'Extremely conservative: enters only with top premium starting hands.',
      badgeBg: 'bg-purple-500/20',
      badgeBorder: 'border-purple-500/50',
      badgeText: 'text-purple-400',
    };
  }

  return {
    style: 'BALANCED',
    label: lang === 'az' ? 'Balanslı / Standart' : 'Balanced / Standard',
    desc: lang === 'az' ? 'Mülayim passiv-aqressiv balanslaşdırılmış oyun tərzi.' : 'Moderate, balanced decision profile across streets.',
    badgeBg: 'bg-zinc-800/80',
    badgeBorder: 'border-zinc-700',
    badgeText: 'text-zinc-300',
  };
}

/**
 * Calculates complete PlayerSessionStats for a specific player from HandHistoryRecord[]
 */
export function calculatePlayerSessionStats(
  history: HandHistoryRecord[],
  targetPlayerId: string,
  fallbackName: string = 'Player',
  isHuman: boolean = true,
  lang: Language = 'az'
): PlayerSessionStats {
  let totalHands = 0;
  let vpipHands = 0;
  let pfrHands = 0;
  let handsWon = 0;
  let sawFlopCount = 0;
  let sawShowdownCount = 0;
  let netProfit = 0;

  let totalPostflopBets = 0;
  let totalPostflopRaises = 0;
  let totalPostflopCalls = 0;
  let totalPostflopChecks = 0;

  const streetBreakdown = {
    flop: { bets: 0, raises: 0, calls: 0, checks: 0, af: 0 },
    turn: { bets: 0, raises: 0, calls: 0, checks: 0, af: 0 },
    river: { bets: 0, raises: 0, calls: 0, checks: 0, af: 0 },
  };

  let playerName = fallbackName;
  let playerAvatar = '';

  for (const hand of history) {
    // 1. Check if detailed playerActionLogs exists
    const log: PlayerHandActionLog | undefined = hand.playerActionLogs?.[targetPlayerId];

    if (log) {
      totalHands++;
      playerName = log.playerName || playerName;
      playerAvatar = log.avatar || playerAvatar;

      if (log.vpip) vpipHands++;
      if (log.pfr) pfrHands++;
      if (log.sawFlop) sawFlopCount++;
      if (log.sawShowdown) sawShowdownCount++;
      if (log.isWinner) handsWon++;

      netProfit = Number((netProfit + (log.profit || 0)).toFixed(2));

      // Flop
      streetBreakdown.flop.bets += log.flopBets || 0;
      streetBreakdown.flop.raises += log.flopRaises || 0;
      streetBreakdown.flop.calls += log.flopCalls || 0;
      streetBreakdown.flop.checks += log.flopChecks || 0;

      // Turn
      streetBreakdown.turn.bets += log.turnBets || 0;
      streetBreakdown.turn.raises += log.turnRaises || 0;
      streetBreakdown.turn.calls += log.turnCalls || 0;
      streetBreakdown.turn.checks += log.turnChecks || 0;

      // River
      streetBreakdown.river.bets += log.riverBets || 0;
      streetBreakdown.river.raises += log.riverRaises || 0;
      streetBreakdown.river.calls += log.riverCalls || 0;
      streetBreakdown.river.checks += log.riverChecks || 0;

      totalPostflopBets += (log.flopBets || 0) + (log.turnBets || 0) + (log.riverBets || 0);
      totalPostflopRaises += (log.flopRaises || 0) + (log.turnRaises || 0) + (log.riverRaises || 0);
      totalPostflopCalls += (log.flopCalls || 0) + (log.turnCalls || 0) + (log.riverCalls || 0);
      totalPostflopChecks += (log.flopChecks || 0) + (log.turnChecks || 0) + (log.riverChecks || 0);
    } else if (isHuman && (hand.playerCards?.length || 0) > 0) {
      // Fallback for legacy hands where detailed logs weren't captured for Hero
      totalHands++;
      const isWinner = hand.winners?.some(w => w.name === fallbackName || (hand.playerProfit && hand.playerProfit > 0));
      if (isWinner) handsWon++;
      netProfit = Number((netProfit + (hand.playerProfit || 0)).toFixed(2));

      // Heuristic estimation: if profit differs from fold or community cards reached
      const reachedFlop = (hand.communityCards?.length || 0) >= 3;
      if (reachedFlop) sawFlopCount++;
      if ((hand.communityCards?.length || 0) === 5) sawShowdownCount++;
      
      // If invested more than 0, assume VPIP
      if (hand.playerProfit !== 0 || reachedFlop) {
        vpipHands++;
      }
      if (hand.playerProfit && hand.playerProfit > (hand.pot * 0.4)) {
        pfrHands++;
        totalPostflopBets += 1;
      }
    }
  }

  // Calculate street-level AFs
  streetBreakdown.flop.af = streetBreakdown.flop.calls > 0
    ? Number(((streetBreakdown.flop.bets + streetBreakdown.flop.raises) / streetBreakdown.flop.calls).toFixed(2))
    : (streetBreakdown.flop.bets + streetBreakdown.flop.raises > 0 ? Infinity : 0);

  streetBreakdown.turn.af = streetBreakdown.turn.calls > 0
    ? Number(((streetBreakdown.turn.bets + streetBreakdown.turn.raises) / streetBreakdown.turn.calls).toFixed(2))
    : (streetBreakdown.turn.bets + streetBreakdown.turn.raises > 0 ? Infinity : 0);

  streetBreakdown.river.af = streetBreakdown.river.calls > 0
    ? Number(((streetBreakdown.river.bets + streetBreakdown.river.raises) / streetBreakdown.river.calls).toFixed(2))
    : (streetBreakdown.river.bets + streetBreakdown.river.raises > 0 ? Infinity : 0);

  // Overall calculations
  const vpipPercent = totalHands > 0 ? Number(((vpipHands / totalHands) * 100).toFixed(1)) : 0;
  const pfrPercent = totalHands > 0 ? Number(((pfrHands / totalHands) * 100).toFixed(1)) : 0;
  
  const isAfInfinite = totalPostflopCalls === 0 && (totalPostflopBets + totalPostflopRaises) > 0;
  const aggressionFactor = totalPostflopCalls > 0
    ? Number(((totalPostflopBets + totalPostflopRaises) / totalPostflopCalls).toFixed(2))
    : (isAfInfinite ? Infinity : 0);

  const totalActions = totalPostflopBets + totalPostflopRaises + totalPostflopCalls + totalPostflopChecks;
  const aggressionFrequency = totalActions > 0
    ? Number((((totalPostflopBets + totalPostflopRaises) / totalActions) * 100).toFixed(1))
    : 0;

  const wtsdPercent = sawFlopCount > 0 ? Number(((sawShowdownCount / sawFlopCount) * 100).toFixed(1)) : 0;
  const winRatePercent = totalHands > 0 ? Number(((handsWon / totalHands) * 100).toFixed(1)) : 0;

  const styleClass = classifyPlayerStyle(vpipPercent, pfrPercent, aggressionFactor, totalHands, lang);

  return {
    playerId: targetPlayerId,
    playerName,
    avatar: playerAvatar,
    isHuman,
    totalHands,
    vpipHands,
    pfrHands,
    vpipPercent,
    pfrPercent,
    totalPostflopBets,
    totalPostflopRaises,
    totalPostflopCalls,
    totalPostflopChecks,
    aggressionFactor,
    isAfInfinite,
    aggressionFrequency,
    sawFlopCount,
    sawShowdownCount,
    wtsdPercent,
    handsWon,
    winRatePercent,
    netProfit,
    playerStyle: styleClass.style,
    styleLabel: styleClass.label,
    styleDescription: styleClass.desc,
    streetBreakdown,
  };
}

/**
 * Gathers all unique players present in the session history and computes stats for each.
 */
export function getAllSessionPlayerStats(
  history: HandHistoryRecord[],
  lang: Language = 'az'
): PlayerSessionStats[] {
  const playerIds = new Set<string>();
  const playerMetadata = new Map<string, { name: string; avatar?: string; isHuman: boolean }>();

  for (const hand of history) {
    if (hand.playerActionLogs) {
      for (const [id, log] of Object.entries(hand.playerActionLogs)) {
        playerIds.add(id);
        if (!playerMetadata.has(id)) {
          playerMetadata.set(id, {
            name: log.playerName,
            avatar: log.avatar,
            isHuman: log.isHuman,
          });
        }
      }
    }
  }

  const results: PlayerSessionStats[] = [];
  for (const id of playerIds) {
    const meta = playerMetadata.get(id);
    const stats = calculatePlayerSessionStats(
      history,
      id,
      meta?.name || 'Player',
      meta?.isHuman ?? false,
      lang
    );
    results.push(stats);
  }

  // Sort by hands played descending, human first
  return results.sort((a, b) => {
    if (a.isHuman && !b.isHuman) return -1;
    if (!a.isHuman && b.isHuman) return 1;
    return b.totalHands - a.totalHands;
  });
}
