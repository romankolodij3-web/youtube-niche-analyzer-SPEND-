require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

app.get("/", (req, res) => {
  res.json({
    message: "Backend працює ✅"
  });
});

function getHandleFromUrl(channelUrl) {
  const match = channelUrl.match(/youtube\.com\/@([^/?#]+)/);
  return match ? match[1] : null;
}

function getChannelIdFromUrl(channelUrl) {
  const match = channelUrl.match(/youtube\.com\/channel\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function youtubeRequest(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set("key", YOUTUBE_API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function fetchChannelByHandle(handle) {
  const data = await youtubeRequest("channels", {
    part: "snippet,statistics,contentDetails",
    forHandle: handle
  });

  return data.items?.[0];
}

async function fetchChannelById(channelId) {
  const data = await youtubeRequest("channels", {
    part: "snippet,statistics,contentDetails",
    id: channelId
  });

  return data.items?.[0];
}

async function fetchLatestVideoIds(uploadsPlaylistId, maxResults = 30) {
  const data = await youtubeRequest("playlistItems", {
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults)
  });

  return data.items.map((item) => item.contentDetails.videoId);
}

async function fetchVideosDetails(videoIds) {
  if (!videoIds.length) {
    return [];
  }

  const data = await youtubeRequest("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(",")
  });

  return data.items.map((video) => ({
    videoId: video.id,
    title: video.snippet.title,
    publishedAt: video.snippet.publishedAt,
    views: Number(video.statistics.viewCount || 0),
    likes: Number(video.statistics.likeCount || 0),
    comments: Number(video.statistics.commentCount || 0),
    duration: video.contentDetails.duration || "PT0S"
  }));
}

function clampScore(score) {
  return Math.max(1, Math.min(10, Math.round(score)));
}

function getScoreLabel(score) {
  if (score >= 8) return "високий";
  if (score >= 6) return "добрий";
  if (score >= 4) return "середній";
  return "низький";
}

function getCompetitionLabel(score) {
  if (score >= 8) return "висока";
  if (score >= 6) return "добра";
  if (score >= 4) return "середня";
  return "низька";
}

function getRiskLabel(score) {
  if (score >= 8) return "високий";
  if (score >= 6) return "помітний";
  if (score >= 4) return "середній";
  return "низький";
}

function parseIsoDurationToSeconds(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

function getContentFormatStats(videos) {
  const durations = videos.map((video) =>
    parseIsoDurationToSeconds(video.duration)
  );

  const shortsCount = durations.filter(
    (seconds) => seconds > 0 && seconds <= 75
  ).length;

  const shortsRatio = videos.length > 0 ? shortsCount / videos.length : 0;

  let contentFormat = "Long-form";

  if (shortsRatio >= 0.85) {
    contentFormat = "Shorts";
  } else if (shortsRatio >= 0.4) {
    contentFormat = "Mixed";
  }

  return {
    shortsCount,
    shortsRatio: Number((shortsRatio * 100).toFixed(1)),
    contentFormat
  };
}

function estimateRpm(channel, videos) {
  const text = `${channel.snippet.title} ${channel.snippet.description} ${videos
    .map((video) => video.title)
    .join(" ")}`.toLowerCase();

  const formatStats = getContentFormatStats(videos);

  const isMostlyShorts =
    formatStats.contentFormat === "Shorts" ||
    formatStats.contentFormat === "Mixed";

  const hasAiTerm =
    /\bai\b/.test(text) ||
    text.includes("штучний інтелект") ||
    text.includes("искусственный интеллект") ||
    text.includes("нейромереж") ||
    text.includes("нейросеть");

  const isRussianOrCis =
    text.includes("папич") ||
    text.includes("стрим") ||
    text.includes("нарез") ||
    text.includes("наріз") ||
    text.includes("прохождение") ||
    text.includes("игра") ||
    text.includes("руб") ||
    text.includes("русск") ||
    text.includes("россий");

  const isGaming =
    text.includes("game") ||
    text.includes("gaming") ||
    text.includes("игра") ||
    text.includes("играет") ||
    text.includes("прохождение") ||
    text.includes("cs 2") ||
    text.includes("dota") ||
    text.includes("minecraft") ||
    text.includes("granny");

  const isStreamHighlights =
    text.includes("стрим") ||
    text.includes("нарез") ||
    text.includes("лучшее") ||
    text.includes("момент") ||
    text.includes("чат рулетка");

  const isFinance =
    text.includes("finance") ||
    text.includes("business") ||
    text.includes("crypto") ||
    text.includes("інвести") ||
    text.includes("инвести") ||
    text.includes("бізнес") ||
    text.includes("бизнес") ||
    text.includes("trading") ||
    text.includes("трейдинг");

  const isTechOrEducation =
    hasAiTerm ||
    text.includes("software") ||
    text.includes("маркетинг") ||
    text.includes("education") ||
    text.includes("навч") ||
    text.includes("обуч") ||
    text.includes("программирование");

  const isMedical =
    text.includes("лікар") ||
    text.includes("здоров") ||
    text.includes("медицина") ||
    text.includes("лікування") ||
    text.includes("симптом") ||
    text.includes("хвороб") ||
    text.includes("препарат") ||
    text.includes("doctor") ||
    text.includes("health") ||
    text.includes("medical") ||
    text.includes("medicine");

  const isCraftOrSatisfying =
    text.includes("carves") ||
    text.includes("wood") ||
    text.includes("craft") ||
    text.includes("sculpture") ||
    text.includes("satisfying") ||
    text.includes("old villager") ||
    text.includes("майстер") ||
    text.includes("різьб") ||
    text.includes("дерев");

  // Shorts оцінюємо окремо, бо RPM у Shorts значно нижчий.
  if (isMostlyShorts) {
    if (isFinance || isTechOrEducation || isMedical) {
      return "$0.05–0.40";
    }

    if (isGaming || isStreamHighlights || isRussianOrCis) {
      return "$0.02–0.15";
    }

    if (isCraftOrSatisfying) {
      return "$0.02–0.20";
    }

    return "$0.03–0.25";
  }

  // Long-form медицина.
  if (isMedical) {
    return "$1–4";
  }

  // Long-form СНД + ігри / стріми / нарізки.
  if (isRussianOrCis && (isGaming || isStreamHighlights)) {
    return "$0.3–1.2";
  }

  // Long-form ігри / стріми.
  if (isGaming || isStreamHighlights) {
    return "$0.8–2.5";
  }

  // Long-form фінанси / бізнес / крипта.
  if (isFinance) {
    return "$4–10";
  }

  // Long-form AI / софт / освіта.
  if (isTechOrEducation) {
    return "$3–7";
  }

  // Загальний СНД / російськомовний контент.
  if (isRussianOrCis) {
    return "$0.5–1.8";
  }

  return "$1–4";
}

function calculateDemonetizationRisk(channel, videos) {
  const text = `${channel.snippet.title} ${channel.snippet.description} ${videos
    .map((video) => video.title)
    .join(" ")}`.toLowerCase();

  let risk = 2;
  const riskFactors = [];

  function addRisk(condition, points, reason) {
    if (condition) {
      risk += points;
      riskFactors.push(reason);
    }
  }

  function countMatches(words) {
    return words.filter((word) => text.includes(word)).length;
  }

  const medicalWords = [
    "лікар",
    "лікування",
    "здоров",
    "медицина",
    "медич",
    "симптом",
    "діагноз",
    "хвороб",
    "препарат",
    "таблет",
    "антибіот",
    "аритмі",
    "подагр",
    "простата",
    "рак",
    "інфаркт",
    "інсульт",
    "тиск",
    "серце",
    "печінка",
    "нирк",
    "діабет",
    "гормон",
    "вітамін",
    "аналіз крові",
    "doctor",
    "health",
    "medical",
    "medicine",
    "treatment",
    "symptom",
    "disease",
    "cancer",
    "diabetes"
  ];

  const strongMedicalWords = [
    "лікування",
    "діагноз",
    "препарат",
    "таблет",
    "рак",
    "інфаркт",
    "інсульт",
    "антибіот",
    "гормон",
    "аритмі",
    "подагр",
    "простата",
    "діабет",
    "treatment",
    "diagnosis",
    "medicine",
    "cancer"
  ];

  const financeRiskWords = [
    "crypto",
    "крипта",
    "біткоїн",
    "bitcoin",
    "інвести",
    "инвести",
    "трейдинг",
    "trading",
    "forex"
  ];

  const politicsWarWords = [
    "war",
    "війна",
    "война",
    "політика",
    "политика",
    "politics",
    "санкції",
    "санкции"
  ];

  const violenceWords = [
    "убил",
    "убила",
    "убийство",
    "смерть",
    "кров",
    "насильство",
    "violence",
    "murder",
    "death"
  ];

  const gamblingWords = [
    "казино",
    "ставки",
    "беттинг",
    "betting",
    "casino"
  ];

  const adultWords = [
    "18+",
    "adult",
    "sex",
    "інтим",
    "интим"
  ];

  const aiWords = [
    "штучний інтелект",
    "искусственный интеллект",
    "нейромереж",
    "нейросеть",
    "згенеровано",
    "сгенерировано",
    "ai generated",
    "generated by ai"
  ];

  const medicalMatches = countMatches(medicalWords);
  const strongMedicalMatches = countMatches(strongMedicalWords);
  const financeMatches = countMatches(financeRiskWords);
  const politicsMatches = countMatches(politicsWarWords);
  const violenceMatches = countMatches(violenceWords);
  const gamblingMatches = countMatches(gamblingWords);
  const adultMatches = countMatches(adultWords);
  const aiMatches = countMatches(aiWords);

  addRisk(medicalMatches >= 2, 2, "медична тематика");
  addRisk(strongMedicalMatches >= 1, 1, "лікування, діагнози або препарати");
  addRisk(strongMedicalMatches >= 3, 1, "багато чутливих медичних тем");

  addRisk(
    aiMatches >= 1 && medicalMatches >= 1,
    1,
    "можливий AI-контент у медичній тематиці"
  );

  addRisk(financeMatches >= 1, 2, "фінанси, інвестиції або крипта");
  addRisk(politicsMatches >= 1, 2, "політика або війна");
  addRisk(violenceMatches >= 1, 2, "насильство або смерть у темах відео");
  addRisk(gamblingMatches >= 1, 3, "казино, ставки або азартні теми");
  addRisk(adultMatches >= 1, 3, "18+ або доросла тематика");

  return {
    score: clampScore(risk),
    factors: riskFactors
  };
}

function calculateBasicMetrics(channel, videos) {
  const subscribers = Number(channel.statistics.subscriberCount || 0);

  const totalViews = videos.reduce((sum, video) => sum + video.views, 0);

  const averageViews =
    videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  const viewsSubscribersRatio =
    subscribers > 0
      ? Number(((averageViews / subscribers) * 100).toFixed(2))
      : 0;

  const sortedDates = videos
    .map((video) => new Date(video.publishedAt))
    .sort((a, b) => a - b);

  let videosPerWeek = 0;

  if (sortedDates.length >= 2) {
    const oldestDate = sortedDates[0];
    const newestDate = sortedDates[sortedDates.length - 1];

    const daysBetween = Math.max(
      1,
      (newestDate - oldestDate) / (1000 * 60 * 60 * 24)
    );

    videosPerWeek = Number(((videos.length / daysBetween) * 7).toFixed(2));
  }

  const newest10 = videos.slice(0, 10);
  const older20 = videos.slice(10, 30);

  const newestAverage =
    newest10.length > 0
      ? newest10.reduce((sum, video) => sum + video.views, 0) /
        newest10.length
      : 0;

  const olderAverage =
    older20.length > 0
      ? older20.reduce((sum, video) => sum + video.views, 0) /
        older20.length
      : 0;

  const trendRatio = olderAverage > 0 ? newestAverage / olderAverage : 1;

  const formatStats = getContentFormatStats(videos);

  const demonetizationRisk = calculateDemonetizationRisk(channel, videos);
  const demonetizationRiskScore = demonetizationRisk.score;

  const competitionScore = clampScore(
    3 +
      (subscribers > 100000 ? 2 : 0) +
      (subscribers > 500000 ? 1 : 0) +
      (averageViews > 50000 ? 1 : 0) +
      (videosPerWeek > 4 ? 1 : 0) +
      (viewsSubscribersRatio > 10 ? 1 : 0)
  );

  const relevanceScore = clampScore(
    5 +
      (trendRatio > 1 ? 1 : 0) +
      (trendRatio > 1.5 ? 1 : 0) +
      (averageViews > 50000 ? 1 : 0) -
      (trendRatio < 0.7 ? 1 : 0)
  );

  const demandScore = clampScore(
    4 +
      (averageViews > 10000 ? 1 : 0) +
      (averageViews > 50000 ? 1 : 0) +
      (averageViews > 100000 ? 1 : 0) +
      (viewsSubscribersRatio > 5 ? 1 : 0) +
      (viewsSubscribersRatio > 15 ? 1 : 0)
  );

  const evergreenScore = clampScore(
    5 +
      (olderAverage > newestAverage * 0.5 ? 1 : 0) +
      (olderAverage > newestAverage * 0.8 ? 1 : 0) -
      (trendRatio > 2 ? 1 : 0)
  );

  const newChannelChanceScore = clampScore(
    10 -
      competitionScore +
      Math.round(demandScore / 3) +
      Math.round(relevanceScore / 4)
  );

  const stabilityScore = clampScore(
    5 +
      (videosPerWeek >= 1 ? 1 : 0) +
      (videosPerWeek >= 3 ? 1 : 0) +
      (viewsSubscribersRatio > 5 ? 1 : 0) -
      (trendRatio < 0.6 ? 1 : 0)
  );

  const growthPotentialScore = clampScore(
    Math.round((relevanceScore + demandScore + stabilityScore) / 3)
  );

  const positiveScores = [
    relevanceScore,
    demandScore,
    evergreenScore,
    newChannelChanceScore,
    stabilityScore,
    growthPotentialScore
  ];

  const invertedCompetition = 10 - competitionScore;
  const invertedDemonetization = 10 - demonetizationRiskScore;

  const nicheScore = Number(
    (
      [...positiveScores, invertedCompetition, invertedDemonetization].reduce(
        (sum, score) => sum + score,
        0
      ) / 8
    ).toFixed(1)
  );

  const strengths = [];
  const weaknesses = [];

  if (demandScore >= 7) strengths.push("високий попит");
  if (relevanceScore >= 7) strengths.push("хороша актуальність");
  if (growthPotentialScore >= 7) strengths.push("добрий потенціал росту");
  if (stabilityScore >= 7) strengths.push("стабільна активність ніші");

  if (demonetizationRiskScore <= 3) {
    strengths.push("низький ризик demonetization");
  }

  if (competitionScore >= 7) weaknesses.push("висока конкуренція");

  if (newChannelChanceScore <= 5) {
    weaknesses.push("складний старт для нового каналу");
  }

  if (evergreenScore <= 5) {
    weaknesses.push("середній або слабкий evergreen-потенціал");
  }

  if (videosPerWeek > 5) {
    weaknesses.push("потрібна часта публікація контенту");
  }

  if (demonetizationRiskScore >= 4) {
    weaknesses.push("є ризик demonetization через чутливу тематику");
  }

  if (formatStats.contentFormat === "Shorts") {
    weaknesses.push("Shorts мають нижчий RPM, ніж long-form відео");
  }

  let verdict = "Середня ніша";

  if (nicheScore >= 8) {
    verdict = "Дуже перспективна ніша";
  } else if (nicheScore >= 6.5) {
    verdict = "Хороша ніша";
  } else if (nicheScore >= 5) {
    verdict = "Середня ніша";
  } else {
    verdict = "Слабка ніша";
  }

  return {
    analyzedVideos: videos.length,

    raw: {
      averageViews,
      viewsSubscribersRatio,
      videosPerWeek,
      trendRatio: Number(trendRatio.toFixed(2)),
      shortsRatio: `${formatStats.shortsRatio}%`,
      contentFormat: formatStats.contentFormat
    },

    scores: {
      nicheScore,
      verdict,

      competition: {
        value: competitionScore,
        label: getCompetitionLabel(competitionScore)
      },

      relevance: {
        value: relevanceScore,
        label: getScoreLabel(relevanceScore)
      },

      demand: {
        value: demandScore,
        label: getScoreLabel(demandScore)
      },

      estimatedRpm: estimateRpm(channel, videos),

      evergreen: {
        value: evergreenScore,
        label: getScoreLabel(evergreenScore)
      },

      publishingFrequency: {
        value: `${videosPerWeek} відео/тиждень`
      },

      averageViews: {
        value: averageViews
      },

      viewsSubscribersRatio: {
        value: `${viewsSubscribersRatio}%`
      },

      newChannelChance: {
        value: newChannelChanceScore,
        label: getScoreLabel(newChannelChanceScore)
      },

      demonetizationRisk: {
        value: demonetizationRiskScore,
        label: getRiskLabel(demonetizationRiskScore),
        factors: demonetizationRisk.factors
      },

      nicheStability: {
        value: stabilityScore,
        label: getScoreLabel(stabilityScore)
      },

      growthPotential: {
        value: growthPotentialScore,
        label: getScoreLabel(growthPotentialScore)
      }
    },

    conclusion: {
      strengths,
      weaknesses,
      summary: `Ніша має ${getScoreLabel(
        demandScore
      )} попит і ${getScoreLabel(
        growthPotentialScore
      )} потенціал росту. Основний мінус — ${
        formatStats.contentFormat === "Shorts"
          ? "низький RPM через Shorts-формат"
          : competitionScore >= 7
          ? "висока конкуренція"
          : demonetizationRiskScore >= 4
          ? "чутлива тематика"
          : "потрібно знайти правильний формат"
      }.`
    }
  };
}

app.get("/analyze-channel", async (req, res) => {
  try {
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        error: "YOUTUBE_API_KEY не знайдено у змінних середовища"
      });
    }

    const channelUrl = req.query.url;

    if (!channelUrl) {
      return res.status(400).json({
        error:
          "Передай URL каналу. Наприклад: /analyze-channel?url=https://www.youtube.com/@MrBeast"
      });
    }

    const handle = getHandleFromUrl(channelUrl);
    const channelIdFromUrl = getChannelIdFromUrl(channelUrl);

    let channel = null;

    if (handle) {
      channel = await fetchChannelByHandle(handle);
    } else if (channelIdFromUrl) {
      channel = await fetchChannelById(channelIdFromUrl);
    } else {
      return res.status(400).json({
        error:
          "Поки що підтримуються тільки URL типу youtube.com/@channel або youtube.com/channel/UC..."
      });
    }

    if (!channel) {
      return res.status(404).json({
        error: "Канал не знайдено"
      });
    }

    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

    const videoIds = await fetchLatestVideoIds(uploadsPlaylistId, 30);
    const videos = await fetchVideosDetails(videoIds);

    const metrics = calculateBasicMetrics(channel, videos);

    const result = {
      message: "Канал проаналізовано ✅",
      channel: {
        channelId: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        publishedAt: channel.snippet.publishedAt,
        country: channel.snippet.country || null,
        subscribers: Number(channel.statistics.subscriberCount || 0),
        totalViews: Number(channel.statistics.viewCount || 0),
        totalVideos: Number(channel.statistics.videoCount || 0),
        uploadsPlaylistId
      },
      metrics,
      videos
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Помилка сервера",
      details: error.message
    });
  }
});

app.get("/test-youtube-key", async (req, res) => {
  try {
    const channel = await fetchChannelByHandle("MrBeast");

    res.json({
      message: "YouTube API працює ✅",
      channelTitle: channel?.snippet?.title,
      subscribers: channel?.statistics?.subscriberCount,
      views: channel?.statistics?.viewCount,
      videos: channel?.statistics?.videoCount
    });
  } catch (error) {
    res.status(500).json({
      error: "Помилка YouTube API",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend запущено на порті ${PORT}`);
});