require("dotenv").config();
import express from "express";
import axios from "axios";
import DownloadRouter from "./routes/download";
const TelegramBot = require("node-telegram-bot-api");
import { isInstagramPostUrl, getMenu, uploadMedia } from "./utils/utils";

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const app = express();

app.use("/download", DownloadRouter);

app.get("/", (req, res) => {
  res.send("Hello World");
});

const users: any = {};

bot.on("message", async (msg: any) => {
  const msgText = msg.text;
  const chatId = msg.chat.id;

  /** /start -> Send welcome message */
  if (msgText === "/start") {
    bot.sendMessage(
      chatId,
      "Welcome to InstaSaver Bot! Please share the Instagram post link to upload the media."
    );
    return;
  }

  /** if the message is a valid Instagram post link */
  if (isInstagramPostUrl(msgText)) {
    bot.sendMessage(chatId, "Processing your request. Please wait...");

    const { data } = await axios.get(
      `http://localhost:3000/download?url=${msgText}`
    );

    if (data.error) return bot.sendMessage(chatId, data.error);

    users[chatId] = { step: 2, data };

    const menu = getMenu(data);
    bot.sendMessage(chatId, menu);

    return;
  } else {
    if (!users[chatId])
      bot.sendMessage(chatId, "Please enter a valid Instagram post link");

    const data = users[chatId]?.data;

    switch (users[chatId]?.step) {
      case 2:
        if (msgText === "1") {
          bot.sendMessage(chatId, "Publishing the post. Please wait...");
          const uploadResponse: any = await uploadMedia(data);

          // console.log({ )
          if (!uploadResponse || uploadResponse.error) {
            bot.sendMessage(chatId, `Error: Internal Server Error`);

            delete users[chatId];
          } else {
            bot.sendMessage(
              chatId,
              `Post published successfully!\nPost: ${uploadResponse?.url}\n\nTo make another post, send another Instagram post link.\n`
            );

            delete users[chatId];
          }
        } else if (msgText === "2") {
          bot.sendMessage(
            chatId,
            `Old caption: ${data.title}\n\nEnter new caption:`
          );
          users[chatId].step = 3;
          users[chatId].prevSelection = "caption";
        } else if (msgText === "3") {
          const menu = getMenu(data);
          bot.sendMessage(
            chatId,
            `Location: ${data.location}\nYou can change the location through instagram only.\n\n---- Restart -----${menu}`
          );
        } else if (msgText === "4") {
          if (data.type === "sidecar") {
            const media = data.edges.map(
              (media: any, index: any) => `${index + 1}: ${media.url}\n`
            );

            const responseText = `Download Links: \n${media.join("\n")}`;
            bot.sendMessage(chatId, responseText);
          } else {
            bot.sendMessage(chatId, `Download Link: \n${data.url}`);
          }

          bot.sendMessage(
            chatId,
            "Please send an Instagram post link to start again."
          );
          delete users[chatId];
        } else if (msgText === "5") {
          bot.sendMessage(
            chatId,
            "Upload cancelled. Please send an Instagram post link to start again."
          );
          delete users[chatId];
        } else {
          bot.sendMessage(
            chatId,
            "Invalid option. Please select a valid option."
          );
        }
        break;
      case 3:
        if (users[chatId].prevSelection === "caption") {
          data.title = msgText;
        } else {
          data.location = msgText;
        }

        const menu = getMenu(data);
        bot.sendMessage(chatId, menu);
        users[chatId].step = 2;
        delete users[chatId].prevSelection;
        break;
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
