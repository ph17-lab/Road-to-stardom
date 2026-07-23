# ⚽ Road to Stardom — Modo Carreira de Jogador

Simulador completo de **carreira de jogador de futebol**, inspirado no modo carreira de jogador de FIFA/EA FC. Você cria um jovem atleta, é sorteado para a base de um clube e conduz a carreira dele por décadas: base → profissional → transferências → seleção → títulos → aposentadoria.

Feito em **HTML + CSS + JavaScript puro** (sem dependências), com interface **responsiva para celular e PC**.

## Como jogar

O `index.html` é **auto-contido** (CSS e JavaScript embutidos). Não precisa de servidor nem de instalação:

- **No celular**: baixe apenas o arquivo `index.html` e abra no navegador (Chrome, etc.). Pronto.
- **No PC**: dê dois cliques no `index.html`, ou sirva com `npm start` e abra http://localhost:8080.

O progresso é salvo automaticamente no navegador, e dá para exportar/importar o save como arquivo.

### Criação do jogador

Você escolhe apenas **nome e altura** — a carreira sempre começa aos **15 anos** na base de um clube do Brasil. Posição, pé dominante, estilo de jogo e número da camisa são revelados no **sorteio da academia** (e mudam a cada re-rolagem, até 3 vezes).

## Funcionalidades

- **Criação do jogador**: nome e altura; a carreira começa sempre aos 15 anos. (O motor também suporta idade, posição, país e estilo customizados, usados pelos testes.)
- **Base roletada**: sorteio animado da academia inicial, ponderado pela reputação — academias de elite são raras. Até 3 re-rolagens. A roleta também define posição (11 posições incl. goleiro), pé dominante, estilo de jogo e camisa.
- **Categorias de base**: Sub-15 / Sub-17 / Sub-20, com overall inicial compatível com a idade e a academia.
- **Atributos completos** por grupo (ataque, passe, drible, defesa, físico, goleiro) com **overall calculado por posição**.
- **Desenvolvimento**: potencial, idade, minutos, notas, treino com foco escolhido, qualidade da estrutura e nível da liga — com declínio físico após os 32.
- **Promoção ao profissional** por desempenho/overall, empréstimos e dispensas.
- **Simulação de partidas** com estatísticas individuais (minutos, nota 0–10, gols, assistências, finalizações, passes, desarmes, defesas para goleiros, cartões).
- **Lesões** (leve/moderada/grave) que afastam o jogador por semanas.
- **Sistema de propostas e transferências**: aceitar, recusar ou negociar salário; janelas nas semanas 2–5 e 20–24; mercado de IA ativo.
- **Ligas e tabelas**: ~230 clubes em 15 ligas (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Brasileirão, e mais) todas simuladas rodada a rodada.
- **Copas nacionais, Champions League, Libertadores, continentais e Mundial de Clubes.**
- **Seleção nacional**: convocações por overall/reputação, amistosos em datas FIFA, Copa do Mundo e torneios continentais.
- **Prêmios**: artilheiro, melhor jovem, melhor da liga, time da temporada e **Bola de Ouro**.
- **Títulos e histórico** completos, temporada a temporada.
- **Notícias dinâmicas** do mundo do jogo.
- **Mundo vivo**: jogadores de IA evoluem, envelhecem e se aposentam; técnicos mudam; clubes contratam.
- **Salvamento automático** (localStorage) + exportar/importar arquivo de save.

## Arquitetura

```
index.html            ARQUIVO GERADO — jogo completo em um único arquivo
build.js              empacotador (npm run build regenera o index.html)
src/ui/template.html  estrutura HTML usada pelo build
css/style.css         tema responsivo
src/data/             banco de dados (ligas, clubes, países, nomes)
src/core/             motor de simulação (puro, roda em Node sem DOM)
  engine.js           orquestrador de semanas/temporadas
  world.js            mundo, elencos de IA, tabelas, fixtures
  match.js            simulação de partidas e desempenho individual
  attributes.js       atributos, overall por posição, treino
  development.js      evolução, forma, moral, lesões, reputação
  transfers.js        propostas, negociação, mercado de IA
  competitions.js     copas, continentais, seleções
  academy.js          roleta da base
  player.js           criação, valor de mercado, salário
  save.js             serialização do save
src/ui/app.js         camada de interface
tests/                testes de ponta a ponta (carreiras inteiras headless)
```

Para adicionar uma liga, basta acrescentar um objeto em `src/data/leagues.js` — o resto do jogo (copas, continentais, mercado) a incorpora automaticamente. Depois de mudar qualquer arquivo em `src/` ou `css/`, rode `npm run build` para regenerar o `index.html`.

## Testes

```bash
npm test
```

Os testes simulam carreiras completas (30+ temporadas) validando: roleta ponderada, promoção, transferências, prêmios, convocações, aposentadoria e integridade do save.
