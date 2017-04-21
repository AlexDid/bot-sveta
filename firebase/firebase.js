const admin = require("firebase-admin");

const serviceAccount = require('../config/firebase.admin.json');

const func = require('../var/functions');
const credentials = require('../config/credentials');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://bot-sveta.firebaseio.com"
});

const database = admin.database();

module.exports.writeNewReminder = function(date, userId, reminder) {
    return database.ref().child('users').child(userId).once("value").then(snapshot => {
        let reminders = snapshot.val(),
            reminderId,
            remindersKeys = [],
            message,
            index = 0;

        if(!reminders) {
            remindersKeys = ['0'];
        } else {
            remindersKeys = Object.keys(reminders).sort((a, b) => naturalCompare(b, a));
        }

        reminderId = +remindersKeys[0].match(/(\d+)/)[1] + 1;

        if (reminderId > 50) {
            addStatistics('errors/max_amount_reached');
            return 'Достигнут предел количества напоминаний (50 шт)';
        }

        if(typeof date === 'number') {
            addStatistics('bot_stat/added_reminders');
            const setupDate = func.getDateObj(new Date(date));
            database.ref('dates/' + date + '/' + userId + '_' + reminderId).set({user_id: userId, reminder: reminder});
            database.ref('users/' + userId + '/' + reminderId).set({date: date, reminder: reminder});
            message = 'Ваше напоминание номер ' + reminderId + ': "' + reminder + '", будет прислано в ' + setupDate.completeDate;
        } else if(typeof date === 'object') {
            date.forEach(function (dt) {
                addStatistics('bot_stat/added_reminders');
                index++;
                database.ref('dates/' + dt + '/' + userId + '_' + reminderId + '_' + index).set({user_id: userId, reminder: reminder});
                database.ref('users/' + userId + '/' + reminderId + '_' + index).set({date: dt, reminder: reminder});
            });
        }

        return message;
    });
};

module.exports.showReminders = function(userId, receivedMsgId, fromTime, toTime) {
    return database.ref().child('users').child(userId).once("value").then(snapshot => {
        let reminders = snapshot.val();
        let messages = [];
        let message = '',
            messageArray = [];

        for(let reminderId in reminders) {
            const date = func.getDateObj(new Date(reminders[reminderId].date)).completeDate;
            messages.push(reminders[reminderId].date + ' ' + date + ' - ' + reminders[reminderId].reminder + ' (номер ' + reminderId + ')\n');
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

            if(message.length > 4000) {
                 const count = Math.floor(message.length / 4000);
                 for(let i = 0; i <= count; i++) {
                     messageArray.push(message.slice(4000 * i, 4000 * (i + 1)));
                 }
                return messageArray;
            }
        }

        return message;
    });
};

module.exports.editDeleteReminder = function(mode, userId, receivedMsgId, reminderId, changeValueType, changeValue) {
    let updates = {};

    return database.ref().child('users').child(userId).once("value").then(snapshot => {
        let reminders = snapshot.val(),
            remindersKeys = Object.keys(reminders).sort((a, b) => naturalCompare(b, a)),
            remindersToChange = [],
            message;


        //get last reminder and if it is repeatable - then slice the '_\d'
        if(reminderId === 'последнего' || reminderId === 'последнее') {
            reminderId = remindersKeys[0];
            if(reminderId.includes('_')) {
                reminderId = reminderId.slice(0, reminderId.indexOf('_'));
            }
        }

        //get all instances of reminder
        remindersKeys.forEach(rem => {
            if(rem.match(new RegExp(reminderId + '_\\d+')) || rem === reminderId || reminderId === 'все') {
                remindersToChange.push(rem);
            }
        });

        if(remindersToChange.length === 0) {
            addStatistics('errors/invalid_reminder_id');
            return 'Неверный ID напоминания!';
        }

        remindersToChange.forEach(rem => {
            let setupDate = new Date(+reminders[rem].date);
            let reminder = reminders[rem].reminder;

            if(mode === 'delete') {
                updates['/users/' + userId + '/' + rem] = null;
                updates['/dates/' + reminders[rem].date + '/' + userId + '_' + rem] = null;

                addStatistics('bot_stat/deleted_reminders');

                if(reminderId === 'все') {
                    message = 'Все Ваше напоминания удалены!';
                } else {
                    message = 'Ваше напоминание ' + reminderId + ' удалено!';
                }

                return message;
            }

            const time = changeValue.match(/(\d{1,2}):(\d{2})/);
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
                addStatistics('errors/past_date');
                return message = func.getRandomReply(replyVariants.pastDate);
            }

            if(remindersToChange.length > 1 && changeValueType === 'дату') {
                updates['/users/' + userId + '/' + rem] = null;
                updates['/dates/' + reminders[rem].date + '/' + userId + '_' + rem] = null;

                updates['/users/' + userId + '/' + reminderId] = {date: setupDate.getTime(), reminder: reminder};
                updates['/dates/' + setupDate.getTime() + '/' + userId + '_' + reminderId] = {reminder: reminder, user_id: userId};
            } else {
                updates['/users/' + userId + '/' + rem] = {date: setupDate.getTime(), reminder: reminder};
                updates['/dates/' + [rem].date + '/' + userId + '_' + rem] = null;
                updates['/dates/' + setupDate.getTime() + '/' + userId + '_' + rem] = {reminder: reminder, user_id: userId};

            }

            setupDate = func.getDateObj(new Date(setupDate.getTime()));

            message = changeValueType.charAt(0).toUpperCase() + changeValueType.slice(1) + ' Вашего ' + reminderId + ' напоминания изменен(а)! Я напомню "' + reminder + '" в ' + setupDate.completeDate;
        });

        database.ref().update(updates);


        return message;
    });
};


module.exports.sendReminders = function() {
    let sendDate = 9999999999999;

    let sending = send();

    database.ref().child('dates').on('child_added', snapshot => {
        const newDate = snapshot.key;
        if(newDate < sendDate) {
            sendDate = newDate;
            clearTimeout(sending);
            sending = send();
        }
    });

    function send() {
        return getFirstDate().then(firstDate => {
            if(firstDate === null) {
                return setTimeout(() => {
                    return send();
                }, 1000)
            }
            sendDate = firstDate;
            const timeout = sendDate - new Date().getTime();

            console.log(timeout);

            return setTimeout(() => {
                getRemindersForDate(sendDate).then(remObj => {
                    remObj.remArray.forEach(rem => {
                        func.sendMessage(rem.user_id, credentials.accessToken, rem.reminder);
                        addStatistics('bot_stat/sent_reminders');
                    });
                    return remObj.remIds;
                }).then(remIds => {
                    deleteDate(sendDate, remIds).then(res => {
                        return send();
                    });
                })
            }, timeout);
        });
    }
};

module.exports.addStatistics = function (statGroup, data) {
  return addStatistics(statGroup, data)
};


function addStatistics(statGroup, data) {
    database.ref('/stats/' + statGroup).transaction(function(stat) {
        if (stat) {
           stat.count++;
           if(data) {
               if(stat.data[data]) {
                   stat.data[data]++;
               } else {
                   stat.data[data] =  1;
               }
           }
            return stat;
        } else {
            if(data) {
                return {
                    count: 1,
                    data: {
                        [data]: 1
                    }
                };
            } else {
                return {
                    count: 1
                }
            }
        }
    });
}

function naturalCompare(a, b) {
    let ax = [], bx = [];

    a.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { ax.push([$1 || Infinity, $2 || ""]) });
    b.replace(/(\d+)|(\D+)/g, function(_, $1, $2) { bx.push([$1 || Infinity, $2 || ""]) });

    while(ax.length && bx.length) {
        let an = ax.shift();
        let bn = bx.shift();
        let nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
        if(nn) return nn;
    }

    return ax.length - bx.length;
}

function getFirstDate() {
    return database.ref().child('dates').once('value').then(snapshot => {
        const dates = snapshot.val();

        if(dates === null) {
            return null;
        }

        return Object.keys(dates)[0];
    });
}

function getRemindersForDate(date) {
    return database.ref().child('dates').child(date).once('value').then(snapshot => {
        const reminders = snapshot.val();
        const remIds = Object.keys(reminders);
        let remArray = [];

        for(remId in reminders) {
            if(reminders.hasOwnProperty(remId)) {
                remArray.push(reminders[remId]);
            }
        }

        return {
            remArray: remArray,
            remIds: remIds
        };
    });
}

function deleteDate(date, remIds) {
    const removeDate = {};
    removeDate['/dates/' + date] = null;

    remIds.forEach(remId => {
        const remData = remId.match(/(\d+)_(\d+(?:_\d+)?)/);
        const userId = remData[1],
            userRemId = remData[2];

        removeDate['/users/' + userId + '/' + userRemId] = null;
    });

    return database.ref().update(removeDate);
}