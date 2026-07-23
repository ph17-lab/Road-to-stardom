// Países disponíveis: confederação, força da seleção (1-10) e pool de nomes.
// Países com hasLeague: true podem ser escolhidos como região de origem da carreira.

export const NATIONS = {
  'Brasil':          { conf: 'CONMEBOL', teamRep: 9.6, pool: 'br', hasLeague: true },
  'Argentina':       { conf: 'CONMEBOL', teamRep: 9.5, pool: 'es', hasLeague: true },
  'Inglaterra':      { conf: 'UEFA',     teamRep: 9.0, pool: 'en', hasLeague: true },
  'Espanha':         { conf: 'UEFA',     teamRep: 9.2, pool: 'es', hasLeague: true },
  'Alemanha':        { conf: 'UEFA',     teamRep: 8.8, pool: 'de', hasLeague: true },
  'Itália':          { conf: 'UEFA',     teamRep: 8.6, pool: 'it', hasLeague: true },
  'França':          { conf: 'UEFA',     teamRep: 9.4, pool: 'fr', hasLeague: true },
  'Portugal':        { conf: 'UEFA',     teamRep: 8.8, pool: 'pt', hasLeague: true },
  'Holanda':         { conf: 'UEFA',     teamRep: 8.5, pool: 'nl', hasLeague: true },
  'Bélgica':         { conf: 'UEFA',     teamRep: 8.2, pool: 'nl', hasLeague: true },
  'Estados Unidos':  { conf: 'CONCACAF', teamRep: 7.5, pool: 'us', hasLeague: true },
  'México':          { conf: 'CONCACAF', teamRep: 7.8, pool: 'es', hasLeague: true },
  'Arábia Saudita':  { conf: 'AFC',      teamRep: 6.8, pool: 'sa', hasLeague: true },
  'Turquia':         { conf: 'UEFA',     teamRep: 7.4, pool: 'tr', hasLeague: true },
  'Escócia':         { conf: 'UEFA',     teamRep: 6.5, pool: 'en', hasLeague: true },
  'Uruguai':         { conf: 'CONMEBOL', teamRep: 8.4, pool: 'es', hasLeague: false },
  'Colômbia':        { conf: 'CONMEBOL', teamRep: 8.0, pool: 'es', hasLeague: false },
  'Chile':           { conf: 'CONMEBOL', teamRep: 7.2, pool: 'es', hasLeague: false },
  'Croácia':         { conf: 'UEFA',     teamRep: 8.2, pool: 'hr', hasLeague: false },
  'Japão':           { conf: 'AFC',      teamRep: 7.6, pool: 'jp', hasLeague: false },
  'Nigéria':         { conf: 'CAF',      teamRep: 7.4, pool: 'af', hasLeague: false },
  'Senegal':         { conf: 'CAF',      teamRep: 7.6, pool: 'af', hasLeague: false },
  'Gana':            { conf: 'CAF',      teamRep: 7.0, pool: 'af', hasLeague: false },
  'Marrocos':        { conf: 'CAF',      teamRep: 8.0, pool: 'sa', hasLeague: false },
};

export const ORIGIN_COUNTRIES = Object.keys(NATIONS).filter((n) => NATIONS[n].hasLeague);

// Nome do torneio continental de seleções por confederação
export const CONF_TOURNAMENTS = {
  UEFA: 'Eurocopa',
  CONMEBOL: 'Copa América',
  CONCACAF: 'Copa Ouro',
  AFC: 'Copa da Ásia',
  CAF: 'Copa Africana de Nações',
};
