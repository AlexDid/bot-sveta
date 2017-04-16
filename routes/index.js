//require modules
const express = require('express');
const VKApi = require('node-vkapi');
const database = require('../firebase/firebase.js');

//require auth info
const credentials = require('../config/credentials');

//require data
const replyVariants = require('../var/replyVariants');
const regexes = require('../var/regexes');
const arrays = require('../var/arrays');
const commands = require('../var/commands');
const func = require('../var/functions');

//init modules
const router = express.Router();
const VK    = new VKApi();


//setup endpoint
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
                    const replyMessage = func.getRandomReply(replyVariants.newMsgUnsub);
                    return func.sendMessage(userId, credentials.accessToken, replyMessage, receivedMsgId);
                } else {
                    console.log('User is subscribed');
                    userSubscribed = true;
                }
            }).then(respond => {
                if(userSubscribed) {
                    let userRequest,
                        setupDate,
                        reminder,
                        message,
                        command = receivedMessageBody.match(/^(([А-Яа-я]+)([ ,])?)/)[2];


                        if(command === 'напомни') {
                            if (receivedMessageBody.match(regexes.add.after)) {
                                userRequest = receivedMessageBody.match(regexes.add.after);
                                reminder = userRequest[8];

                                setupDate = func.getDateObj(new Date());

                                if (userRequest[2]) {
                                    if(userRequest[2].match(/[А-Яа-я]+/)) {
                                        arrays.numbers.forEach(numberReg => {
                                            if(userRequest[2].toString().match(new RegExp(numberReg))) {
                                                userRequest[2] = arrays.numbers.indexOf(numberReg) + 1;
                                                if(userRequest[2] > 20) {
                                                    userRequest[2] = 20 + 10 * (userRequest[2] - 20);
                                                }
                                            }
                                        });

                                        if(userRequest[2] === 'полтора') {
                                            setupDate.minutes = setupDate.minutes + 30;
                                            userRequest[2] = 1;
                                        } else if(typeof userRequest[2] === 'string') {
                                            reminder = null;
                                            message = 'Неверно указана дата!'
                                        }
                                    }
                                    if (userRequest[3].includes('мин')) {
                                        setupDate.minutes = setupDate.minutes + (+userRequest[2]);
                                    } else if (userRequest[3].includes('ч')) {
                                        setupDate.hours = setupDate.hours + (+userRequest[2]);
                                    }
                                }

                                if (userRequest[4]) {
                                    if (userRequest[4] === 'час') {
                                        setupDate.hours++;
                                    } else if (userRequest[4] === 'полчаса') {
                                        setupDate.minutes = setupDate.minutes + 30;
                                    } else if(userRequest[4] === 'минуту') {
                                        setupDate.minutes++;
                                    }
                                }

                                if (userRequest[5]) {
                                    setupDate.hours = setupDate.hours + (+userRequest[6]);
                                    setupDate.minutes = setupDate.minutes + (+userRequest[7]);
                                }

                            } else if (receivedMessageBody.match(regexes.add.at)) {
                                userRequest = receivedMessageBody.match(regexes.add.at);
                                reminder = userRequest[8];

                                //setup time if it's not set
                                if (userRequest[6] === undefined && userRequest[7] === undefined) {
                                    userRequest[6] = 8;
                                    userRequest[7] = '0';
                                }

                                setupDate = func.getDateObj(new Date(), userRequest[6], userRequest[7]);

                                if (userRequest[1] === 'завтра') {
                                    setupDate.day++;
                                }

                                if (userRequest[1] === 'послезавтра') {
                                    setupDate.day = setupDate.day + 2;
                                }

                                if (userRequest[2]) {
                                    setupDate.day = userRequest[2];
                                    setupDate.month = userRequest[3];
                                    setupDate.year = userRequest[4];
                                }

                                if(arrays.weekDays.includes(userRequest[1])) {
                                    let weekday = arrays.weekDays.indexOf(userRequest[1]);

                                    let day = setupDate.weekday <= weekday ? setupDate.day + (weekday - setupDate.weekday) : setupDate.day + 7 - (setupDate.weekday - weekday);

                                    if (setupDate.day == day && !((setupDate.hours == userRequest[6] && setupDate.minutes < userRequest[7]) || (setupDate.hours < userRequest[6]))) {
                                        setupDate.day = day + 7;
                                    } else {
                                        setupDate.day = day;
                                    }
                                }


                                //check if user sets past date
                                if (new Date().getTime() > new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes)) {
                                    reminder = null;
                                    message = func.getRandomReply(replyVariants.pastDate);
                                }

                                //check if user's date is bigger then the last day of the month
                                if (new Date(setupDate.year, setupDate.month, 0).getDate() < setupDate.day) {
                                    setupDate.day = new Date(setupDate.year, setupDate.month, 0).getDate();
                                }

                            }

                            if (reminder) {
                                //round date
                                setupDate = func.getDateObj(new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes));

                                let date = new Date(setupDate.year, setupDate.month - 1, setupDate.day, setupDate.hours, setupDate.minutes).getTime();

                                message = 'none';

                                database.writeNewReminder(date, userId, reminder).then(mes => func.sendMessage(userId, credentials.accessToken, mes, receivedMsgId));
                            }
                        }

                        if(command === 'напоминай' && receivedMessageBody.match(regexes.add.every)) {
                                let day, weekday, month, dates = [];

                                userRequest = receivedMessageBody.match(regexes.add.every);
                                reminder = userRequest[7];
                                setupDate = func.getDateObj(new Date());

                                //setup time if it's not set
                                if (!userRequest[5] && !userRequest[6]) {
                                    if(userRequest[2] === 'утро') {
                                        userRequest[5] = 8;
                                        userRequest[6] = 0;
                                    }
                                    if(userRequest[2] === 'день') {
                                        userRequest[5] = 12;
                                        userRequest[6] = 0;
                                    }
                                    if(userRequest[2] === 'вечер') {
                                        userRequest[5] = 18;
                                        userRequest[6] = 0;
                                    }
                                }

                                if (userRequest[2] === 'вечер' || userRequest[2] === 'день' || userRequest[2] === 'утро'|| userRequest[2] === 'ежедневно') {
                                    day = ((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5])) ? setupDate.day : setupDate.day + 1;

                                    day--;
                                    if (userRequest[2] === 'ежедневно') {
                                        userRequest[1] = ' ';
                                    }

                                } else if (arrays.weekDays.includes(userRequest[2])) {
                                    weekday = arrays.weekDays.indexOf(userRequest[2]);

                                    if (weekday > 6) {
                                        weekday = weekday - 7;
                                    }

                                    day = setupDate.weekday <= weekday ? setupDate.day + (weekday - setupDate.weekday) : setupDate.day + 7 - (setupDate.weekday - weekday);

                                    if (setupDate.day == day && !((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5]))) {
                                        day = day + 7;
                                    }

                                    day = day - 7;

                                } else if (userRequest[3]) {
                                    monthDay = userRequest[3];

                                    if (monthDay >= setupDate.day) {
                                        month = setupDate.month;
                                    } else if (monthDay < setupDate.day) {
                                        month = setupDate.month + 1;
                                    }

                                    if (setupDate.day == day && !((setupDate.hours == userRequest[5] && setupDate.minutes < userRequest[6]) || (setupDate.hours < userRequest[5]))) {
                                        month++;
                                    }

                                    month--;
                                }

                                do {
                                    if (weekday) {
                                        day = day + 7;
                                    } else if (month) {
                                        day = monthDay;
                                        month++;
                                        //check if user's date is bigger then the last day of the month
                                        if (new Date(setupDate.year, month, 0).getDate() < day) {
                                            day = new Date(setupDate.year, month, 0).getDate();
                                        }
                                    } else {
                                        day++;
                                    }
                                    dates.push(new Date(setupDate.year, (month ? month : setupDate.month) - 1, day, userRequest[5], userRequest[6]).getTime());
                                } while (new Date(dates[dates.length - 1]).getFullYear() === setupDate.year);

                                database.writeNewReminder(dates, userId, reminder);

                                message = 'Ваше напоминание: "' + reminder + '", будет присылаться ' + userRequest[1] + ' ' + userRequest[2] + ' в ' + func.niceLookingDate(userRequest[5]) + ':' + func.niceLookingDate(userRequest[6]) + ', начиная с ' + func.niceLookingDate(new Date(dates[0]).getDate()) + '.' + func.niceLookingDate(new Date(dates[0]).getMonth() + 1) + '.' + new Date(dates[0]).getFullYear();
                        }

                        if(command === 'покажи') {
                            let msg = '';
                            message = 'none';

                            if (receivedMessageBody.match(regexes.show.for)) {
                                let fromTime, toTime;
                                userRequest = receivedMessageBody.match(regexes.show.for);
                                setupDate = func.getDateObj(new Date());

                                if (userRequest[2]) {
                                    setupDate = func.getDateObj(new Date(userRequest[4], userRequest[3] - 1, userRequest[2]));

                                    fromTime = new Date(userRequest[4], userRequest[3] - 1, userRequest[2], 0, 0).getTime();
                                    toTime = new Date(userRequest[4], userRequest[3] - 1, +userRequest[2] + 1, 0, 0).getTime();

                                    msg = 'Ваши напоминания на ' + setupDate.dateWithoutTime + ':\n';

                                } else {
                                    switch (userRequest[1]) {
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

                                    msg = 'Ваши напоминания на ' + userRequest[1] + ':\n';
                                }

                                database.showReminders(userId, receivedMsgId, fromTime, toTime).then(mes => func.sendFewMessages(msg, mes, userId, credentials.accessToken, receivedMsgId));

                            } else if (receivedMessageBody.match(regexes.show.all)) {
                                msg = 'Все Ваши напоминания:\n';
                                database.showReminders(userId, receivedMsgId).then(mes => func.sendFewMessages(msg, mes, userId, credentials.accessToken, receivedMsgId));
                            }

                        }

                        if(command === 'измени' && receivedMessageBody.match(regexes.change)) {
                                userRequest = receivedMessageBody.match(regexes.change);

                                if (userRequest[1] === 'время' && !(userRequest[4] && userRequest[5])) {
                                    message = 'Неправильно указано время!';
                                } else if (userRequest[1] === ' дату' && !(userRequest[6] && userRequest[7] && userRequest[8])) {
                                    message = 'Неправильно указана дата!';
                                } else {
                                    message = 'none';
                                    database.editDeleteReminder('edit', userId, receivedMsgId, userRequest[2], userRequest[1], userRequest[3]).then(mes => {
                                        func.sendMessage(userId, credentials.accessToken, mes, receivedMsgId);
                                    });
                                }
                        }

                        if(command === 'удали' && receivedMessageBody.match(regexes.delete)) {
                                userRequest = receivedMessageBody.match(regexes.delete);
                                message = 'none';
                                database.editDeleteReminder('delete', userId, receivedMsgId, userRequest[1]).then(mes => {
                                    func.sendMessage(userId, credentials.accessToken, mes, receivedMsgId);
                                });
                        }

                        if(command === 'помощь') {
                            message = replyVariants.help;
                        }

                        if(commands.hi.includes(command)) {
                            message = func.getRandomReply(replyVariants.newMsgSub);
                        }

                        if(commands.thx.includes(command)) {
                            message = func.getRandomReply(replyVariants.thanks);
                        }

                        if(commands.bye.includes(command)) {
                            message = func.getRandomReply(replyVariants.bye);
                        }

                    if(!message) {
                        message = 'Неверный запрос! Для получения помощи напишите "помощь"'
                    }

                    if(message !== 'none') {
                        func.sendMessage(userId, credentials.accessToken, message, receivedMsgId);
                    }
                }
            }).catch(err => {
                console.log('ERROR: ' + err);
                message = 'Неверный запрос! Для получения помощи напишите "помощь"';
                func.sendMessage(userId, credentials.accessToken, message, receivedMsgId);
            });
            res.send('ok');
            break;

        case 'group_join':
            const joinedUserId = req.body.object.user_id;
            const groupJoinReply = func.getRandomReply(replyVariants.groupJoin);
            console.log('User joined: ' + joinedUserId);
            func.sendMessage(joinedUserId, credentials.accessToken, groupJoinReply);
            res.send('ok');
            break;

        case 'group_leave':
            const leavedUserId = req.body.object.user_id;
            const groupLeaveReply = func.getRandomReply(replyVariants.groupLeave);
            console.log('User left: ' + leavedUserId);
            func.sendMessage(leavedUserId, credentials.accessToken, groupLeaveReply);
            res.send('ok');
            break;


        default:
            console.log('SOMETHING ELSE ' + req);
            res.send('ok');
            break;
    }
});

module.exports = router;