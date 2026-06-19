const analyzeBtn = document.getElementById("analyzeBtn");
const resultBox = document.getElementById("result");

function isYouTubeChannelUrl(url) {
  if (!url.includes("youtube.com")) {
    return false;
  }

  const channelPatterns = [
    "/@",
    "/channel/",
    "/c/",
    "/user/"
  ];

  return channelPatterns.some((pattern) => url.includes(pattern));
}

function formatNumber(number) {
  return new Intl.NumberFormat("uk-UA").format(number);
}

function renderList(items) {
  if (!items || items.length === 0) {
    return "<li>Немає даних</li>";
  }

  return items.map((item) => `<li>${item}</li>`).join("");
}

function renderAnalysis(data) {
  const scores = data.metrics.scores;
  const conclusion = data.metrics.conclusion;

  return `
    <div class="score-card">
      <div class="score-title">Niche Score</div>
      <div class="score-value">${scores.nicheScore}/10</div>
      <div class="verdict">${scores.verdict}</div>
    </div>

    <div class="channel-info">
      <strong>${data.channel.title}</strong><br>
      Підписники: ${formatNumber(data.channel.subscribers)}<br>
      Проаналізовано відео: ${data.metrics.analyzedVideos}
    </div>

    <div class="metric">
      <span>Конкуренція</span>
      <strong>${scores.competition.value}/10 — ${scores.competition.label}</strong>
    </div>

    <div class="metric">
      <span>Актуальність</span>
      <strong>${scores.relevance.value}/10 — ${scores.relevance.label}</strong>
    </div>

    <div class="metric">
      <span>Попит</span>
      <strong>${scores.demand.value}/10 — ${scores.demand.label}</strong>
    </div>

    <div class="metric">
      <span>Орієнтовний RPM</span>
      <strong>${scores.estimatedRpm}</strong>
    </div>

    <div class="metric">
      <span>Evergreen-потенціал</span>
      <strong>${scores.evergreen.value}/10 — ${scores.evergreen.label}</strong>
    </div>

    <div class="metric">
      <span>Частота публікацій</span>
      <strong>${scores.publishingFrequency.value}</strong>
    </div>

    <div class="metric">
      <span>Середні перегляди</span>
      <strong>${formatNumber(scores.averageViews.value)}</strong>
    </div>

    <div class="metric">
      <span>Views/Subscribers ratio</span>
      <strong>${scores.viewsSubscribersRatio.value}</strong>
    </div>

    <div class="metric">
      <span>Шанс для нового каналу</span>
      <strong>${scores.newChannelChance.value}/10 — ${scores.newChannelChance.label}</strong>
    </div>

    <div class="metric">
      <span>Ризик demonetization</span>
      <strong>${scores.demonetizationRisk.value}/10 — ${scores.demonetizationRisk.label}</strong>
    </div>

    <div class="metric">
      <span>Стабільність ніші</span>
      <strong>${scores.nicheStability.value}/10 — ${scores.nicheStability.label}</strong>
    </div>

    <div class="metric">
      <span>Потенціал росту</span>
      <strong>${scores.growthPotential.value}/10 — ${scores.growthPotential.label}</strong>
    </div>

    <div class="conclusion">
      <h2>Сильні сторони</h2>
      <ul>${renderList(conclusion.strengths)}</ul>

      <h2>Слабкі сторони</h2>
      <ul>${renderList(conclusion.weaknesses)}</ul>

      <h2>Висновок</h2>
      <p>${conclusion.summary}</p>
    </div>
  `;
}

analyzeBtn.addEventListener("click", async () => {
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = "Аналізую канал...";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const currentUrl = tab.url || "";

    if (!currentUrl.includes("youtube.com")) {
      resultBox.innerHTML = `
        ❌ Це не YouTube.<br><br>
        Відкрий YouTube-канал і спробуй ще раз.
      `;
      return;
    }

    if (!isYouTubeChannelUrl(currentUrl)) {
      resultBox.innerHTML = `
        ❌ Це YouTube, але не сторінка каналу.<br><br>
        Відкрий саме канал, наприклад:<br>
        https://www.youtube.com/@MrBeast
      `;
      return;
    }

    const backendUrl = `http://localhost:3000/analyze-channel?url=${encodeURIComponent(currentUrl)}`;

    const response = await fetch(backendUrl);
    const data = await response.json();

    if (!response.ok) {
      resultBox.innerHTML = `
        ❌ Помилка аналізу.<br><br>
        ${data.error || "Невідома помилка"}
      `;
      return;
    }

    resultBox.innerHTML = renderAnalysis(data);
  } catch (error) {
    resultBox.innerHTML = `
      ❌ Не вдалося підключитись до backend.<br><br>
      Перевір, чи запущений сервер:<br>
      <code>node server.js</code><br><br>
      Деталі: ${error.message}
    `;
  }
});