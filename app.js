const model = require('./model.json');
const tools = require('./tools.js');
const request = require('request');
const EventEmitter = require('events').EventEmitter;
const save = new EventEmitter();
const moment = require('moment'); moment.locale('pt');
const CronJob = require('cron').CronJob;
const Discord = require('discord.js');
const client = new Discord.Client();
const db = require('better-sqlite3')(model.sqlite_path, {fileMustExist:true});
db.defaultSafeIntegers(true); //https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/integer.md
process.on('exit', function(){ db.close(); console.log('<<< ending process'); } );
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
console.log('>>> starting process');

model.countMembers =()=>{
    let guild = client.guilds.get(model.guild_id);
    model.data.available = guild.available;
    if(!model.data.available){ 
        save.emit('downDiscord', model.data);
        return false; 
    }
    let valid_members = guild.members.array().filter( m => (!m.user.bot && m.roles.size > 0) );//not counting members without roles or bots
    model.data.memberCount = valid_members.length;
    if(valid_members.length > 0){
        model.data.onlineCount = valid_members.filter(m => m.presence.status != 'offline').length;
        model.data.percentage = ((model.data.onlineCount / model.data.memberCount) * 100).toFixed();
    }else{
        model.data.onlineCount = 0;
        model.data.percentage = 0;
    }
    let new_members = valid_members.filter(function(member){
        return (member.roles.array().filter(role => role.id == model.new_members.role_id).length == 1);
    }); 
    model.data.new_members_count = new_members.length;
    save.emit('countMembers', model.data)
    keep.new_members(new_members);    
    return model.data;
};
model.countRoles =()=>{
    let guild = client.guilds.get(model.guild_id);
    model.data.available = guild.available;
    if(!model.data.available){ 
        save.emit('downDiscord', model.data);
        return false; 
    }
    let role_count = {};
    let valid_members = guild.members.array().filter( m => (!m.user.bot && m.roles.size > 0) );//not counting members without roles or bots
    valid_members.map(function(member){
        member.roles.array().map(function(role){
            if(!role_count[role.id]){ role_count[role.id] = 0; }
            role_count[role.id] ++;
        });
    });
    let roles = [];
    guild.roles.array().map(function(role){
        if(!role_count[role.id] || role.id == guild.id){ return false; }//exclude @everyone role which has the same id as the guild
        roles.push({ id: role.id, name: role.name, members_count: role_count[role.id] });
    });
    roles.sort(function(a, b){ return b.members_count - a.members_count; });
    model.data.roles = roles;
    save.emit('countRoles', model.data)
    return model.data;
};

const commands = {
    valid: function(message){
        if(typeof message.content != 'string'){ return false; }
        if(message.content.length > 200){ return false; }
        if(message.content.indexOf(model.command_prefix) == -1){ return false; }
        let valid_lines = message.content.split("\n").filter(line=>line.indexOf(model.command_prefix) === 0);
        if(valid_lines.length != 1){ return false; }
        let parts = valid_lines[0].split(' ').map(p=>p.toLowerCase().trim().replace(',', ''));
        if(parts[0] == model.command_prefix && parts.length > 1){//prefix followed by a space and the actual command
            parts = parts.slice(1);
            parts[0] = model.command_prefix + parts[0];
        }
        if(parts[0].split(model.command_prefix).length != 2){ return false; }//one prefix character only
        let command = parts[0].replace(model.command_prefix, '');
        let command_args = parts.length > 1 ? parts.slice(1) : []; 
        if(!commands.items[command]){ return false; }
        if(model.reserved_commands[command] && message.author.id != model.user_id){ 
            if(model.reserved_commands[command] != 'admins'){ return false; }
            if(model.admins.indexOf(message.author.id) == -1){ return false; }
        }
        return {command:command, command_args:command_args};
    },
    run: function(message){
        let valid = commands.valid(message);
        if(!valid){ return false; }
        const member = client.guilds.get(model.guild_id).members.get(message.author.id);
        //a watchlist for disruptive users who may spam the bot
        let watched = db.prepare('SELECT id FROM watchlist WHERE username=:username OR user_id=:user_id').get(
            {username: member.username, user_id: member.id}
        );
        if(watched){ return false; }
        let reply = commands.items[valid.command].call(this, valid.command_args, member, message.channel);
        if(reply && typeof reply === 'string'){
            message.channel.send(`${message.author} ${reply}`);
        }
        if(model.delete_commands[valid.command]){
            message.delete();
        }
        return reply;
    },
    items: {
        count: function(command_args, member, channel){ return model.countMembers(); },
        roles: function(command_args, member, channel){ return model.countRoles(); },
        quero: function(command_args, member, channel){ 
            const keys = Object.keys(model.roles);
            let requested_keys = command_args.filter(requested_key=>keys.indexOf(requested_key)>-1);
            if(requested_keys.length == 0){
                return `Estes são os items disponíveis: ${keys.join(', ')}.\n Podes dizer por exemplo !quero ${keys[2]} ${keys[4]} ${keys[0]}`;
            }
            let requested_ids = requested_keys.map(requested_key=>model.roles[requested_key]);
            let invalid_roles = [];
            let valid_roles = [];
            requested_ids.map(function(requested_id){
                const role = client.guilds.get(model.guild_id).roles.get(requested_id);
                if(role){ valid_roles.push(role); }else{ invalid_roles.push(role); }
            });
            if(invalid_roles.length > 0){ return `O role ${invalid_roles[0].name} já não se encontra no servidor :sweat_smile:`; }
            let valid_ids = valid_roles.map(valid_role=>valid_role.id);
            if(valid_ids.length == 0){ return 'Os roles disponíveis precisam de ser reconfigurados antes de os poder atribuir :sweat_smile:'; }
            let repeated_ids = valid_ids.filter(valid_id=>member.roles.get(valid_id) != undefined);
            if(repeated_ids.length == 1 && requested_keys.length == 1){ return `Penso que já tens ${requested_keys[0]} :sweat_smile:`; }
            if(repeated_ids.length > 0){ return `Penso que já tens pelo menos alguns destes roles :sweat_smile:`; }
            member.addRoles(valid_ids);
            let answer = ` recebeste ${tools.commasAnd(valid_roles.map(valid_role=>valid_role.name))} :+1: ` ;
            answer += '*(podes retirar items com o comando !retira)*';
            return answer;
        },
        retira: function(command_args, member, channel){ 
            const values = Object.values(model.roles);
            const keys = Object.keys(model.roles);
            const current_roles = member.roles.array();
            let removable_values = current_roles.reduce(function(removable_values, role){
                if(values.indexOf(role.id) > -1){ removable_values.push(role.id); }
                return removable_values;
            }, []);
            let removable_keys = removable_values.map(value=>keys[values.indexOf(value)]);
            if(removable_values.length == 0){ return 'Não tens roles que eu possa retirar.'; }
            let valid_ids = command_args.filter(key=>removable_values.indexOf(model.roles[key])>-1).map(valid_key=>model.roles[valid_key]);
            if(valid_ids.length == 0){ return `Estes são os items que te posso retirar: ${removable_keys.join(', ')}.`; }
            let answer = ' retirei-te ' + tools.commasAnd(valid_ids.map(valid_id=>current_roles.filter(role=>role.id==valid_id)[0].name))+ ' :wave:' ;
            member.removeRoles(valid_ids);
            return answer;
        },
        invites: function(command_args, member, channel){ return behaviors.checkInvites(); },
        channels: function(command_args, member, channel){ return behaviors.briefChannels(); },
        hello: function(command_args, member, channel){ return tools.greet(moment()) + ` :wave:`; },
        ajuda: function(command_args, member, channel){ return model.help_text; },
        procura: function(command_args, member, channel){ return 'https://pt.wikipedia.org/wiki/' + tools.safeURLParam(command_args.join(' ')); },
        search: function(command_args, member, channel){ return 'https://en.wikipedia.org/wiki/' + tools.safeURLParam(command_args.join(' ')); },
        copia: function(command_args, member, channel){
            if(command_args.length < 2){ return 'Necessito de um canal e do identificador da mensagem.'; }
            let channel_id = command_args[0].replace('<#', '').replace('>', ''); 
            const source_channel = client.guilds.get(model.guild_id).channels.get(channel_id);
            source_channel.fetchMessages({around: command_args[1], limit: 1}).then(messages=>{
                let message = messages.first();
                if(!message){ var reply = 'Não encontrei essa mensagem.'; }
                else{
                    var reply = `Mensagem originalmente colocada por ${message.author}:\n` + message.content;
                    if(message.attachments.size>0){ reply += `\n${message.attachments.first().url}`; }
                }
                channel.send(reply)
            });
            return false;//have to answer asynchronously
        },
        rpgpt: function(command_args, member, channel){
            if(command_args.length < 1){ return 'https://rpgportugal.com'; }
            return 'https://rpgportugal.com/' + tools.safeURLParam(command_args[0].toLowerCase());
        },
        nível: function(command_args, member, channel){
            let found = db.prepare('SELECT SUM(level) AS level FROM "member" WHERE user_id=:user_id').get({user_id: member.id});
            if(!found){ return 'Lamento, ainda não estás no servidor à tempo suficiente para ter calculado o teu nível.'; }
            if(found.level == 0 || !found.level){ found.level = 1; }
            return `Neste momento calculo que estás a nível **${found.level}** :muscle:`;
        },
        númeroaté: function(command_args, member, channel){
            if(command_args.length != 1){ return 'Diz-me até que número eu posso escolher.'; }
            var n = parseInt(command_args[0]);
            if(!Number.isInteger(n)){ return command_args[0] + ' não é um número válido para mim.'; }
            if(n < 2){ return 'Brincalhão, dá-me um número a sério.'; }
            return `Mmmm... vou escolher o número... **${tools.random(n)}**`;
        },
        gen: function(command_args, member, channel){
            if(command_args.length == 0){ return 'Indica-me que dados Genesys lançar (ex: aapdd).'; }
            return tools.genesys.roll(client, command_args[0]);
        }
    }
};
commands.items.d100 = function(command_args, member, channel){ 
    return `${tools.emoji(client, 'd10')}${tools.emoji(client, 'd10')} **${tools.random(100)}**`; 
};
commands.items['4df'] = function(command_args, member, channel){ 
    return ` **${tools.random(3, -1) + tools.random(3, -1) + tools.random(3, -1) + tools.random(3, -1)}**`; 
};
const emoji_dice = [2,4,6,8,10,12,20, 'f'];
const dice_pools = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
emoji_dice.map(n=>{ 
    dice_pools.map(size=>{ 
        commands.items[size + 'd' + n] = function(command_args, member, channel){ 
            let modifier = false;
            if(command_args.length > 0){
                if(command_args[0].indexOf('+') == 0){
                    modifier = parseInt(command_args[0].replace('+', ''));
                    if(modifier === NaN || command_args[0].indexOf('d') > -1){ modifier = false; }//parseInt of 1d4 is still 1
                }else if(command_args[0].indexOf('-') == 0){
                    modifier = parseInt(command_args[0].replace('-', ''));
                    if(modifier === NaN || command_args[0].indexOf('d') > -1){ modifier = false; }else{ modifier = modifier*(-1); }
                } 
            }
            let dice = dice_pools.slice(0, size);
            dice = dice.map(d=>tools.random(n));
            if(command_args.indexOf('misturados') === -1){
                dice.sort((a, b) => b - a); //descending order
            }
            let total = 0;
            if(command_args.indexOf('somados') > -1 || n == 'f'){ total = dice.reduce(function(t, die){return t + die;}, 0); }
            if(modifier !== false){ total = dice.reduce(function(t, die){return t + die;}, modifier); }
            let answer = dice.reduce(function(answer, die){ return answer + `${tools.emoji(client, 'd'+n)}**${die}** `; }, ''); 
            if( (command_args.length > 0 && total > 0) || n == 'f' ){
                if(modifier === false){ answer+=` (${total})`; }else{ answer +=` (${command_args[0]} dá ${total})`;}
            }else if(commands.items[command_args[0]]){
                answer += commands.items[command_args[0]]([]);
                for(var i=1; i<4; i++){//and for a few additional dice
                    if(commands.items[command_args[i]]){ answer += commands.items[command_args[i]]([]); }
                }
            }
            return answer;
        };
    });
    commands.items['d' + n] = commands.items['1d' + n];
});

const behaviors = {
    addEntryRole: function(member){
        let watched = db.prepare('SELECT id FROM watchlist WHERE username=:username OR user_id=:user_id').get(
            {username: member.username, user_id: member.id}
        );
        if(watched){ return false; }
        member.addRole(model.new_members.role_id);
        let rules_channel = client.channels.get(model.new_members.rules_channel_id);
        let text = `Olá ${member} :wave: ${model.new_members.greeting}`;
        setTimeout(function(text){//sometimes the message appears before the member actually enters the server
            client.channels.get(model.new_members.channel_id).send(text);
        }.bind(this, text), 5000);
        behaviors.checkInvites(member);
    },
    checkInvites: function(member){//invite information is logged to help detect duplicate users or ban evasion (Discord support is currently flooded)
        let invites = db.prepare("SELECT * FROM invite WHERE logged=0 ORDER BY timestamp ASC").all();
        if(invites.length == 0){ return false; }
        let unique = {};//if there are several from the same ip, no need to show all beyond the first
        let text = invites.reduce(function(text, i){
            if(unique[i.ip]){ return text; }
            unique[i.ip] = true;
            text = text + `Convite pedido a **${i.timestamp}** pelo endereço **${i.ip}** `;
            text = text + `(browser **${i.user_agent_hash}** numa janela **${i.window_width}x${i.window_height}**)\n`;
            if(i.referrer){ text = text + ` Origem: ${i.referrer} `; }
            return text;
        }, '');
        if(invites.length == 1 || Object.keys(unique).length == 1){//localize the ip address since it's just one request
            request({url: 'http://ip-api.com/json/' + invites[0].ip, json: true}, function(error, response, data){
                if(error || !data || !data.status || data.status != 'success'){ log_channel.message(text); }
                else{
                    text = text + `Possível localização: [ ${data.country}, ${data.regionName}, ${data.city} ]`;
                    log_channel.message(text);
                }
            });
        }else{
            log_channel.message(text);
        }
        if(member && invites.length == 1){//member has just entered and only one invite is not yet logged
            db.prepare("UPDATE invite SET logged=1, possible_user_id=:possible_user_id WHERE id=:id").run(
                {possible_user_id: member.id, id: invites[0].id.toString()}
            ); 
        }else{ db.prepare("UPDATE invite SET logged=1 WHERE logged=0").run(); }
        return invites;
    },
    briefChannels: function(){
        var guild = client.guilds.get(model.guild_id);
        var relevant_channels = db.prepare("SELECT DISTINCT channel_id FROM message WHERE createdTimestamp>DATE('now', '-1 day') LIMIT 3").all();
        relevant_channels.map(function(m){
            var channel = guild.channels.get(m.channel_id.toString()); 
            if(!channel){ return false; }
            var text = `:clipboard: **${channel}** *${channel.topic}*`;
            channel.fetchPinnedMessages().then(function(pins){
                if(pins.size > 0){ var friendly_date = moment(channel.lastPinAt).format('D [de] MMMM [de] YYYY'); }
                switch(pins.size){
                    case 0: text = text + `\n:pushpin: Este canal ainda não tem mensagens afixadas.`; break;
                    case 1: text = text + `\n:pushpin: Este canal tem uma mensagem afixada a ${friendly_date}.`; break;
                    default: text = text + `\n:pushpin: Este canal tem ${pins.size} mensagens afixadas (a última a ${friendly_date})`; break;
                }
                channel.send(text);
            });
        });
        return relevant_channels;
    },
    reactToAuthorExit: function(message, after_a_while){
        if(!message || !message.author || !message.author.presence || !message.author.presence.status){ return false; }
        if(message.content || message.attachments.size>0 || message.embeds.length>0){ return false; }//should be a welcome message
        if(!after_a_while){
            if(message.author.presence.status != 'online'){ return false; }
            setTimeout(behaviors.reactToAuthorExit.bind(this, message, true), 30000);
        }else{
            let guild = client.guilds.get(model.guild_id);
            if(!guild.member(member.author.id)){ 
                let text = `Parece-me que ${message.author.username} já não se encontra no servidor. :wave:`;
                client.channels.get(model.new_members.channel_id).send(text);
            }else if(message.author.presence.status == 'online'){//still online
                setTimeout(behaviors.reactToAuthorExit.bind(this, message, true), 30000);
            }else{
                let text = `Parece-me que ${message.author} já não se encontra online. Até à próxima :wave:`;
                client.channels.get(model.new_members.channel_id).send(text);
            }
        }
    }
}

const keep = {
    message: function(message){
        if(!message || !message.id){ return false; }//maybe deleted
        let insert = {
            id: message.id, 
            content: message.cleanContent, 
            createdTimestamp: moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'),
            editedTimestamp: message.editedTimestamp ? moment(message.editedTimestamp).format('YYYY-MM-DD HH:mm:ss') : null, 
            channel_id: message.channel.id, 
            user_id: message.author.id, 
            first_attachment: message.attachments.size>0 ? message.attachments.first().url : null, 
            first_embed: message.embeds.length>0 ? message.embeds[0].url : null, 
            first_reaction_user_id: message.reactions.size>0 ? message.reactions.first().users.first().id : null, 
            first_mention_user_id: message.mentions.users.size>0 ? message.mentions.users.first().id : null, 
            word_count: message.content.split(' ').length
        };
        if(tools.userReacted(message, model.user_id, '📣')){ insert.for_publication = 1; }
        let insert_sql = `INSERT OR IGNORE INTO message(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
        db.prepare(insert_sql).run(insert);
        setTimeout(function(message){
            keep.reactions(message);
        }.bind(this, message), model.keep_delay * 36);// ex: 10 minutes times 36 is 6 hours
    },
    reactions: function(message){
        if(!message || !message.id){ return false; }//maybe deleted
        let update = {
            id: message.id,
            first_reaction_user_id: message.reactions.size>0 ? message.reactions.first().users.first().id : null, 
            for_publication: tools.userReacted(message, model.user_id, '📣') ? 1 : 0
        };
        let update_sql = `UPDATE message SET first_reaction_user_id=:first_reaction_user_id, for_publication=:for_publication WHERE id=:id`;
        db.prepare(update_sql).run(update);
    },
    count: function(data){
        let insert = {memberCount: data.memberCount, onlineCount: data.onlineCount, percentage: data.percentage};
        let insert_sql = `INSERT INTO guild(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
        db.prepare(insert_sql).run(insert);
    },
    new_members: function(new_members){
        db.prepare("DELETE FROM new_member").run(); 
        new_members.map(function(member){
            let insert = {
                user_id: member.id,
                displayName: member.displayName,
                joinedTimestamp: moment(member.joinedTimestamp).format('YYYY-MM-DD HH:mm:ss'),
                lastMessageID: member.lastMessageID,
                presence: member.presence.status
            };
            let insert_sql = `INSERT INTO new_member(${Object.keys(insert).join(', ')}) VALUES(:${Object.keys(insert).join(', :')})`;
            db.prepare(insert_sql).run(insert);
        });
    }
}

const log_channel = {
    countMembers: function(data){
        let text = `**${data.percentage}%** estão online, **${data.onlineCount}** de um total de **${data.memberCount}** no servidor`;
        text += ` (${data.new_members_count} deste total ainda são verdes).`;
        log_channel.message(text);
        return text;
    },
    countRoles: function(data){
        let relevant_data = data.roles.filter(function(role){ return (role.members_count > 5); });
        let text = relevant_data.reduce(function(text, role){
            return text + `${role.name}: ${role.members_count}\n`;
        }, `**Membros dentro de cada role com mais de 5 pessoas:**\n`);
        log_channel.message(text);
        return text;
    },
    downDiscord: function(data){
        let text = `${data.name} está em baixo.`;
        log_channel.message(text);
    },
    message: function(text){ client.channels.get(model.log.channel_id).send(text); }
};

save.on('countMembers', data=>{
    log_channel.countMembers(data);
    keep.count(data);
});
save.on('countRoles', data=>{
    log_channel.countRoles(data);
});
save.on('downDiscord', data=>{
    log_channel.downDiscord(data);
});
save.on('message_posted', message=>{
    keep.message(message);
});

client.on('ready', () => {
    let message = `${moment().format('YYYY-MM-DD hh:mm:ss')}: ${client.user.tag} obteu ligação (x${model.data.ready_count})`;
    model.data.ready_count ++;
    console.log(message);
    log_channel.message(message);
});
client.on('message', message => {
    if(message.system){ return false; }
    if(message.channel.type == 'dm'){ return false; }
    if(message.author.bot){ return false; }
    let valid_command = commands.run(message);
    if(valid_command){ return valid_command; }
    setTimeout(function(message){//give it time for edits, embeds, reactions, deletes...
        save.emit('message_posted', message); 
    }.bind(this, message), model.keep_delay); 
    behaviors.reactToAuthorExit(message);
});
client.on('guildMemberAdd', member => {
    if(member.guild.id != model.guild_id){ return false; }
    behaviors.addEntryRole(member);
});
client.on('error', error => {
	 console.error('The websocket connection encountered an error:', error);
});
client.on('reconnecting', function(){
    let message = `${moment().format('YYYY-MM-DD hh:mm:ss')}: client trying to reconnect`;
    console.log(message);
});
process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

client.login(model.token);


const job_every_5m = new CronJob('*/5 * * * *', function(){
    behaviors.checkInvites();
}, null, true, 'Europe/Lisbon');
const job_every_6h = new CronJob('20 */6 * * *', function(){
    model.countMembers();
}, null, true, 'Europe/Lisbon');
const job_every_wednesday = new CronJob('0 4 * * 3', function(){
    behaviors.briefChannels();
}, null, true, 'Europe/Lisbon');
const job_every_sunday = new CronJob('0 10 * * 0', function(){
    model.countRoles();
}, null, true, 'Europe/Lisbon');



