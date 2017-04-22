const VKApi = require('node-vkapi');
const VK    = new VKApi();

module.exports.getRandomReply = function(replyArr) {
    if(Array.isArray(replyArr)) {
        return replyArr[Math.floor(Math.random() * replyArr.length)];
    } else {
        return false;
    }
};

module.exports.getDateObj = function(date, hours, minutes, day, month, year, weekday) {
    let currentDate = date;
    return {
        hours: hours || currentDate.getHours(),
        minutes: minutes || currentDate.getMinutes(),
        day: day || currentDate.getDate(),
        month: month || currentDate.getMonth() + 1,
        year: year || currentDate.getFullYear(),
        weekday: weekday || currentDate.getDay(),
        completeDate: niceLookingDate(hours || currentDate.getHours()) + ':' + niceLookingDate(minutes || currentDate.getMinutes()) + ' ' + niceLookingDate(day || currentDate.getDate()) + '.' + niceLookingDate(month || currentDate.getMonth()+1) + '.' + (year || currentDate.getFullYear()),
        dateWithoutTime: niceLookingDate(day || currentDate.getDate()) + '.' + niceLookingDate(month || currentDate.getMonth()+1) + '.' + (year || currentDate.getFullYear())
    };
};

module.exports.niceLookingDate = function (date) {
    return niceLookingDate(date);
};

//Sends basic message
module.exports.sendMessage = function (userId, accessToken, rerplyMessage, receivedMsgId) {
    return sendMessage(userId, accessToken, rerplyMessage, receivedMsgId)
};

module.exports.sendFewMessages = function (msg, mes, userId, token, receivedMsgId) {
    if(typeof mes === 'object') {
        sendMessage(userId, token, msg, receivedMsgId);
        mes.forEach(ms => {
            sendMessage(userId, token, ms, receivedMsgId);
        });
    } else {
        sendMessage(userId, token, msg, receivedMsgId);
        sendMessage(userId, token, mes, receivedMsgId);
    }
};

function niceLookingDate(date) {
    return date.toString().length < 2 ? '0' + date : date;
}

function sendMessage(userId, accessToken, replyMessage, receivedMsgId) {
    return VK.call('users.get', {
        user_ids: userId,
        lang: 'ru'
    })
        .then(res => {
            const userFirstName = res[0].first_name;
            const message = replyMessage.replace('{{NAME}}', userFirstName);

            return VK.call('messages.send', {
                message: message,
                user_id: userId,
                access_token: accessToken
            });
        })
        .then(res => {
            console.log('Message read and answered: ' + (receivedMsgId !== undefined ? receivedMsgId : ('User ' + userId)));
        })
        .catch(error => {
            console.log(error);
        });
}