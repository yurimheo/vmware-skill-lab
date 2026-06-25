const STORAGE_KEY = "vmware-skill-lab:vks-l100";

const state = {
  moduleIndex: 0,
  questionIndex: 0,
  answers: {},
};

const els = {
  moduleList: document.querySelector("#moduleList"),
  moduleTitle: document.querySelector("#moduleTitle"),
  overallProgressText: document.querySelector("#overallProgressText"),
  overallProgressBar: document.querySelector("#overallProgressBar"),
  scoreText: document.querySelector("#scoreText"),
  introPanel: document.querySelector("#introPanel"),
  startButton: document.querySelector("#startButton"),
  conceptTitle: document.querySelector("#conceptTitle"),
  conceptBody: document.querySelector("#conceptBody"),
  commandBank: document.querySelector("#commandBank"),
  questionArea: document.querySelector("#questionArea"),
  prevQuestionButton: document.querySelector("#prevQuestionButton"),
  nextQuestionButton: document.querySelector("#nextQuestionButton"),
  checkButton: document.querySelector("#checkButton"),
  resetButton: document.querySelector("#resetButton"),
  resultBody: document.querySelector("#resultBody"),
};

function normalizeCommand(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getQuestionKey(moduleId, questionIndex) {
  return `${moduleId}:${questionIndex}`;
}

function getCurrentModule() {
  return window.VKS_L100.modules[state.moduleIndex];
}

function getCurrentQuestion() {
  return getCurrentModule().questions[state.questionIndex];
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.moduleIndex = saved.moduleIndex ?? 0;
    state.questionIndex = saved.questionIndex ?? 0;
    state.answers = saved.answers ?? {};
  } catch {
    state.answers = {};
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      moduleIndex: state.moduleIndex,
      questionIndex: state.questionIndex,
      answers: state.answers,
    }),
  );
}

function getAllQuestions() {
  return window.VKS_L100.modules.flatMap((module) =>
    module.questions.map((question, index) => ({ module, question, index })),
  );
}

function getScore() {
  const all = getAllQuestions();
  const correct = all.filter(({ module, index }) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.correct;
  }).length;
  return { correct, total: all.length };
}

function getModuleScore(module) {
  const total = module.questions.length;
  const correct = module.questions.filter((_, index) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.correct;
  }).length;
  const answered = module.questions.filter((_, index) => state.answers[getQuestionKey(module.id, index)]).length;
  return { correct, total, answered };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderModules() {
  els.moduleList.innerHTML = window.VKS_L100.modules
    .map((module, index) => {
      const score = getModuleScore(module);
      const active = index === state.moduleIndex ? " active" : "";
      return `
        <button class="module-button${active}" type="button" data-module-index="${index}">
          <span class="module-index">${index + 1}</span>
          <span>
            <span class="module-name">${module.shortTitle}</span>
            <span class="module-meta">${score.answered}/${score.total} answered</span>
          </span>
          <span class="module-score">${score.correct}/${score.total}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-module-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.moduleIndex = Number(button.dataset.moduleIndex);
      state.questionIndex = 0;
      saveState();
      render();
    });
  });
}

function renderConcept() {
  const module = getCurrentModule();
  els.moduleTitle.textContent = `${window.VKS_L100.track} ${window.VKS_L100.level}`;
  els.conceptTitle.textContent = module.title;
  els.conceptBody.innerHTML = `
    <div class="callout">${module.summary}</div>
    <ul>
      ${module.concepts.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
  els.commandBank.innerHTML = `
    <p class="eyebrow">Command Bank</p>
    ${module.commands.map((command) => `<code class="command-chip">${escapeHtml(command)}</code>`).join("")}
  `;
}

function renderQuestion() {
  const module = getCurrentModule();
  const question = getCurrentQuestion();
  const key = getQuestionKey(module.id, state.questionIndex);
  const saved = state.answers[key];

  let inputHtml = "";
  if (question.type === "choice") {
    inputHtml = `
      <div class="choice-list">
        ${question.options
          .map((option, index) => {
            const selected = saved?.value === index ? " selected" : "";
            return `<button class="choice-button${selected}" type="button" data-choice="${index}">${option}</button>`;
          })
          .join("")}
      </div>
    `;
  } else {
    inputHtml = `
      <div class="terminal-box">
        <div class="terminal-prompt">student@vks-lab:~$</div>
        <input class="command-input" id="commandInput" value="${escapeHtml(saved?.value ?? "")}" autocomplete="off" spellcheck="false" placeholder="kubectl ..." />
      </div>
    `;
  }

  const feedbackClass = saved ? (saved.correct ? " correct" : " wrong") : "";
  const feedbackText = saved
    ? `${saved.correct ? "정답입니다." : "다시 확인해보세요."} ${question.explanation}${question.sample ? ` 예: ${question.sample}` : ""}`
    : "답을 선택하거나 명령어를 입력한 뒤 정답 확인을 누르세요.";

  els.questionArea.innerHTML = `
    <div class="question-card">
      <div class="question-meta">
        <span>${module.shortTitle}</span>
        <span>${state.questionIndex + 1} / ${module.questions.length}</span>
      </div>
      <p class="question-text">${question.prompt}</p>
      ${inputHtml}
      <div class="feedback${feedbackClass}">${feedbackText}</div>
    </div>
  `;

  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = Number(button.dataset.choice);
      state.answers[key] = {
        value: choice,
        correct: false,
        checked: false,
      };
      saveState();
      renderQuestion();
    });
  });

  const commandInput = document.querySelector("#commandInput");
  if (commandInput) {
    commandInput.addEventListener("input", () => {
      state.answers[key] = {
        value: commandInput.value,
        correct: false,
        checked: false,
      };
      saveState();
    });
    commandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") checkAnswer();
    });
  }

  els.prevQuestionButton.disabled = state.moduleIndex === 0 && state.questionIndex === 0;
}

function checkAnswer() {
  const module = getCurrentModule();
  const question = getCurrentQuestion();
  const key = getQuestionKey(module.id, state.questionIndex);
  const saved = state.answers[key];

  if (!saved && question.type === "choice") return;

  let correct = false;
  let value = saved?.value ?? "";

  if (question.type === "choice") {
    correct = value === question.answer;
  } else {
    const input = document.querySelector("#commandInput");
    value = normalizeCommand(input?.value ?? "");
    correct = question.patterns.some((pattern) => new RegExp(pattern).test(value));
  }

  state.answers[key] = {
    value,
    correct,
    checked: true,
  };
  saveState();
  render();
}

function moveQuestion(delta) {
  const module = getCurrentModule();
  const nextQuestion = state.questionIndex + delta;

  if (nextQuestion >= 0 && nextQuestion < module.questions.length) {
    state.questionIndex = nextQuestion;
  } else if (delta > 0 && state.moduleIndex < window.VKS_L100.modules.length - 1) {
    state.moduleIndex += 1;
    state.questionIndex = 0;
  } else if (delta < 0 && state.moduleIndex > 0) {
    state.moduleIndex -= 1;
    state.questionIndex = window.VKS_L100.modules[state.moduleIndex].questions.length - 1;
  }

  saveState();
  render();
}

function renderProgress() {
  const score = getScore();
  const percent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  els.overallProgressText.textContent = `${percent}%`;
  els.overallProgressBar.style.width = `${percent}%`;
  els.scoreText.textContent = `${score.correct} / ${score.total}`;
}

function renderResults() {
  const score = getScore();
  const percent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  const moduleRows = window.VKS_L100.modules.map((module) => {
    const moduleScore = getModuleScore(module);
    const modulePercent = moduleScore.total ? Math.round((moduleScore.correct / moduleScore.total) * 100) : 0;
    return { module, moduleScore, modulePercent };
  });
  const weak = moduleRows.filter((row) => row.modulePercent < 70);

  els.resultBody.innerHTML = `
    <div class="result-summary">
      <div class="metric"><span>총점</span><strong>${percent}%</strong></div>
      <div class="metric"><span>정답</span><strong>${score.correct}</strong></div>
      <div class="metric"><span>문항</span><strong>${score.total}</strong></div>
    </div>
    <div class="skill-bars">
      ${moduleRows
        .map(
          ({ module, moduleScore, modulePercent }) => `
            <div class="skill-row">
              <span>${module.shortTitle}</span>
              <div class="bar"><span style="width:${modulePercent}%"></span></div>
              <strong>${moduleScore.correct}/${moduleScore.total}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <ul class="review-list">
      ${
        weak.length
          ? weak.map(({ module }) => `<li>${module.title} 파트를 다시 복습하는 것이 좋습니다.</li>`).join("")
          : "<li>현재 기준으로 모든 파트가 안정권입니다. L200 학습으로 확장해도 좋습니다.</li>"
      }
    </ul>
  `;
}

function render() {
  renderModules();
  renderConcept();
  renderQuestion();
  renderProgress();
  renderResults();
}

els.startButton.addEventListener("click", () => {
  els.introPanel.scrollIntoView({ behavior: "smooth", block: "end" });
});

els.checkButton.addEventListener("click", checkAnswer);
els.prevQuestionButton.addEventListener("click", () => moveQuestion(-1));
els.nextQuestionButton.addEventListener("click", () => moveQuestion(1));
els.resetButton.addEventListener("click", () => {
  if (!confirm("저장된 진행률을 초기화할까요?")) return;
  state.moduleIndex = 0;
  state.questionIndex = 0;
  state.answers = {};
  saveState();
  render();
});

loadState();
render();
