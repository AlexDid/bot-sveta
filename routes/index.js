const express = require('express');
const VKApi = require('node-vkapi');
// import * as firebase from 'firebase';

const credentials = require('../credentials');
const replyVariants = require('../replyVariants');
const config = require('../configFirebase');

const router = express.Router();
const VK    = new VKApi();


const regexes = {
    add: {
        at: /(сегодня|завтра|послезавтра|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d))? в ((\d|[0-1]\d|2[0-3]):([0-5]\d)) (.+)/,
        after: /через (([1-5]\d?) (минут[уы]?|час[аов]{0,2})|(час|полчаса)|((\d|1\d|2[0-3]):([0-5]\d))) (.+)/
    }
};

// firebase.initializeApp(config);


router.post('/', function(req, res, next) {
    switch(req.body.type) {
        case 'confirmation':
            res.send(credentials.confirmationToken);
            break;

        case 'message_new':
            const userId = req.body.object.user_id;
            const receivedMsgId = req.body.object.id;
            const receivedMessageBody = req.body.object.body.toLowerCase();

            let userSubscribed = false;

            VK.call('messages.markAsRead', {
                message_ids: receivedMsgId,
                access_token: credentials.accessToken
            });

            console.log('Message received: ' + receivedMsgId);

            //Check if user is subscribed to this public and propose to do it if not
            VK.call('users.getSubscriptions', {
                user_id: userId
            }).then(subscriptions => {
                if(!subscriptions.groups.items.includes(credentials.group_id)) {
                    console.log('User is not subscribed');
                    const replyMessage = getRandomReply(replyVariants.newMsgUnsub);
                    return sendMessage(userId, credentials.accessToken, replyMessage, receivedMsgId);
                } else {
                    console.log('User is subscribed');
                    userSubscribed = true;
                }
            }).then(respond => {
                if(userSubscribed) {
                    let userRequest,
                        setupDate,
                        reminder,
                        message;
                    //TODO: add replies for 'привет' & etc
                    switch(receivedMessageBody.split(' ')[0]) {
                        case 'напомни':

                            if(receivedMessageBody.match(regexes.add.at)) {
                                userRequest =  receivedMessageBody.match(regexes.add.at);
                                reminder = userRequest[8];

                                setupDate = getDateObj(new Date(), userRequest[6], userRequest[7]);
                                
                                if(userRequest[1] === 'завтра') {
                                    setupDate.day++;
                                }

                                if(userRequest[1] === 'послезавтра') {
                                    setupDate.day = setupDate.day + 2;
                                }

                                if(userRequest[2]) {
                                    setupDate.day = userRequest[2];
                                    setupDate.month = userRequest[3];
                                    setupDate.year = userRequest[4];
                                }

                            } else if(receivedMessageBody.match(regexes.add.after)) {
                                userRequest = receivedMessageBody.match(regexes.add.after);
                                reminder = userRequest[8];

                                setupDate = getDateObj(new Date());

                                if(userRequest[2]) {
                                    if(userRequest[3].includes('минут')) {
                                        setupDate.minutes = setupDate.minutes + (+userRequest[2]);
                                    } else if(userRequest[3].includes('час')) {
                                        setupDate.hours = setupDate.hours + (+userRequest[2]);
                                    }
                                }

                                if(userRequest[4]) {
                                    if(userRequest[4] === 'час') {
                                        setupDate.hours++;
                                    } else if(userRequest[4] === 'полчаса') {
                                        setupDate.minutes = setupDate.minutes + 30;
                                    }
                                }

                                if(userRequest[5]) {
                                    setupDate.hours = setupDate.hours + (+userRequest[6]);
                                    setupDate.minutes = setupDate.minutes + (+userRequest[7]);
                                }

                                //round date
                                setupDate = getDateObj(new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes));
                            }
                            break;

                        default:
                            break;
                    }

                    if(reminder) {
                        message = 'Ваше напоминание: "' + reminder + '", будет прислано ' + (setupDate.day < 10 ? '0' + setupDate.day : setupDate.day) + '.' + (setupDate.month < 10 ? '0' + setupDate.month : setupDate.month) + '.' + setupDate.year + ' в ' + setupDate.hours + ':' + setupDate.minutes;
                    } else {
                        message = 'Неверный запрос! Для получения помощи напишите "помощь"'
                    }
                    sendMessage(userId, credentials.accessToken, message, receivedMsgId);
                }
            }).catch(err => {
                console.log('ERROR: ' + err);
            });


            res.send('ok');
            break;

        case 'group_join':
            const joinedUserId = req.body.object.user_id;
            const groupJoinReply = getRandomReply(replyVariants.groupJoin);
            console.log('User joined: ' + joinedUserId);
            sendMessage(joinedUserId, credentials.accessToken, groupJoinReply);
            res.send('ok');
            break;

        case 'group_leave':
            const leavedUserId = req.body.object.user_id;
            const groupLeaveReply = getRandomReply(replyVariants.groupLeave);
            console.log('User left: ' + leavedUserId);
            sendMessage(leavedUserId, credentials.accessToken, groupLeaveReply);
            res.send('ok');
            break;


        default:
            console.log('SOMETHING ELSE ' + req);
            res.send('ok');
            break;
    }
});

module.exports = router;

//Sends basic message
function sendMessage(userId, accessToken, replyMessage, receivedMsgId) {
    return VK.call('users.get', {
        user_ids: userId
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

function getRandomReply(replyArr) {
    if(Array.isArray(replyArr)) {
        return replyArr[Math.floor(Math.random() * replyArr.length)];
    } else {
        return false;
    }
}

function getDateObj(date, hours, minutes, day, month, year) {
    let currentDate = date;
    return {
        hours: hours || currentDate.getHours(),
        minutes: minutes || currentDate.getMinutes(),
        day: day || currentDate.getDate(),
        month: month || currentDate.getMonth() + 1,
        year: year || currentDate.getFullYear()
    };
}
