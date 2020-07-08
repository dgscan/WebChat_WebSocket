var webSocketServer = require('websocket').server;
var http = require('http');
var count = 1;
var clients = {};
var users = [];

var mysql = require('mysql');

var con = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "123456",
    database: "web-chat"
});

var server = http.createServer(function (request, response) {

    console.log((new Date())+' Received request for '+request.url);
    response.writeHead(404);
    response.end();

});

server.listen(1337, function () {
   console.log((new Date())+'Server listens on port 1337');
});

wsServer = new webSocketServer({
   httpServer: server
});

con.connect(function (err) {

    if (err) throw err;
    console.log("DB connected.");

    wsServer.on('request', function (request) {

        console.log((new Date())+'New connect request received'+request.remoteAddress);
        var connection = request.accept(null, request.origin);

        var puser;

        console.log((new Date()) + 'Connection accepted');

        var id=count++;
        clients[id] = connection;

        connection.on('message', function (message) {

            var parsedMsg = JSON.parse(message.utf8Data);
            var to = parsedMsg.to;

            console.log("\nREQUEST TO:"+to+"\n");

            if(to=='login') {

                var userid = parsedMsg.uid;
                var password = parsedMsg.pass;

                console.log(userid+ " " +password+ "to:"+to);

                con.query("SELECT * FROM user_table WHERE userid='" + userid + "' AND password='" + password + "'",
                    function (err, result, fields) {

                        if (err) throw err;

                        if (result == "") {
                            console.log("no such user");
                            var loginStatus = {'uid': userid, 'isMember': false};
                            clients[id].sendUTF(JSON.stringify(loginStatus));

                            return;
                        } else if (userid == result[0].userid) {
                            console.log("successfull login");


                            var loginStatus = {'uid': userid, 'isMember': true};

                            users[id]=userid;
                            console.log("Users ID: "+users[id]+" ID:"+id);

                            clients[id].sendUTF(JSON.stringify(loginStatus));

                            //UPDATE USER AS ONLINE IN DB
                            con.query("UPDATE user_table SET isonline ='1' WHERE userid='" + userid + "'", function (err, result) {
                                if (err) throw err;
                            });

                        }

                    });

            }
            else if(to=='chat'){

                var msg = parsedMsg.msg;
                var chatLog = {'type':'chat','msg':msg,'user_id':users[id-1]};


                for (var i in clients){
                    clients[i].sendUTF(JSON.stringify(chatLog));
                }
            }
            else if(to=='loadOnlineUsers'){

                var onlineUsers = [];
                var offlineUsers = [];

                var onlineLoaded = false;
                var offlineLoaded = false;
                var userList=({'type':'loadUsers','offlineUsers':[],'onlineUsers':[]});

                con.query("SELECT userid FROM user_table where isonline='1'", function (err, result) {

                    if(err) throw err;
                    //console.log("***************************************\n");

                    for(i=0; i<result.length; i++){
                        onlineUsers.push(result[i].userid);
                        userList.onlineUsers[i] = onlineUsers[i];
                    }
                    /*
                    for(i=0; i<result.length; i++){
                        console.log(onlineUsers[i]+"\n");
                        console.log(userList.onlineUsers[i]);
                    }*/

                    onlineLoaded=true;
                });


                con.query("SELECT userid FROM user_table where isonline='0'", function (err, result) {

                    if(err) throw err;
                    //console.log("***************************************\n");

                    for(i=0; i<result.length; i++){

                        offlineUsers.push(result[i].userid);

                        userList.offlineUsers[i]=offlineUsers[i];

                    }
                    /*
                    for(i=0; i<result.length; i++){
                        //console.log(userList.offlineUsers[i]+"\n");

                        console.log("Obj user: "+userList.offlineUsers[i]);
                    }*/
                    offlineLoaded=true;

                    if(onlineLoaded && offlineLoaded){
                        clients[id].sendUTF(JSON.stringify(userList));
                    }else {

                        console.log("Online & offline users loading error.");
                    }

                });




            }
            else if(to=='register'){
                console.log("register page");

                var userid = parsedMsg.userid;
                var password = parsedMsg.password;
                var city = parsedMsg.city;

                console.log(userid+" "+" "+password+" "+city);

                con.query("INSERT INTO user_table(userid,password,city,isonline) VALUES('"+userid+"','"+password+"','"+city+"','0')", function (err, result) {

                    if(err){
                        connection.sendUTF(false);
                        throw err;

                    }else{
                        console.log("1 row registered");
                        connection.sendUTF(true);
                    }

                });

            }
            else if(to=='logout'){
                console.log((new Date())+connection.remoteAddress+"is disconnected. uid="+users[id-1]);
                delete clients[id];

                //UPDATE USER AS ONLINE IN DB
                con.query("UPDATE user_table SET isonline ='0' WHERE userid='" + users[id-1] + "'", function (err, result) {
                    if (err) throw err;
                });
                //UPDATE USER AS ONLINE IN DB
            }
            else if(to=='privateMsgTo'){

                puser = parsedMsg.msgTo;

                console.log(puser+" private room btw "+users[id-1]);

            }else{

                var msg = parsedMsg.msg;
                var chat = {'type':'privateChat','msg':msg,'user_id':users[id-1]};

                for (var i in clients) {
                    clients[i].sendUTF(JSON.stringify(chat));
                }
            }

        });

    });
});
