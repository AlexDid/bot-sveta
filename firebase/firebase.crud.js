const firebase = require('firebase');
const admin = require("firebase-admin");

const serviceAccount = require('../config/firebase.admin.json');

const func = require('../var/functions');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://bot-sveta.firebaseio.com"
});

const database = admin.database();

module.exports.writeNewReminder = function(date, userId, reminder) {
    database.ref().child('users').child(userId).once("value", function (snapshot) {
        let reminders = snapshot.val(),
            reminderId,
            remindersKeys = [],
            index = 0;

        if(!reminders) {
            remindersKeys = ['0'];
        } else {
            remindersKeys = Object.keys(reminders).sort((a, b) => naturalCompare(b, a));
        }

        reminderId = +remindersKeys[0].match(/(\d+)/)[1] + 1;

        if(typeof date === 'number') {
            database.ref('dates/' + date + '/' + userId + '_' + reminderId).set({user_id: userId, reminder: reminder});
            database.ref('users/' + userId + '/' + reminderId).set({date: date, reminder: reminder});
        } else if(typeof date === 'object') {
            date.forEach(function (dt) {
                index++;
                database.ref('dates/' + dt + '/' + userId + '_' + reminderId + '_' + index).set({user_id: userId, reminder: reminder});
                database.ref('users/' + userId + '/' + reminderId + '_' + index).set({date: dt, reminder: reminder});
            });
        }
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

            if(message.length > 4096) {
                 const count = Math.floor(message.length / 4096);
                 for(let i = 0; i <= count; i++) {
                     messageArray.push(message.slice(4096 * i, 4096 * (i + 1)));
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
            if(rem.match(new RegExp(reminderId + '_\\d+')) || rem === reminderId) {
                remindersToChange.push(rem);
            }
        });

        if(remindersToChange.length === 0) {
            return 'Неверный ID напоминания!';
        }

        remindersToChange.forEach(rem => {
            let setupDate = new Date(+reminders[rem].date);
            let reminder = reminders[rem].reminder;

            if(mode === 'delete') {
                updates['/users/' + userId + '/' + rem] = null;
                updates['/dates/' + reminders[rem].date + '/' + userId + '_' + rem] = null;

                return message = 'Ваше напоминание ' + reminderId + ' удалено!';
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