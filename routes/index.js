const express = require('express');
const VKApi = require('node-vkapi');
const firebase = require('firebase');
const admin = require("firebase-admin");

const credentials = require('../config/credentials');
const replyVariants = require('../replyVariants');
const config = require('../config/config.firebase');
const serviceAccount = require('../config/firebase.admin.json');

const router = express.Router();
const VK    = new VKApi();


const regexes = {
    add: {
        at: /(сегодня|завтра|послезавтра|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d))? в ((\d|[0-1]\d|2[0-3]):([0-5]\d)) (.+)/,
        after: /через (([1-5]\d?) (мин[уты]{0,3}|ч[асов]{0,4})|(час|полчаса)|((\d|1\d|2[0-3]):([0-5]\d))) (.+)/,
        every: /(кажд[ыйоеую]{2}) (день|понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье|(0?[1-9]|[12][0-9]|3[01]) число) в ((\d|1\d|2[0-3]):([0-5]\d)) (.*)/
    },
    show: {
        all: /все напоминания/,
        for: /напоминания на (сегодня|завтра|послезавтра|неделю|месяц|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d))/
    },
    change: /(время|дату|текст) (последнего|\d+(?:_\d+)?) напоминания на ((\d|[0-1]\d|2[0-3]):([0-5]\d)|(0?[1-9]|[12][0-9]|3[01])[- /.](0?[1-9]|1[012])[- /.](20\d\d)|.*)/,
    delete: /(последнее|\d+(?:_\d+)?) напоминание/
};

const weekDays = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://bot-sveta.firebaseio.com"
});

const database = admin.database();


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
                            //TODO: add "напомни в субботу"

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
                                    if(userRequest[3].includes('мин')) {
                                        setupDate.minutes = setupDate.minutes + (+userRequest[2]);
                                    } else if(userRequest[3].includes('ч')) {
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
                            }

                            if(reminder) {
                                //round date
                                setupDate = getDateObj(new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes));

                                let date = new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes).getTime();

                                message = 'Ваше напоминание: "' + reminder + '", будет прислано ' + niceLookingDate(setupDate.day) + '.' + niceLookingDate(setupDate.month) + '.' + setupDate.year + ' в ' + niceLookingDate(setupDate.hours) + ':' + niceLookingDate(setupDate.minutes);

                                writeNewReminder(date, userId, receivedMsgId, reminder);
                            }
                            break;

                        case 'напоминай':
                            if(receivedMessageBody.match(regexes.add.every)) {
                                let day, weekday, month, index = 0, dates = [];

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
                                    dates.push(new Date(setupDate.year, (month ? month : setupDate.month) - 1, day, userRequest[5], userRequest[6]).getTime());
                                } while(new Date(dates[dates.length - 1]).getFullYear() === setupDate.year);

                                dates.forEach(function (date) {
                                    index++;
                                    writeNewReminder(date, userId, receivedMsgId + '_' + index, reminder);
                                });
                                message = 'Ваше напоминание: "' + reminder + '", будет присылаться ' + userRequest[1] + ' ' + userRequest[2] + ' в ' + niceLookingDate(userRequest[5]) + ':' + niceLookingDate(userRequest[6]) + ', начиная с ' + niceLookingDate(new Date(dates[0]).getDate()) + '.' + niceLookingDate(new Date(dates[0]).getMonth() + 1) + '.' + new Date(dates[0]).getFullYear();
                            }
                            break;

                        case 'покажи':

                            if(receivedMessageBody.match(regexes.show.for)) {
                                let fromTime, toTime;
                                userRequest = receivedMessageBody.match(regexes.show.for);
                                setupDate = getDateObj(new Date());

                                if(userRequest[2]) {
                                    setupDate = getDateObj(new Date(userRequest[4], userRequest[3] -1 , userRequest[2]));

                                    fromTime = new Date(userRequest[4], userRequest[3] - 1, userRequest[2], 0, 0).getTime();
                                    toTime = new Date(userRequest[4], userRequest[3] - 1, +userRequest[2] + 1, 0, 0).getTime();

                                    message = 'Ваши напоминания на ' + setupDate.dateWithoutTime + ':';

                                } else {
                                    switch(userRequest[1]) {
                                        case 'завтра':
                                            fromTime = new Date(setupDate.year, setupDate.month - 1, +setupDate.day + 1, 0, 0).getTime();
                                            toTime = new Date(setupDate.year, setupDate.month - 1, +setupDate.day + 2, 0, 0).getTime();
                                            break;

                                        case 'послезавтра':
                                            fromTime = new Date(setupDate.year, setupDate.month - 1, +setupDate.day + 2, 0, 0).getTime();
                                            toTime = new Date(setupDate.year, setupDate.month - 1, +setupDate.day + 3, 0, 0).getTime();
                                            break;

                                        case 'неделю':
                                            fromTime = new Date(setupDate.year, setupDate.month - 1, setupDate.day, 0, 0).getTime();
                                            toTime = new Date(setupDate.year, setupDate.month - 1, +setupDate.day + 8, 0, 0).getTime();
                                            break;

                                        case 'месяц':
                                            fromTime = new Date(setupDate.year, setupDate.month - 1, setupDate.day, 0, 0).getTime();
                                            toTime = new Date(setupDate.year, setupDate.month, +setupDate.day + 1, 0, 0).getTime();
                                            break;
                                    }

                                    message = 'Ваши напоминания на ' + userRequest[1] + ':';
                                }

                                console.log(fromTime);
                                console.log(toTime);

                                showReminders(userId, receivedMsgId, fromTime, toTime);

                            } else if(receivedMessageBody.match(regexes.show.all)) {
                                message = 'Все Ваши напоминания: ';
                                showReminders(userId, receivedMsgId);
                            }

                            break;

                        case 'измени':
                            if(receivedMessageBody.match(regexes.change)) {
                                userRequest = receivedMessageBody.match(regexes.change);

                                if(userRequest[1] === 'время' && !(userRequest[4] && userRequest[5]))  {
                                        message = 'Неправильно указано время!';
                                        break;
                                }

                                if(userRequest[1] === ' дату' && !(userRequest[6] && userRequest[7] && userRequest[8])) {
                                        message = 'Неправильно указана дата!';
                                        break;
                                }

                                message = 'none';
                                editDeleteReminder('edit', userId, receivedMsgId, userRequest[2], userRequest[1], userRequest[3]);
                            }
                            break;

                        case 'удали':
                            if(receivedMessageBody.match(regexes.delete)) {
                                userRequest = receivedMessageBody.match(regexes.delete);
                                message = 'none';
                                editDeleteReminder('delete', userId, receivedMsgId, userRequest[1]);
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

                        case 'спасибо':
                        case 'спасибочки':
                            message = getRandomReply(replyVariants.thanks);
                            break;

                        default:
                            break;
                    }

                    if(!message) {
                        message = 'Неверный запрос! Для получения помощи напишите "помощь"'
                    }

                    if(message !== 'none') {
                        sendMessage(userId, credentials.accessToken, message, receivedMsgId);
                    }
                }
            }).catch(err => {
                console.log('ERROR: ' + err);
                message = 'Неверный запрос! Для получения помощи напишите "помощь"';
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

//TODO: is it necessary to use this function? mb round | mb get method for complete Date dd.mm.yyyy
//Maybe return rounded Date
function getDateObj(date, hours, minutes, day, month, year, weekday) {
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
}

function niceLookingDate(date) {
    return date.toString().length < 2 ? '0' + date : date;
}

function writeNewReminder(date, userId, reminderId, reminder) {
    database.ref('dates/' + date + '/' + reminderId).set({user_id: userId, reminder: reminder});
    database.ref('users/' + userId + '/' + reminderId).set({date: date, reminder: reminder});
}

function showReminders(userId, receivedMsgId, fromTime, toTime) {
    database.ref().child('users').child(userId).once("value", function (snapshot) {
        let reminders = snapshot.val();
        let messages = [];
        let message = '';

        for(let reminderId in reminders) {
            const date = getDateObj(new Date(reminders[reminderId].date)).completeDate;
            messages.push(reminders[reminderId].date + ' ' + date + ' - ' + reminders[reminderId].reminder + ' (' + reminderId + ')\n');
        }

        messages = messages.sort();

        if(fromTime && toTime) {
            messages = messages.filter(reminder => {
                const reminderDate = reminder.match(/\d{13}/);

                return reminderDate >= fromTime && reminderDate < toTime;
            });
        }

        if(messages.length === 0) {
            message = 'Нет напоминаний';
        } else {
            message = messages.join('');
            message = message.replace(/\d{13}/g, '');
        }
        setTimeout(() => {
            sendMessage(userId, credentials.accessToken, message, receivedMsgId);
        }, 2000);
    });
}

function editDeleteReminder(mode, userId, receivedMsgId, reminderId, changeValueType, changeValue) {
    let updates = {};

    database.ref().child('users').child(userId).once("value", function (snapshot) {
        let reminders = snapshot.val(),
            remindersKeys = Object.keys(reminders).sort((a, b) => a < b ? 1 : -1),
            remindersToChange = [],
            message;


        //get last reminder and if it is repeatable, then slice the '_\d'
        if(reminderId === 'последнего' || reminderId === 'последнее') {
            reminderId = remindersKeys[0];
            if(reminderId.includes('_')) {
                reminderId = reminderId.slice(0, reminderId.indexOf('_'));
            }
        }

        //get all instances of reminder
        remindersKeys.forEach(rem => {
            if(rem.match(new RegExp(reminderId + '_\\d+')) || rem === reminderId) {
                remindersToChange.push(rem);
            }
        });

        if(remindersToChange.length === 0) {
            message = 'Неверный ID напоминания!';
            return sendMessage(userId, credentials.accessToken, message, receivedMsgId);
        }

            remindersToChange.forEach(rem => {
                let setupDate = new Date(+reminders[rem].date);
                let reminder = reminders[rem].reminder;

                if(mode === 'delete') {
                    updates['/users/' + userId + '/' + rem] = null;
                    updates['/dates/' + reminders[rem].date + '/' + rem] = null;

                    return message = 'Ваше напоминание ' + reminderId + ' удалено!';
                }

                const time = changeValue.match(/(\d{2}):(\d{2})/);
                const date = changeValue.match(/(\d+)[- /.](\d+)[- /.](\d+)/);

                if(changeValueType === 'время') {
                    setupDate.setHours(time[1]);
                    setupDate.setMinutes(time[2]);
                } else if(changeValueType === 'дату') {
                    setupDate.setDate(date[1]);
                    setupDate.setMonth(date[2] - 1);
                    setupDate.setFullYear(date[3]);
                } else if(changeValueType === 'текст') {
                    reminder = changeValue;
                }

                if(setupDate.getTime() <= new Date().getTime()) {
                    return message = getRandomReply(replyVariants.pastDate);
                }

                if(remindersToChange.length > 1 && changeValueType === 'дату') {
                    updates['/users/' + userId + '/' + rem] = null;
                    updates['/dates/' + reminders[rem].date + '/' + rem] = null;

                    updates['/users/' + userId + '/' + reminderId] = {date: setupDate.getTime(), reminder: reminder};
                    updates['/dates/' + setupDate.getTime() + '/' + reminderId] = {reminder: reminder, user_id: userId};
                } else {
                    updates['/users/' + userId + '/' + rem] = {date: setupDate.getTime(), reminder: reminder};
                    updates['/dates/' + reminders[rem].date + '/' + rem] = null;
                    updates['/dates/' + setupDate.getTime() + '/' + rem] = {reminder: reminder, user_id: userId};

                }

                setupDate = getDateObj(new Date(setupDate.getTime()));

                message = changeValueType.charAt(0).toUpperCase() + changeValueType.slice(1) + ' Вашего ' + reminderId + ' напоминания изменен(а)! Я напомню "' + reminder + '" ' + setupDate.completeDate;
            });

        database.ref().update(updates);

        return sendMessage(userId, credentials.accessToken, message, receivedMsgId);
    });
}