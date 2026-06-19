require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    message: "Backend працює ✅"
  });
});

app.get("/analyze-channel", async (req, res) => {
  const channelUrl = req.query.url;

  res.json({
    message: "Маршрут /analyze-channel працює ✅",
    receivedUrl: channelUrl || null
  });
});

app.listen(PORT, () => {
  console.log(`Backend запущено на порті ${PORT}`);
});