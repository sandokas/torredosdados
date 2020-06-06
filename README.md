# ♜Torre dos Dados
*bota para o servidor RPG Portugal no Discord*

### Criar novos comandos
Se quiseres criar um novo comando para o servidor, podes ver como são estruturados no objecto commands. Todos os comandos usados publicamente estão em Português. Recebem um array de argumentos, o [member](https://discord.js.org/#/docs/main/stable/class/GuildMember) que escreveu o comando e o [channel](https://discord.js.org/#/docs/main/stable/class/TextChannel) onde o comando foi escrito. Devolvem uma string que é publicada no canal junto com o username de quem escreveu o comando. Se excepcionalmente precisares que a tua função seja assíncrona, vê o caso do comando copia. Retornas false para à partida não dizer nada e depois tratas de responder directamente no canal.

### Issues e Pull requests 
A bota só faz sentido no único servidor para o qual ela foi criada, pelo que o seu desenvolvimento pode ser trabalhado participando no https://rpgportugal.com/, nomeadamente no canal #oficina-dos-givHackers. Obrigado pelo teu interesse! 

