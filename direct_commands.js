module.exports = function(dependencies){
    const {model, tools, moment, client, db, keep} = dependencies;
    const direct_commands = {
        throttle: {},
        valid: function(message){
            if(message.channel.type != 'dm'){ return false; }
            if(typeof message.content != 'string'){ return false; }
            if(message.content.length > 200){ return false; }
            let parts = message.content.split(' ').map(p=>p.toLowerCase().trim().replace(',', ''));
            let direct_command = parts[0].replace(model.command_prefix, '').trim();
            if(direct_commands.throttle[message.author.id]){ return false; }
            let command_args = parts.length > 1 ? parts.slice(1) : []; 
            if(!direct_commands.items[direct_command]){ return false; }
            if(model.reserved_direct_commands[direct_command] && message.author.id != model.user_id){ 
                if(model.reserved_direct_commands[direct_command] != 'admins'){ return false; }
                if(model.admins.indexOf(message.author.id) == -1){ return false; }
            }
            return {direct_command:direct_command, command_args:command_args};
        },
        run: function(message){
            let valid = direct_commands.valid(message);
            if(!valid){ return false; }
            direct_commands.throttle[message.author.id] = true;
            setTimeout(function(){
                delete(direct_commands.throttle[message.author.id]);
            }, 5000);
            const member = client.guilds.get(model.guild_id).members.get(message.author.id);
            if(!member){ return false; }
            if(member.roles.array().filter(role => role.id == model.new_members.role_id).length == 1){
                message.channel.send(model.new_members.you_need_gold);
                return false;
            }
            //a watchlist for disruptive users who may spam the bot
            let watched = db.prepare('SELECT id FROM watchlist WHERE username=:username OR user_id=:user_id').get(
                {username: member.username, user_id: member.id}
            );
            if(watched){ return false; }
            let reply = direct_commands.items[valid.direct_command].call(this, valid.command_args, member, message.channel);
            if(reply && typeof reply === 'string'){
                message.channel.send(reply);
                keep.direct_command({
                    user_id: message.author.id,
                    item: valid.direct_command,
                    arguments: valid.command_args.join(' '),
                    reply: reply
                });
            }
            return reply;
        },
        items: {
            ajuda: function(command_args, member, channel){ 
                let text = model.help_text + model.extra_help_text;
                return text;
            },
            concordia: function(command_args, member, channel){ 
                var token = tools.randomTokenFromID(member.id); 
                var identification = {
                    user_id: member.id,
                    displayName: member.displayName,
                    joinedTimestamp: moment(member.joinedTimestamp).format('YYYY-MM-DD HH:mm:ss'),
                    displayAvatarURL: member.user.displayAvatarURL,
                    token: token
                };
                let identified = db.prepare(`
                SELECT user_id, timestamp FROM member WHERE user_id=:user_id AND level IS NULL
                AND timestamp=(SELECT MAX(timestamp) FROM member WHERE user_id=:user_id)
                `).get({user_id:member.id});
                if(identified){
                    identification.timestamp = identified.timestamp;
                    let update_sql = `
                    UPDATE member SET timestamp=STRFTIME('%Y-%m-%d %H:%M:%S','now'), 
                    displayName=:displayName, joinedTimestamp=:joinedTimestamp, displayAvatarURL=:displayAvatarURL, token=:token 
                    WHERE user_id=:user_id AND timestamp=:timestamp
                    `;
                    db.prepare(update_sql).run(identification);
                }else{
                    let insert_sql = `INSERT INTO member(${Object.keys(identification).join(', ')}) VALUES(:${Object.keys(identification).join(', :')})`;
                    db.prepare(insert_sql).run(identification);
                }
                return token;
            }
        }
    };
    return direct_commands;
}
