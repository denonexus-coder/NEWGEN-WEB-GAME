/* ===== 00 · Nomes globais únicos + treinadores ===== */
const FN=['Lucas','Mateus','Rafael','Diego','Bruno','Thiago','Caio','Pedro','Gabriel','Andre','Felipe','Renan','Igor','Davi','Hugo','Leo','Enzo','Nico','Tomas','Iago','Joao','Vitor','Ruan','Kaue','Alan','Everton','Fernando','Gustavo','Ian','Juliano','Kaique','Marcos','Otavio','Paulo','Ricardo','Simon','Talles','Vinicius','Wesley','Yuri','Zeca'];
const LN=['Silva','Costa','Souza','Lima','Rocha','Nunes','Dias','Mota','Cruz','Luz','Alves','Pires','Melo','Rangel','Viana','Teles','Prado','Brito','Leal','Naves','Pinto','Ramos','Gomes','Moura','Barros','Freitas','Campos','Vieira','Cardoso','Tavares','Correia','Batista'];
const CT=['Ronaldo','Zico','Telê','Aguiar','Ferraz','Miranda','Peixoto','Sampaio','Braga','Queiroz','Andrade','Vasques','Coutinho','Ribeiro','Muller','Capello','Bielsa','Mourinho'];
const CLN=['Ferraz','Sampaio','Braga','Queiroz','Andrade','Vasques','Miranda','Peixoto','Telles','Aguiar','Coutinho','Ribeiro','Muller','Castro','Nogueira','Barbosa','Pereira','Gomes'];
/* gera um nome de jogador nunca usado (usado = Set global de todos os elencos) */
function mkPlayerName(used){
  let n;
  do{ n=FN[rnd()*FN.length|0]+' '+LN[rnd()*LN.length|0]; }while(used.has(n));
  used.add(n);
  return n;
}
/* nome de treinador único */
function mkCoachName(used){
  let n;
  do{ n=CT[rnd()*CT.length|0]+' '+CLN[rnd()*CLN.length|0]; }while(used.has(n));
  used.add(n);
  return n;
}
