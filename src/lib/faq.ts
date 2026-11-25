// Perguntas frequentes (página Sobre e entrada do site).

export const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'O GreenGoal garante resultados ou lucro?',
    a: 'Não. O GreenGoal é uma fonte de informação estatística. Números descrevem o que já aconteceu e ajudam a entender uma partida, mas não garantem o que vai acontecer. Apostas envolvem risco de perda financeira.',
  },
  {
    q: 'De onde vêm os dados?',
    a: 'As partidas, placares, estatísticas de equipes e jogadores, confrontos diretos e previsões vêm da API-Football (API-Sports). Os dados ficam armazenados no nosso banco e as páginas consultam esse banco — nunca chamam a API diretamente pelo navegador.',
  },
  {
    q: 'Como as análises são escritas?',
    a: 'Um modelo de inteligência artificial recebe somente os dados coletados da partida e escreve até nove seções (importância do jogo, confrontos, forma, probabilidade, gols, escanteios, cartões, árbitro e finalizações). Ele é instruído a não inventar números; seções sem dados de apoio são removidas antes da publicação.',
  },
  {
    q: 'Por que algumas análises não têm todas as seções?',
    a: 'Porque preferimos omitir a preencher lacunas com suposições. Algumas competições têm menos estatísticas disponíveis. Sobre o árbitro, por exemplo, a fonte informa apenas o nome, não o histórico de cartões.',
  },
  {
    q: 'O que são os bilhetes prontos?',
    a: 'Todos os dias, depois que as análises ficam prontas, a IA monta bilhetes separados por nível de risco (baixo, médio e médio-alto) usando apenas os mercados com mais sustentação nos dados. Quando a fonte informa, cada seleção traz a odd e o bilhete mostra a odd total. A odd muda até o início do jogo e nenhum bilhete tem garantia de resultado.',
  },
  {
    q: 'As análises são atualizadas automaticamente?',
    a: 'Sim. Uma rotina automática busca os jogos do dia, gera as análises das partidas prioritárias e monta os bilhetes prontos, sem ninguém precisar apertar botão.',
  },
  {
    q: 'O que são as probabilidades exibidas?',
    a: 'Os percentuais de vitória, empate e derrota vêm do modelo estatístico da própria API-Football. Quando há odds disponíveis, mostramos também a probabilidade implícita no mercado, sem a margem da casa. São estimativas, não certezas.',
  },
  {
    q: 'De onde vêm os números do painel “Estatísticas” da partida?',
    a: 'Dos últimos jogos de cada equipe registrados pela API-Football: placar, finalizações, escanteios, cartões e posse. Você escolhe o recorte (últimos 5, 10 ou todos os disponíveis). Quando a fonte não traz a estatística detalhada de um jogo, a média usa só os jogos que têm o dado e o painel informa quantos foram. A “Leitura da partida” é um texto automático feito só com esses números — não é recomendação.',
  },
  {
    q: 'O que são os “Mercados por ângulo”?',
    a: 'Para cada mercado (mais de 1,5 gols, ambos marcam, time marca, escanteios, cartões…) mostramos em quantos jogos ele aconteceu, olhando o time por vários ângulos: últimos 10 e 5 jogos, jogando em casa ou fora, na mesma competição e no confronto direto. Ex.: “7/10 nos últimos 10 jogos”. É frequência do passado — ajuda a ver se um padrão é consistente ou só uma fase, mas não é previsão nem garantia.',
  },
  {
    q: 'O radar de escanteios mostra escanteios nos primeiros 10 minutos?',
    a: 'Não. A fonte atual informa o total de escanteios por partida, sem o minuto de cada um. O radar mostra médias gerais a favor e cedidas, com o tamanho da amostra, e deixa essa limitação explícita.',
  },
  {
    q: 'Como os jogos do dia são organizados?',
    a: 'Mostramos todos os jogos da data escolhida, no horário de Brasília, agrupados por país e por competição. Você pode filtrar por país e por liga.',
  },
  {
    q: 'Quais planos existem e qual a diferença?',
    a: 'Semanal (R$ 13,90), mensal (R$ 41,90) e anual (R$ 399,90, equivalente a R$ 33,33/mês). Todos liberam os mesmos recursos.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'Os pagamentos são processados pelo Asaas, por Pix ou cartão, em uma página segura. O acesso é liberado assim que o pagamento é confirmado, e a assinatura renova automaticamente a cada período até você cancelar.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim. Em Minha conta › Assinatura você cancela com um clique. O acesso continua até o fim do período já contratado.',
  },
  {
    q: 'Funciona no celular? Funciona sem internet?',
    a: 'O site foi feito para o celular e pode ser adicionado à tela inicial. Ele precisa de internet para carregar jogos e análises — não há modo offline.',
  },
  {
    q: 'Como falo com o suporte?',
    a: 'Pelo nosso servidor no Discord (link no rodapé e no fim desta página) ou pelo e-mail contato.greengoal@gmail.com.',
  },
  {
    q: 'Quem desenvolve o GreenGoal?',
    a: 'O GreenGoal é desenvolvido pela PredyX IAs.',
  },
  {
    q: 'Vocês aceitam apostas?',
    a: 'Não. O GreenGoal não é casa de apostas, não recebe apostas e não intermedeia pagamentos de apostas.',
  },
]
