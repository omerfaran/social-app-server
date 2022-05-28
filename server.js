const express = require("express");
const app = express();
const cors = require("cors");

const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: "http://localhost:3000",
});

require("dotenv").config({ path: "./config.env" });
const connectDb = require("./utilsServer/connectDb");
connectDb();

app.use(express.json());
app.use(cors({}));

const PORT = process.env.PORT || 5000;

const {
  addUser,
  removeUser,
  findConnectedUser,
} = require("./utilsServer/roomActions");

const {
  loadMessages,
  sendMsg,
  setMsgToUnread,
  deleteMsg,
} = require("./utilsServer/messageActions");

io.on("connection", (socket) => {
  socket.on("join", async ({ userId }) => {
    const users = await addUser(userId, socket.id);

    setInterval(() => {
      socket.emit("connectedUsers", {
        users: users.filter((user) => user.userId !== userId),
      });
    }, 10000);
  });

  socket.on("loadMessages", async ({ userId, messagesWith }) => {
    const { chat, error } = await loadMessages(userId, messagesWith);

    !error
      ? socket.emit("messagesLoaded", { chat })
      : socket.emit("noChatFound");
  });

  socket.on("sendNewMsg", async ({ userId, msgSendToUserId, msg }) => {
    const { newMsg, error } = await sendMsg(userId, msgSendToUserId, msg);
    const receiverSocket = findConnectedUser(msgSendToUserId);

    if (receiverSocket) {
      // WHEN YOU WANT TO SEND MESSAGE TO A PARTICULAR SOCKET
      io.to(receiverSocket.socketId).emit("newMsgReceived", { newMsg });
    }
    //
    else {
      await setMsgToUnread(msgSendToUserId);
    }

    !error && socket.emit("msgSent", { newMsg });
  });

  socket.on("deleteMsg", async ({ userId, messagesWith, messageId }) => {
    const { success } = await deleteMsg(userId, messagesWith, messageId);

    if (success) socket.emit("msgDeleted");
  });

  socket.on(
    "sendMsgFromNotification",
    async ({ userId, msgSendToUserId, msg }) => {
      const { newMsg, error } = await sendMsg(userId, msgSendToUserId, msg);
      const receiverSocket = findConnectedUser(msgSendToUserId);

      if (receiverSocket) {
        // WHEN YOU WANT TO SEND MESSAGE TO A PARTICULAR SOCKET
        io.to(receiverSocket.socketId).emit("newMsgReceived", { newMsg });
      }
      //
      else {
        await setMsgToUnread(msgSendToUserId);
      }

      !error && socket.emit("msgSentFromNotification");
    }
  );
});

app.use("/api/signup", require("./api/signup"));
app.use("/api/auth", require("./api/auth"));
app.use("/api/search", require("./api/search"));
app.use("/api/posts", require("./api/posts"));
app.use("/api/profile", require("./api/profile"));
app.use("/api/notifications", require("./api/notifications"));
app.use("/api/chats", require("./api/chats"));
// app.use("/api/reset", require("./api/reset"));

httpServer.listen(PORT, () => {
  console.log("Express server running");
});
