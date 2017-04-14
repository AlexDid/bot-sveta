
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

function niceLookingDate(date) {
    return date.toString().length < 2 ? '0' + date : date;
}