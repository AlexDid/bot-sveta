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
        after: /через (([1-5]\d?) (минут[уы]?|час[аов]{0,2})|(час|полчаса)|((\d|1\d|2[0-3]):([0-5]\d))) (.+)/,
        every: /(кажд[ыйоеую]{2}) (день|понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|(0?[1-9]|[12][0-9]|3[01]) число) в ((\d|1\d|2[0-3]):([0-5]\d)) (.*)/
    },
    show: {
        all: /все напоминания/,
        for: /напоминания на (сегодня|завтра|послезавтра|неделю|месяц|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d))/
    },
    change: /(время|дату|текст) (последнего|\d+) напоминания на ((\d|[0-1]\d|2[0-3]):([0-5]\d)|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d)|.*)/,
    delete: /(последнее|\d+) напоминание/
};

const weekDays = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

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

                    switch(receivedMessageBody.match(/^(([А-Яа-я]+)([ ,])?)/)[2]) {
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

                                //check if user sets past date
                                if(new Date().getTime() > new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes)) {
                                    reminder = null;
                                    message = getRandomReply(replyVariants.pastDate);
                                }

                                //check if user's date is bigger then the last day of the month
                                if(new Date(setupDate.year, setupDate.month, 0).getDate() < setupDate.day) {
                                    setupDate.day = new Date(setupDate.year, setupDate.month, 0).getDate();
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

                            if(reminder) {
                                message = 'Ваше напоминание: "' + reminder + '", будет прислано ' + niceLookingDate(setupDate.day) + '.' + niceLookingDate(setupDate.month) + '.' + setupDate.year + ' в ' + niceLookingDate(setupDate.hours) + ':' + niceLookingDate(setupDate.minutes);
                            }
                            break;

                        case 'напоминай':
                            if(receivedMessageBody.match(regexes.add.every)) {
                                let day, weekday, month, dates = [];

                                userRequest = receivedMessageBody.match(regexes.add.every);
                                reminder = userRequest[7];
                                setupDate = getDateObj(new Date());

                                if(userRequest[2] === 'день') {
                                    day = ((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5])) ? setupDate.day : setupDate.day + 1;

                                    day--;

                                } else if(weekDays.includes(userRequest[2])) {
                                    weekday = weekDays.indexOf(userRequest[2]);

                                    day = setupDate.weekday <= weekday ? setupDate.day + (weekday - setupDate.weekday) : setupDate.day + 7 - (setupDate.weekday - weekday);

                                    if(setupDate.day == day && !((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5]))) {
                                        day = day + 7;
                                    }

                                    day = day - 7;

                                } else if(userRequest[3]) {
                                    monthDay = userRequest[3];

                                    if(monthDay >= setupDate.day) {
                                        month = setupDate.month;
                                    } else if(monthDay < setupDate.day) {
                                        month = setupDate.month + 1;
                                    }

                                    if(setupDate.day == day && !((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5]))) {
                                        month++;
                                    }

                                    month--;
                                }

                                do {
                                    if(weekday) {
                                        day = day + 7;
                                    } else if(month) {
                                        day = monthDay;
                                        month++;
                                        //check if user's date is bigger then the last day of the month
                                        if(new Date(setupDate.year, month, 0).getDate() < day) {
                                            day = new Date(setupDate.year, month, 0).getDate();
                                        }
                                    } else {
                                        day++;
                                    }
                                    dates.push(getDateObj(new Date(setupDate.year, (month ? month : setupDate.month) - 1, day, userRequest[5], userRequest[6])));
                                } while(dates[dates.length - 1].year === setupDate.year);

                                message = 'Ваше напоминание: "' + reminder + '", будет присылаться ' + userRequest[1] + ' ' + userRequest[2] + ' в ' + niceLookingDate(userRequest[5]) + ':' + niceLookingDate(userRequest[6]) + ', начиная с ' + niceLookingDate(dates[0].day) + '.' + niceLookingDate(dates[0].month) + '.' + dates[0].year;
                            }
                            break;

                        case 'покажи':
                            let reminders = {};

                            if(receivedMessageBody.match(regexes.show.for)) {
                                userRequest = receivedMessageBody.match(regexes.show.for);
                                setupDate = getDateObj(new Date());

                                if(userRequest[2]) {
                                    setupDate.day = userRequest[2];
                                    setupDate.month = userRequest[3];
                                    setupDate.year = userRequest[4];
                                    //TODO: get from db all reminders for {user_id: userId, dates.day: userRequest[2], dates.month: userRequest[3]}

                                    reminder = {
                                        thisDate: []
                                    }
                                } else {
                                    let oneDay = false;
                                    switch(userRequest[1]) {
                                        case 'завтра':
                                            oneDay = true;
                                            setupDate.day++;
                                            break;

                                        case 'послезавтра':
                                            oneDay = true;
                                            setupDate.day = setupDate.day + 2;
                                            break;

                                        case 'неделю':
                                            setupDate.day = setupDate.day + 7;
                                            break;

                                        case 'месяц':
                                            setupDate.month++;
                                            break;
                                    }

                                    //round date
                                    setupDate = getDateObj(new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes));

                                    if(oneDay) {
                                        //TODO: get from db all reminders for {user_id: userId, dates.day: setupDate.day, dates.month: setupDate.month}
                                        reminders = {
                                            oneDate: []
                                        }
                                    } else {
                                        //TODO: get from db all reminders from {user_id: userId, dates.day: from now till setupDate.day, dates.month: from now till setupDate.month}
                                        reminders = {
                                            oneDate: [],
                                            anotherDate: []
                                        }
                                    }

                                }
                            } else if(receivedMessageBody.match(regexes.show.all)) {
                                //TODO: get all reminders {user_idL userId}
                                reminders = {
                                    oneDate: [],
                                    anotherDate: [],
                                    oneMoreDate: []
                                };
                            }

                            reminderMsg = reminders.map(); //TODO: return string 'oneDate: \n reminders[] \n\n anotherDate: \n reminders[]'

                            message = 'Ваши напоминания: ' + reminderMsg;
                            break;

                        case 'измени':
                            if(receivedMessageBody.match(regexes.change)) {
                                let reminderId;
                                userRequest = receivedMessageBody.match(regexes.change);
                                if(userRequest[2] === 'последнего') {
                                    reminderId = 'last'; //TODO:get last id
                                } else {
                                    reminderId = userRequest[2];
                                }

                                //TODO: check if reminderId exists. In case it doesn't - send an error

                                if(userRequest[1] === 'время') {
                                    if(userRequest[4] && userRequest[5]) {
                                        //TODO: get reminderId reminder and set time to userRequest[3] and userRequest[4]

                                        message = 'Время Вашего ' + reminderId + ' напоминания изменено! Я напомню ' + '!ТЕКСТ!' + ' в ' + userRequest[3] + ' ' + '!ДАТА!';
                                    } else {
                                        message = 'Неправильно указано время!';
                                    }
                                }

                                if(userRequest[1] === ' дату') {
                                    if(userRequest[6] && userRequest[7] && userRequest[8]) {
                                        //TODO: get reminderId reminder and set date to userRequest[5] and userRequest[6] and userRequest[7]

                                        message = 'Дата Вашего ' + reminderId + ' напоминания изменена! Я напомню ' + '!ТЕКСТ!' + ' в ' + '!ВРЕМЯ!' + ' ' + userRequest[3];
                                    } else {
                                        message = 'Неправильно указана дата!';
                                    }
                                }

                                if(userRequest[1] === 'текст') {
                                    //TODO: get reminderId reminder and set text to userRequest[2]

                                    message = 'Текст Вашего ' + reminderId + ' напоминания изменен! Я напомню ' + userRequest[3] + ' в ' + '!ВРЕМЯ!' + ' ' + '!ДАТА!';
                                }
                            }
                            break;

                        case 'удали':
                            if(receivedMessageBody.match(regexes.delete)) {
                                let reminderId;
                                userRequest = receivedMessageBody.match(regexes.delete);
                                if(userRequest[1] === 'последнее') {
                                    reminderId = 'last'; //TODO:get last id
                                } else {
                                    reminderId = userRequest[1];
                                }

                                //TODO: check if reminderId exists. In case it doesn't - send an error

                                //TODO: delete reminder

                                message = 'Ваше ' + reminderId + ' напоминание было удалено';
                            }
                            break;

                        case 'помощь':
                            message = replyVariants.help;
                            break;

                        case 'привет':
                        case 'здравствуй':
                        case 'здравствуйте':
                        case 'дарова':
                        case 'здарова':
                        case 'приветики':
                            message = getRandomReply(replyVariants.newMsgSub);
                            break;

                        default:
                            break;
                    }

                    if(!message) {
                        message = 'Неверный запрос! Для получения помощи напишите "помощь"'
                    }
                    sendMessage(userId, credentials.accessToken, message, receivedMsgId);
                }
            }).catch(err => {
                console.log('ERROR: ' + err);
                message = 'Неверный запрос! Для получения помощи напишите "помощь"'
                sendMessage(userId, credentials.accessToken, message, receivedMsgId);
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

//TODO: is it necessary to use this function?
//Maybe return rounded Date
function getDateObj(date, hours, minutes, day, month, year, weekday) {
    let currentDate = date;
    return {
        hours: hours || currentDate.getHours(),
        minutes: minutes || currentDate.getMinutes(),
        day: day || currentDate.getDate(),
        month: month || currentDate.getMonth() + 1,
        year: year || currentDate.getFullYear(),
        weekday: weekday || currentDate.getDay()
    };
}

function niceLookingDate(date) {
    return date.toString().length < 2 ? '0' + date : date;
}