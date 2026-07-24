// Sistema de entrevistas e imprensa (IA simples, baseada em regras).
// O jornalista faz perguntas conforme o momento da carreira; cada resposta
// gera uma matéria e repercussão (moral, reputação, relação com torcida,
// treinador e vestiário), além de reações de outros clubes.

import { avgRating, fullName, marketValue } from './player.js';
import { clamp, chance, choice, ri } from './rng.js';

// Tom de cada opção de resposta: como afeta os "públicos".
// deltas: morale, reputation, fans, manager, rivals (interesse de clubes)
const TONE = {
  humilde:   { morale: +3, reputation: +2, fans: +3, manager: +4, rivals: +0, label: 'Humilde' },
  confiante: { morale: +5, reputation: +4, fans: +4, manager: +0, rivals: +3, label: 'Confiante' },
  ambicioso: { morale: +2, reputation: +5, fans: -2, manager: -4, rivals: +6, label: 'Ambicioso' },
  polemico:  { morale: -1, reputation: +6, fans: -4, manager: -6, rivals: +2, label: 'Polêmico' },
  focado:    { morale: +4, reputation: +1, fans: +2, manager: +5, rivals: +0, label: 'Focado no time' },
  leal:      { morale: +4, reputation: +1, fans: +6, manager: +5, rivals: -5, label: 'Leal ao clube' },
};

// Bancos de perguntas por contexto. Cada opção: { tone, text, headline(fn), reaction(fn) }
function questionBank(G) {
  const p = G.player;
  const club = p.clubId !== null ? G.clubs[p.clubId] : null;
  const clubName = club ? club.name : 'seu clube';
  const rating = avgRating(p.seasonStats);
  const banks = [];

  // Momento: boa fase
  if (rating >= 7.2 && p.seasonStats.apps >= 3) {
    banks.push({
      q: 'Você vive grande fase. A que atribui o bom momento?',
      opts: [
        { tone: 'humilde', text: 'É fruto do trabalho do grupo, mérito de todos.' },
        { tone: 'confiante', text: 'Estou no meu melhor nível e vou manter.' },
        { tone: 'focado', text: 'Só penso em ajudar o time a vencer.' },
      ],
    });
  }
  // Momento: má fase
  if (rating > 0 && rating < 6.3 && p.seasonStats.apps >= 3) {
    banks.push({
      q: 'As atuações caíram. Como avalia seu momento?',
      opts: [
        { tone: 'humilde', text: 'Preciso trabalhar mais, assumo a responsabilidade.' },
        { tone: 'confiante', text: 'É passageiro, logo volto a decidir jogos.' },
        { tone: 'polemico', text: 'Falta o time me dar as condições que preciso.' },
      ],
    });
  }
  // Interesse de clubes grandes
  const hasBigInterest = G.offers.some((o) => G.clubs[o.clubId].rep >= 8) || p.overall >= 82;
  if (hasBigInterest && !p.youth) {
    banks.push({
      q: `Grandes clubes observam você. Pensa em deixar o ${clubName}?`,
      opts: [
        { tone: 'leal', text: `Estou feliz no ${clubName}, quero vencer aqui.` },
        { tone: 'ambicioso', text: 'Todo jogador sonha em jogar cada vez mais alto.' },
        { tone: 'focado', text: 'Meu foco é o presente, o futuro a Deus pertence.' },
      ],
    });
  }
  // Seleção
  if (!p.youth && p.overall >= 70) {
    banks.push({
      q: 'A seleção de ' + p.nationality + ' é um objetivo?',
      opts: [
        { tone: 'humilde', text: 'Seria uma honra, mas primeiro tenho que merecer.' },
        { tone: 'confiante', text: 'Trabalho para isso e sei que meu momento vai chegar.' },
        { tone: 'ambicioso', text: 'Quero ser titular e disputar uma Copa do Mundo.' },
      ],
    });
  }
  // Base / jovem
  if (p.youth || p.age <= 19) {
    banks.push({
      q: 'Você é uma das promessas da base. Como lida com a pressão?',
      opts: [
        { tone: 'humilde', text: 'Tento aprender com os mais experientes, dia a dia.' },
        { tone: 'confiante', text: 'Nasci para isso, quero brilhar o quanto antes.' },
        { tone: 'focado', text: 'Só penso em evoluir e ajudar quando for chamado.' },
      ],
    });
  }
  // Rivalidade / próximo jogo (genérico, sempre disponível)
  banks.push({
    q: 'O que espera para a sequência da temporada?',
    opts: [
      { tone: 'focado', text: 'Vamos com humildade, jogo a jogo.' },
      { tone: 'confiante', text: 'Podemos brigar por títulos, temos elenco para isso.' },
      { tone: 'ambicioso', text: 'Quero ser artilheiro e levar o time ao topo.' },
    ],
  });

  return banks;
}

// Uma entrevista disponível? (limita a frequência)
export function interviewAvailable(G) {
  const p = G.player;
  if (p.retired || p.clubId === null) return false;
  if (G.pendingInterview) return true;
  return false;
}

// Gera/pega a entrevista atual (uma pergunta com opções)
export function getInterview(G) {
  if (!G.pendingInterview) return null;
  return G.pendingInterview;
}

// Cria uma nova entrevista pendente (chamado pela evolução do tempo)
export function offerInterview(G) {
  const p = G.player;
  if (p.retired || p.clubId === null) return null;
  const banks = questionBank(G);
  const pick = choice(banks);
  const reporter = choice(['Globo Esporte', 'ESPN', 'DAZN', 'Marca', 'L\'Équipe', 'Sky Sports', 'Gazzetta']);
  G.pendingInterview = { q: pick.q, opts: pick.opts, reporter };
  return G.pendingInterview;
}

// Responde a entrevista: aplica repercussão e gera matéria + reações.
// Retorna { headline, article, deltas, reactions }
export function answerInterview(G, optIndex) {
  const interview = G.pendingInterview;
  if (!interview) return null;
  const p = G.player;
  const club = p.clubId !== null ? G.clubs[p.clubId] : null;
  const opt = interview.opts[optIndex];
  const tone = TONE[opt.tone];
  const name = fullName(p);

  // aplica deltas
  p.morale = clamp(p.morale + tone.morale, 10, 99);
  p.reputation = clamp(p.reputation + tone.reputation * 0.4, 1, 100);
  p.fanSupport = clamp((p.fanSupport ?? 60) + tone.fans, 0, 100);
  p.managerTrust = clamp((p.managerTrust ?? 60) + tone.manager, 0, 100);

  // manchete e matéria conforme o tom
  const headline = pressHeadline(name, club, opt.tone, interview);
  const article = pressArticle(G, opt, tone);

  // reações (comentários da torcida / imprensa / clubes)
  const reactions = pressReactions(G, opt.tone, tone);

  // rivais: tom ambicioso/confiante pode acender o mercado
  if (tone.rivals >= 4 && !p.youth && chance(0.5)) {
    const giants = G.clubs.filter((c) => c.rep >= 8 && c.id !== p.clubId);
    if (giants.length) {
      const g = choice(giants);
      reactions.push({ who: '🕵️ Bastidores', text: `${g.name} monitora a situação de ${name} após as declarações.` });
    }
  }

  // registra como notícia
  G.news.unshift({ year: G.seasonYear, week: G.week, text: `📰 ${headline}` });
  if (G.news.length > 80) G.news.length = 80;

  // guarda no histórico de entrevistas
  G.interviewHistory = G.interviewHistory || [];
  G.interviewHistory.unshift({ year: G.seasonYear, week: G.week, headline, quote: opt.text, tone: tone.label });
  if (G.interviewHistory.length > 30) G.interviewHistory.length = 30;

  G.pendingInterview = null;
  return { headline, article, deltas: tone, reactions, quote: opt.text };
}

export function skipInterview(G) {
  G.pendingInterview = null;
}

function pressHeadline(name, club, tone, interview) {
  const clubName = club ? club.name : '';
  const H = {
    humilde: [`"É mérito do grupo", diz ${name}`, `${name} poupa elogios a si mesmo`],
    confiante: [`${name}: "Estou no meu melhor nível"`, `${name} demonstra confiança em entrevista`],
    ambicioso: [`${name} admite sonho de voos maiores`, `Declaração de ${name} agita o mercado`],
    polemico: [`Polêmica: ${name} cutuca o ${clubName}`, `${name} gera climão com declaração`],
    focado: [`${name} prega foco total no ${clubName}`, `"Jogo a jogo", afirma ${name}`],
    leal: [`${name} jura amor ao ${clubName}`, `${name} descarta saída e agrada torcida`],
  };
  return choice(H[tone] || H.focado);
}

function pressArticle(G, opt, tone) {
  const p = G.player;
  const club = p.clubId !== null ? G.clubs[p.clubId] : null;
  const parts = [];
  parts.push(`Em entrevista, ${fullName(p)} afirmou: "${opt.text}"`);
  if (tone.fans > 3) parts.push('A torcida aprovou a postura nas redes sociais.');
  else if (tone.fans < 0) parts.push('Parte da torcida reagiu com irritação.');
  if (tone.manager > 3) parts.push(`Nos bastidores, o técnico ${club ? club.manager : ''} gostou do discurso.`);
  else if (tone.manager < 0) parts.push('A comissão técnica não gostou do tom.');
  return parts.join(' ');
}

function pressReactions(G, toneKey, tone) {
  const out = [];
  const fanPool = {
    pos: ['Que ídolo! 👏', 'Esse é raça, representa a camisa!', 'Falou tudo, craque demais.'],
    neg: ['Achei arrogante...', 'Foca no jogo e para de falar!', 'Declaração infeliz.'],
    neutral: ['Vamos ver dentro de campo.', 'Bola pra frente.'],
  };
  const kind = tone.fans > 3 ? 'pos' : tone.fans < 0 ? 'neg' : 'neutral';
  out.push({ who: '💬 Torcida', text: choice(fanPool[kind]) });

  if (tone.manager < 0) out.push({ who: '📋 Comissão', text: 'O treinador pediu foco e evitou comentar publicamente.' });
  else if (tone.manager > 3) out.push({ who: '📋 Comissão', text: 'O treinador elogiou a mentalidade do jogador.' });

  const pressPool = {
    ambicioso: 'Analistas veem o jogador cada vez mais perto de uma transferência.',
    confiante: 'Comentaristas destacam a confiança do atleta.',
    polemico: 'A imprensa repercute a declaração polêmica.',
    humilde: 'Especialistas elogiam a maturidade do jovem.',
    focado: 'A imprensa aprova o profissionalismo.',
    leal: 'A torcida vibra com a demonstração de amor à camisa.',
  };
  out.push({ who: '🎙️ Imprensa', text: pressPool[toneKey] || pressPool.focado });
  return out;
}

// Inicializa campos de relação se ainda não existirem (saves antigos)
export function ensurePressFields(G) {
  const p = G.player;
  if (p.fanSupport == null) p.fanSupport = 60;
  if (p.managerTrust == null) p.managerTrust = 60;
}
