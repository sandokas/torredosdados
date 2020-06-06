# ♜Torre dos Dados
*Bota para o servidor RPG Portugal no Discord. Faz parte de um projecto mais alargado de desenvolvimento de soluções para a comunidade de roleplayers Portuguesa. Mais informação [na respectiva página](https://rpgportugal.com/torre/).*

### Criar novos comandos
Se quiseres criar um novo comando para o servidor, podes ver como são estruturados no objecto commands. Todos os comandos usados publicamente estão em Português. Recebem um array de argumentos, o [member](https://discord.js.org/#/docs/main/stable/class/GuildMember) que escreveu o comando e o [channel](https://discord.js.org/#/docs/main/stable/class/TextChannel) onde o comando foi escrito. Devolvem uma string que é publicada no canal junto com o username de quem escreveu o comando. Se excepcionalmente precisares que a tua função seja assíncrona, vê o caso do comando copia. Retornas false para à partida não dizer nada e depois tratas de responder directamente no canal.

### Onde está o model.json
É um ficheiro de configuração que inclui o token secreto da bota. O objecto inclui esse `token`, o `sqlite_path` para a base de dados, o `guild_id`do servidor RPG Portugal, o `user_id` de quem tem acesso a todos os comandos da bota, um array de IDs dos `admins`, etc. Em `log` ficam os dados relativos a um outro servidor que é usado para facilitar o debug dos vários comandos. A estrutura completa é algo deste género:
`
{
    "token":"XXXXXX",
    "sqlite_path": "../..",
    "guild_id":"123456789",
    "user_id":"123456789",
    "admins":[
        "123456789",
        "123456789",
        "123456789",
        "123456789",
        "123456789"
    ],
    "new_members":{
        "role_id":"123456789",
        "channel_id":"123456789",
        "rules_channel_id":"123456789",
        "greeting": "Bem-vindo(a) ao rpgportugal.com! Aqui podes apresentar-te à comunidade. Procuras jogar RPGs tabletop? Em que região de Portugal? Online? Que jogos te interessam?"
    },
    "log":{
        "guild_id":"123456789",
        "channel_id":"123456789"
    },
    "command_prefix":"!",
    "reserved_commands": {"hello":true, "count":true, "roles":true, "invites":true, "channels":true, "copia":"admins", "rpgpt":"admins"},
    "delete_commands": {"copia":true, "rpgpt":true},
    "keep_delay": 600000,
    "roles":{
        "d20": "123456789",
        "coc": "123456789",
        "wod": "123456789",
        "pbta": "123456789",
        "forged": "123456789",
        "fate": "123456789",
        "warhammer": "123456789",
        "l5r": "123456789",
        "savage": "123456789",
        "starwars": "123456789",
        "yearzero": "123456789",
        "gumshoe": "123456789",
        "bilhete": "123456789"
    },
    "help_text": "Eu sou a Torre dos Dados, a bota que está sempre em beta :sweat_smile:\nPosso dar-te roles para identificar o que jogas se me deres o comando `!quero` :+1:\nPosso lançar dados por ti através de comandos como `!d20`, `!2d6`, `!6d10` ou `!4df` :game_die:\nConsulta https://rpgportugal.com/torre/ se quiseres saber mais sobre mim.",
    "data":{
        "ready_count": 1
    }
}
`


### Issues e Pull requests 
A bota só faz sentido no único servidor para o qual ela foi criada, pelo que o seu desenvolvimento pode ser trabalhado participando no https://rpgportugal.com/, nomeadamente no canal #oficina-dos-givHackers. Obrigado pelo teu interesse! 

