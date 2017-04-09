module.exports = {
    newMsgUnsub: [
        'Здравствуйте, {{NAME}}! К сожалению, я не обнаружила Вас в списках компании. Пожалуйста, оформите подписку.',
        "Доброго времени суток, {{NAME}}! К сожалению, Ваш код доступа недействителен, оформите, пожалуйста подписку.",
        "Приветствую, {{NAME}}! Вижу, Вы первый раз в нашей компании. Пройдите, пожалуйста, на главную страницу компании для оформления подписки.",
        "Добро пожаловать в нашу компанию, {{NAME}}! Для продолжения работы, пройдите, пожалуйста процедуру оформления подписки. Спасибо.",
        "Здравствуйте, {{NAME}}! Я Ваша личная секретарша Светлана Олеговна. Перед началом работы оформите, пожалуйста, подписку на нашу компанию."
    ],
    newMsgSub: [
        "Здравствуйте, {{NAME}}! Чем могу помочь?",
        "А, снова Вы, {{NAME}}! Чем могу быть полезна?",
        "Слушаю Вас, {{NAME}}",
        "Да, {{NAME}}? Чем-то помочь?"
    ],
    groupJoin: [
        "Отдел кадров одобрил Вашу заявку. Теперь мы можем приступить к работе. Могу я чем-то помочь?",
        "Ваша заявка прошла регистрацию, поздравляю! Теперь я к Вашим услугам.",
        "Поздравляю Вас с пополнением рядов нашей компании! Чем могу помочь?",
        "Ваши документы оформлены, спасибо. Могу ли я чем-то Вам помочь?"
    ],
    groupLeave: [
        "Всего хорошего, {{NAME}}! Надеюсь, мы с Вами еще увидимся!",
        "Приятно было поработать с Вами, {{NAME}}! Успехов Вам!",
        "Спасибо за сотрудничество, {{NAME}}! Всего хорошего!"
    ],
    pastDate: [
        'К сожалению, я не смогу вернуться в прошлое и напомнить это Вам. Укажите верную дату и время!',
        'Вы указали прошедшую дату и время!',
        'Укажите, пожалуйста, правильную дату и время!',
        'Похоже, эта дата уже в прошлом. Давайте лучше смотреть в будущее.'
    ],
    help:
        'Доступные команды:\n\n' +
            '-напомни (сегодня/завтра/дата*) в время* напоминание*\n' +
            'Примеры:\n' +
            'напомни мне завтра в 15:40 купить молока\n' +
            'напомни 20.10.2017 в 10:30 купить билеты на концерт\n\n' +
            '-напомни через (N* минут/часов)/(час/полчаса)/(время*) напоминание*\n' +
            'Примеры:\n' +
            'напомни через полчаса лечь спать\n' +
            'напомни через 2 часа посмотреть мемы\n' +
            'напомни через 4:30 наконец пойти домой с этой скучной работы\n\n' +
            '-напоминай каждый день/день_недели*/число_месяца* в время* напоминание*\n' +
            'Примеры:\n' +
            'напоминай мне каждый день в 9:00 делать зарядку\n' +
            'напоминай каждую пятницу в 18:00 ходить с друзьями в бар и пить латвийское пиво\n' +
            'напоминай каждое 21 число в 10:00 требовать у начальника зарплату\n\n' +
            '-покажи все напоминания\n\n' +
            '-покажи напоминания на сегодня/завтра/неделю/месяц/дату*\n' +
            'Примеры:\n' +
            'покажи напоминания на неделю\n' +
            'покажи напоминания на 23.11.2017\n\n' +
            '-измени (текст/дату/время) (последнего/номер_напоминания*) напоминания на напоминание*/дату*/время*\n' +
            'Примеры:\n' +
            'измени текст последнего напоминания на покрасить стены в желтый цвет\n' +
            'измени дату 23 напоминания на 17.03.2017\n\n' +
            '-удали (последнее/номер_напоминания*) напоминание\n\n' +
            'Обозначения:\n\n' +
            'дата* - дата в формате ДД.ММ.ГГГГ или ДД/ММ/ГГГГ или ДД ММ ГГГГ или ДД-ММ-ГГГГ\n' +
            'Пример: 20.10.2017, 15-11-2018, 11/01/2017, 03 05 2017\n\n' +
            'время* - время в формате ЧЧ:ММ\n' +
            'Пример: 15:30, 14:45, 02:17\n\n' +
            'напоминание* - текст Вашего напоминания\n\n' +
            'N* - число от 1 до 59\n\n' +
            'день_недели* - день недели в винительном падеже (понедельник, вторник, среду, четверг, пятницу, субботу, воскресенье)\n\n' +
            'число_месяца* - число месяца в формате "25 число" / "3 число" и тд\n\n' +
            'номер_напоминания* - номер вашего напоминания в виде числа. Например: 15, 245896, 334. Номер показывается при добавлении нового напоминания. Если забыли номер, то можете попросить меня показать Ваши напоминания и найти нужное'

};