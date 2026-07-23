// Banco de dados de ligas e clubes.
// Formato do clube: [nome, reputação (1-10), nível da academia (1-10), overall médio do elenco, orçamento (M€)]
// A arquitetura é modular: para adicionar uma liga, basta acrescentar um objeto neste array.

export const LEAGUES_DATA = [
  {
    id: 'BRA1', name: 'Brasileirão Série A', country: 'Brasil', strength: 7.8, cupName: 'Copa do Brasil',
    clubs: [
      ['Flamengo', 9, 9, 78, 90], ['Palmeiras', 9, 9, 78, 85], ['Corinthians', 8, 8, 74, 55],
      ['São Paulo', 8, 9, 74, 50], ['Santos', 7, 9, 71, 35], ['Grêmio', 7, 8, 73, 40],
      ['Internacional', 7, 8, 73, 40], ['Atlético Mineiro', 8, 8, 75, 50], ['Cruzeiro', 7, 8, 72, 40],
      ['Botafogo', 7, 7, 74, 45], ['Fluminense', 7, 8, 73, 40], ['Vasco da Gama', 6, 8, 70, 30],
      ['Athletico Paranaense', 6, 8, 70, 30], ['Bahia', 6, 6, 70, 35], ['Fortaleza', 6, 6, 70, 25],
      ['Red Bull Bragantino', 6, 8, 70, 35], ['Vitória', 5, 5, 66, 15], ['Juventude', 4, 5, 64, 10],
    ],
  },
  {
    id: 'ENG1', name: 'Premier League', country: 'Inglaterra', strength: 9.6, cupName: 'Copa da Inglaterra',
    clubs: [
      ['Manchester City', 10, 9, 85, 250], ['Arsenal', 9, 9, 84, 200], ['Liverpool', 10, 9, 85, 220],
      ['Manchester United', 9, 10, 80, 200], ['Chelsea', 9, 9, 81, 220], ['Tottenham', 8, 8, 80, 150],
      ['Newcastle', 8, 7, 79, 150], ['Aston Villa', 8, 8, 79, 120], ['Brighton', 7, 8, 76, 80],
      ['West Ham', 7, 8, 75, 90], ['Everton', 6, 8, 73, 60], ['Wolverhampton', 6, 7, 74, 60],
      ['Crystal Palace', 6, 8, 74, 60], ['Fulham', 6, 7, 74, 55], ['Brentford', 6, 6, 74, 50],
      ['Bournemouth', 6, 6, 74, 50], ['Nottingham Forest', 6, 6, 74, 55], ['Leicester', 6, 8, 71, 50],
      ['Southampton', 5, 8, 70, 40], ['Leeds United', 6, 7, 71, 45],
    ],
  },
  {
    id: 'ESP1', name: 'La Liga', country: 'Espanha', strength: 9.2, cupName: 'Copa do Rei',
    clubs: [
      ['Real Madrid', 10, 9, 86, 250], ['Barcelona', 10, 10, 84, 180], ['Atlético de Madrid', 9, 8, 82, 130],
      ['Sevilla', 7, 7, 76, 60], ['Real Sociedad', 7, 9, 77, 60], ['Villarreal', 7, 8, 77, 60],
      ['Real Betis', 7, 8, 76, 50], ['Athletic Bilbao', 7, 9, 77, 55], ['Valencia', 6, 8, 74, 40],
      ['Girona', 6, 6, 75, 40], ['Celta de Vigo', 6, 8, 73, 35], ['Osasuna', 5, 6, 73, 30],
      ['Getafe', 5, 5, 72, 30], ['Rayo Vallecano', 5, 5, 72, 25], ['Mallorca', 5, 5, 72, 25],
      ['Alavés', 5, 5, 71, 20], ['Espanyol', 5, 7, 71, 25], ['Las Palmas', 5, 6, 70, 20],
    ],
  },
  {
    id: 'GER1', name: 'Bundesliga', country: 'Alemanha', strength: 8.9, cupName: 'Copa da Alemanha',
    clubs: [
      ['Bayern de Munique', 10, 9, 85, 200], ['Borussia Dortmund', 9, 10, 81, 130], ['Bayer Leverkusen', 8, 8, 81, 100],
      ['RB Leipzig', 8, 9, 80, 110], ['Eintracht Frankfurt', 7, 8, 77, 70], ['Stuttgart', 7, 8, 77, 60],
      ['Wolfsburg', 6, 8, 75, 60], ['Borussia Mönchengladbach', 6, 8, 74, 50], ['Freiburg', 6, 8, 75, 45],
      ['Hoffenheim', 6, 8, 74, 45], ['Union Berlin', 6, 5, 73, 40], ['Mainz', 5, 7, 72, 30],
      ['Augsburg', 5, 6, 72, 30], ['Werder Bremen', 6, 7, 73, 35], ['Colônia', 5, 8, 71, 30],
      ['Heidenheim', 4, 5, 70, 20], ['Hamburgo', 6, 8, 72, 40], ['St. Pauli', 5, 6, 70, 25],
    ],
  },
  {
    id: 'ITA1', name: 'Serie A', country: 'Itália', strength: 8.7, cupName: 'Copa da Itália',
    clubs: [
      ['Inter de Milão', 9, 8, 84, 130], ['Milan', 9, 8, 81, 120], ['Juventus', 9, 9, 81, 130],
      ['Napoli', 8, 7, 81, 100], ['Roma', 8, 8, 78, 80], ['Lazio', 7, 7, 77, 60],
      ['Atalanta', 8, 9, 79, 70], ['Fiorentina', 7, 8, 76, 55], ['Bologna', 7, 7, 76, 45],
      ['Torino', 6, 7, 74, 35], ['Udinese', 5, 7, 72, 30], ['Sassuolo', 5, 7, 71, 25],
      ['Genoa', 5, 7, 72, 30], ['Cagliari', 5, 6, 71, 25], ['Lecce', 5, 6, 71, 20],
      ['Hellas Verona', 5, 6, 71, 20], ['Empoli', 4, 7, 70, 18], ['Monza', 5, 5, 71, 25],
    ],
  },
  {
    id: 'FRA1', name: 'Ligue 1', country: 'França', strength: 8.4, cupName: 'Copa da França',
    clubs: [
      ['Paris Saint-Germain', 10, 8, 84, 250], ['Monaco', 8, 9, 79, 90], ['Olympique de Marseille', 8, 8, 78, 80],
      ['Lyon', 7, 9, 76, 60], ['Lille', 7, 8, 76, 55], ['Nice', 7, 7, 76, 55],
      ['Lens', 7, 7, 75, 45], ['Rennes', 6, 9, 75, 50], ['Reims', 5, 7, 72, 30],
      ['Strasbourg', 5, 7, 72, 35], ['Nantes', 5, 7, 72, 30], ['Montpellier', 5, 7, 71, 25],
      ['Toulouse', 5, 6, 72, 28], ['Brest', 5, 5, 72, 25], ['Auxerre', 4, 7, 70, 18],
      ['Saint-Étienne', 5, 7, 70, 25], ['Angers', 4, 6, 69, 15], ['Le Havre', 4, 7, 69, 15],
    ],
  },
  {
    id: 'POR1', name: 'Liga Portugal', country: 'Portugal', strength: 7.4, cupName: 'Taça de Portugal',
    clubs: [
      ['Benfica', 8, 10, 78, 80], ['Porto', 8, 9, 78, 70], ['Sporting', 8, 10, 78, 65],
      ['Braga', 7, 8, 74, 35], ['Vitória de Guimarães', 6, 7, 71, 20], ['Boavista', 5, 6, 68, 12],
      ['Famalicão', 5, 6, 68, 12], ['Gil Vicente', 4, 5, 67, 10], ['Rio Ave', 4, 5, 67, 10],
      ['Moreirense', 4, 5, 66, 8], ['Estoril', 4, 6, 67, 10], ['Casa Pia', 3, 4, 65, 6],
    ],
  },
  {
    id: 'NED1', name: 'Eredivisie', country: 'Holanda', strength: 7.5, cupName: 'Copa da Holanda',
    clubs: [
      ['Ajax', 8, 10, 76, 60], ['PSV', 8, 9, 77, 55], ['Feyenoord', 7, 9, 76, 45],
      ['AZ Alkmaar', 6, 9, 73, 30], ['Twente', 6, 7, 72, 25], ['Utrecht', 5, 7, 70, 18],
      ['Vitesse', 5, 6, 68, 15], ['Heerenveen', 4, 7, 68, 12], ['Groningen', 4, 7, 67, 12],
      ['Sparta Rotterdam', 4, 6, 67, 10], ['NEC Nijmegen', 4, 6, 67, 10], ['Go Ahead Eagles', 4, 5, 66, 8],
    ],
  },
  {
    id: 'ARG1', name: 'Liga Profissional Argentina', country: 'Argentina', strength: 7.2, cupName: 'Copa Argentina',
    clubs: [
      ['River Plate', 8, 9, 75, 45], ['Boca Juniors', 8, 9, 74, 40], ['Racing', 7, 8, 72, 25],
      ['Independiente', 6, 8, 70, 20], ['San Lorenzo', 6, 7, 69, 18], ['Vélez Sarsfield', 6, 8, 69, 18],
      ['Estudiantes', 6, 7, 70, 18], ["Newell's Old Boys", 5, 8, 68, 15], ['Rosario Central', 5, 7, 68, 15],
      ['Talleres', 5, 6, 69, 15], ['Lanús', 5, 7, 68, 12], ['Argentinos Juniors', 5, 8, 68, 12],
      ['Huracán', 4, 6, 67, 10], ['Gimnasia La Plata', 4, 6, 66, 10],
    ],
  },
  {
    id: 'USA1', name: 'MLS', country: 'Estados Unidos', strength: 6.8, cupName: 'US Open Cup',
    clubs: [
      ['Inter Miami', 7, 6, 73, 60], ['LA Galaxy', 6, 6, 71, 40], ['LAFC', 6, 6, 72, 40],
      ['Atlanta United', 6, 6, 70, 35], ['Seattle Sounders', 5, 6, 70, 30], ['New York City FC', 5, 7, 70, 30],
      ['New York Red Bulls', 5, 7, 69, 28], ['Austin FC', 5, 5, 68, 25], ['Portland Timbers', 5, 5, 68, 25],
      ['Columbus Crew', 5, 6, 70, 25], ['Orlando City', 5, 5, 68, 25], ['Toronto FC', 5, 5, 67, 25],
      ['Chicago Fire', 4, 5, 67, 22], ['FC Cincinnati', 5, 5, 69, 25],
    ],
  },
  {
    id: 'MEX1', name: 'Liga MX', country: 'México', strength: 7.0, cupName: 'Copa MX',
    clubs: [
      ['América', 7, 7, 74, 40], ['Guadalajara', 6, 8, 71, 30], ['Cruz Azul', 6, 6, 72, 28],
      ['Pumas', 6, 7, 70, 22], ['Tigres', 7, 6, 73, 35], ['Monterrey', 7, 6, 73, 38],
      ['Toluca', 5, 6, 70, 20], ['Santos Laguna', 5, 6, 69, 18], ['León', 5, 5, 69, 18],
      ['Pachuca', 5, 8, 70, 20], ['Atlas', 4, 6, 67, 14], ['Puebla', 4, 5, 66, 10],
      ['Necaxa', 4, 5, 66, 10], ['Querétaro', 3, 4, 65, 8],
    ],
  },
  {
    id: 'SAU1', name: 'Liga Saudita', country: 'Arábia Saudita', strength: 6.5, cupName: 'Copa do Rei Saudita',
    clubs: [
      ['Al-Hilal', 8, 6, 78, 120], ['Al-Nassr', 8, 6, 77, 110], ['Al-Ittihad', 7, 5, 75, 90],
      ['Al-Ahli', 7, 5, 74, 80], ['Al-Shabab', 5, 5, 70, 30], ['Al-Ettifaq', 5, 4, 69, 30],
      ['Al-Taawoun', 4, 4, 67, 15], ['Al-Fateh', 4, 4, 66, 12], ['Damac', 3, 3, 64, 8],
      ['Al-Fayha', 3, 3, 64, 8], ['Al-Raed', 3, 3, 63, 7], ['Al-Qadsiah', 4, 4, 66, 20],
    ],
  },
  {
    id: 'BEL1', name: 'Jupiler Pro League', country: 'Bélgica', strength: 6.9, cupName: 'Copa da Bélgica',
    clubs: [
      ['Club Brugge', 6, 8, 73, 30], ['Anderlecht', 6, 9, 71, 25], ['Genk', 6, 9, 71, 22],
      ['Gent', 5, 7, 70, 18], ['Antwerp', 5, 6, 70, 18], ['Standard de Liège', 5, 8, 68, 15],
      ['Union Saint-Gilloise', 6, 6, 71, 18], ['Charleroi', 4, 6, 66, 10], ['Mechelen', 4, 6, 66, 9],
      ['Westerlo', 4, 5, 65, 8], ['OH Leuven', 3, 5, 64, 7], ['Cercle Brugge', 4, 5, 66, 8],
    ],
  },
  {
    id: 'TUR1', name: 'Süper Lig', country: 'Turquia', strength: 6.9, cupName: 'Copa da Turquia',
    clubs: [
      ['Galatasaray', 7, 7, 76, 50], ['Fenerbahçe', 7, 7, 75, 48], ['Beşiktaş', 6, 7, 73, 35],
      ['Trabzonspor', 6, 6, 71, 25], ['Başakşehir', 5, 5, 70, 18], ['Adana Demirspor', 4, 4, 68, 12],
      ['Konyaspor', 4, 4, 66, 9], ['Antalyaspor', 4, 4, 66, 9], ['Alanyaspor', 4, 4, 66, 8],
      ['Sivasspor', 4, 4, 66, 8], ['Kayserispor', 3, 4, 65, 7], ['Samsunspor', 3, 4, 65, 7],
      ['Rizespor', 3, 3, 64, 6], ['Kasımpaşa', 3, 4, 64, 6],
    ],
  },
  {
    id: 'SCO1', name: 'Scottish Premiership', country: 'Escócia', strength: 6.2, cupName: 'Copa da Escócia',
    clubs: [
      ['Celtic', 7, 7, 72, 30], ['Rangers', 7, 7, 71, 28], ['Hearts', 5, 6, 66, 10],
      ['Aberdeen', 5, 6, 65, 9], ['Hibernian', 4, 6, 64, 8], ['Dundee United', 4, 5, 62, 5],
      ['Motherwell', 3, 5, 61, 4], ['St Mirren', 3, 4, 61, 4], ['Kilmarnock', 3, 4, 61, 4],
      ['Dundee', 3, 4, 61, 4], ['Ross County', 2, 3, 59, 3], ['Livingston', 2, 3, 59, 3],
    ],
  },
];

// Estádios reais dos clubes mais famosos; os demais recebem um nome gerado.
const STADIUMS = {
  'Flamengo': 'Maracanã', 'Palmeiras': 'Allianz Parque', 'Corinthians': 'Neo Química Arena',
  'São Paulo': 'Morumbi', 'Santos': 'Vila Belmiro', 'Grêmio': 'Arena do Grêmio',
  'Internacional': 'Beira-Rio', 'Atlético Mineiro': 'Arena MRV', 'Cruzeiro': 'Mineirão',
  'Botafogo': 'Nilton Santos', 'Fluminense': 'Maracanã', 'Vasco da Gama': 'São Januário',
  'Manchester City': 'Etihad Stadium', 'Arsenal': 'Emirates Stadium', 'Liverpool': 'Anfield',
  'Manchester United': 'Old Trafford', 'Chelsea': 'Stamford Bridge', 'Tottenham': 'Tottenham Hotspur Stadium',
  'Newcastle': "St James' Park", 'Aston Villa': 'Villa Park', 'Everton': 'Goodison Park',
  'Real Madrid': 'Santiago Bernabéu', 'Barcelona': 'Camp Nou', 'Atlético de Madrid': 'Metropolitano',
  'Sevilla': 'Ramón Sánchez-Pizjuán', 'Athletic Bilbao': 'San Mamés', 'Valencia': 'Mestalla',
  'Bayern de Munique': 'Allianz Arena', 'Borussia Dortmund': 'Signal Iduna Park', 'Bayer Leverkusen': 'BayArena',
  'Inter de Milão': 'San Siro', 'Milan': 'San Siro', 'Juventus': 'Allianz Stadium',
  'Napoli': 'Diego Armando Maradona', 'Roma': 'Olimpico', 'Lazio': 'Olimpico',
  'Paris Saint-Germain': 'Parc des Princes', 'Olympique de Marseille': 'Vélodrome', 'Lyon': 'Groupama Stadium',
  'Benfica': 'Estádio da Luz', 'Porto': 'Estádio do Dragão', 'Sporting': 'José Alvalade',
  'Ajax': 'Johan Cruijff Arena', 'PSV': 'Philips Stadion', 'Feyenoord': 'De Kuip',
  'River Plate': 'Monumental', 'Boca Juniors': 'La Bombonera', 'Racing': 'El Cilindro',
  'América': 'Estádio Azteca', 'Celtic': 'Celtic Park', 'Rangers': 'Ibrox',
  'Galatasaray': 'Rams Park', 'Fenerbahçe': 'Şükrü Saracoğlu', 'Al-Hilal': 'Kingdom Arena',
  'Al-Nassr': 'Al-Awwal Park', 'Inter Miami': 'Chase Stadium',
};

export function stadiumFor(clubName) {
  return STADIUMS[clubName] || `Arena ${clubName}`;
}
