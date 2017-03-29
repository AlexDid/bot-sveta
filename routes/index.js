const express = require('express');
const VKApi = require('node-vkapi');

const credentials = require('../credentials');
const replyVariants = require('../replyVariants');

const router = express.Router();
const VK    = new VKApi();


router.post('/', function(req, res, next) {
    switch(req.body.type) {
        case 'confirmation':
            res.send(credentials.confirmationToken);
            break;

        case 'message_new':
            const userId = req.body.object.user_id;
            const receivedMsgId = req.body.object.id;
            const receivedMessageBody = req.body.object.body.toLowerCase();


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
