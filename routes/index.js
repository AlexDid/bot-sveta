const express = require('express');
const VKApi = require('node-vkapi');
// import * as firebase from 'firebase';

const credentials = require('../credentials');
const replyVariants = require('../replyVariants');
const config = require('../configFirebase');

const router = express.Router();
const VK    = new VKApi();


const commands = [
    [/([Нн]апомни\s)(сегодня\s)?(в\s)(\d{1,2}:\d{2})/, 'add today at', ]
];

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
                    return userSubscribed = true;
                }
            }).then(respond => {
                if(userSubscribed) {

                }
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
