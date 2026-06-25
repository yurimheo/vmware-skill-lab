const STORAGE_KEY = "vmware-skill-lab:vks-l100";

const state = {
  moduleIndex: 0,
  questionIndex: 0,
  focusMode: false,
  focusOrder: [],
  focusCursor: 0,
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
  focusButton: document.querySelector("#focusButton"),
  contentGrid: document.querySelector("#contentGrid"),
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

function scrollToQuiz() {
  document.querySelector(".quiz-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function normalizeCommand(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getQuestionKey(moduleId, questionIndex) {
  return `${moduleId}:${questionIndex}`;
}

function getCurrentModule() {
  if (state.focusMode) return getCurrentFocusItem().module;
  return window.VKS_L100.modules[state.moduleIndex];
}

function getCurrentQuestion() {
  if (state.focusMode) return getCurrentFocusItem().question;
  return getCurrentModule().questions[state.questionIndex];
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.moduleIndex = saved.moduleIndex ?? 0;
    state.questionIndex = saved.questionIndex ?? 0;
    state.focusMode = saved.focusMode ?? false;
    state.focusOrder = saved.focusOrder ?? [];
    state.focusCursor = saved.focusCursor ?? 0;
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
      focusMode: state.focusMode,
      focusOrder: state.focusOrder,
      focusCursor: state.focusCursor,
      answers: state.answers,
    }),
  );
}

function getAllQuestions() {
  return window.VKS_L100.modules.flatMap((module) =>
    module.questions.map((question, index) => ({ module, question, index })),
  );
}

function getAllQuestionKeys() {
  return getAllQuestions().map(({ module, index }) => getQuestionKey(module.id, index));
}

function getQuestionByKey(key) {
  const [moduleId, indexText] = key.split(":");
  const module = window.VKS_L100.modules.find((item) => item.id === moduleId);
  const index = Number(indexText);
  return { module, question: module.questions[index], index };
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function startFocusSession() {
  state.focusMode = true;
  state.focusOrder = shuffle(getAllQuestionKeys());
  state.focusCursor = 0;
  state.answers = {};
}

function getCurrentFocusItem() {
  if (!state.focusOrder.length) startFocusSession();
  const key = state.focusOrder[Math.min(state.focusCursor, state.focusOrder.length - 1)];
  return getQuestionByKey(key);
}

function getScore() {
  const all = getAllQuestions();
  const correct = all.filter(({ module, index }) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.correct;
  }).length;
  return { correct, total: all.length };
}

function getProgress() {
  const all = getAllQuestions();
  const completed = all.filter(({ module, index }) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.checked;
  }).length;
  return { completed, total: all.length };
}

function getModuleScore(module) {
  const total = module.questions.length;
  const correct = module.questions.filter((_, index) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.correct;
  }).length;
  const answered = module.questions.filter((_, index) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.checked;
  }).length;
  return { correct, total, answered };
}

function getCurrentGlobalQuestionNumber() {
  if (state.focusMode) return state.focusCursor + 1;
  const priorQuestions = window.VKS_L100.modules
    .slice(0, state.moduleIndex)
    .reduce((sum, module) => sum + module.questions.length, 0);
  return priorQuestions + state.questionIndex + 1;
}

function isLastQuestion() {
  if (state.focusMode) return state.focusCursor === state.focusOrder.length - 1;
  return getCurrentGlobalQuestionNumber() === getAllQuestions().length;
}

function getCorrectAnswerText(question) {
  if (question.type === "choice") return question.options[question.answer];
  return question.sample;
}

function getUserAnswerText(question, answer) {
  if (!answer) return "미응답";
  if (answer.skipped) return "건너뜀";
  if (question.type === "choice") return question.options[answer.value] ?? "미응답";
  return answer.value || "미응답";
}

function getIncorrectAnswers() {
  return getAllQuestions().filter(({ module, index }) => {
    const answer = state.answers[getQuestionKey(module.id, index)];
    return answer?.checked && !answer.correct;
  });
}

function isFocusComplete() {
  const progress = getProgress();
  return state.focusMode && progress.total > 0 && progress.completed === progress.total;
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
            <span class="module-meta">${score.answered}/${score.total} completed</span>
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
  const key = state.focusMode ? state.focusOrder[state.focusCursor] : getQuestionKey(module.id, state.questionIndex);
  const saved = state.answers[key];
  const globalNumber = getCurrentGlobalQuestionNumber();
  const globalTotal = state.focusMode ? state.focusOrder.length : getAllQuestions().length;

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

  const feedbackClass = saved?.checked && !state.focusMode ? (saved.correct ? " correct" : " wrong") : "";
  const feedbackText = getFeedbackText(question, saved);

  els.questionArea.innerHTML = `
    <div class="question-card">
      <div class="question-meta">
        <span>${state.focusMode ? "L100 Focus Mode" : module.shortTitle}</span>
        <span>${state.focusMode ? `${globalNumber} / ${globalTotal}` : `${state.questionIndex + 1} / ${module.questions.length}`}</span>
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

  els.prevQuestionButton.disabled = !state.focusMode && state.moduleIndex === 0 && state.questionIndex === 0;
}

function checkAnswer() {
  const didCheck = gradeCurrentQuestion();
  if (!didCheck) return;

  if (state.focusMode) {
    if (isLastQuestion()) {
      render();
      els.resultBody.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    moveQuestion(1);
    return;
  }

  render();
}

function gradeCurrentQuestion() {
  const module = getCurrentModule();
  const question = getCurrentQuestion();
  const key = state.focusMode ? state.focusOrder[state.focusCursor] : getQuestionKey(module.id, state.questionIndex);
  const saved = state.answers[key];

  if (!saved && question.type === "choice") return false;

  let correct = false;
  let value = saved?.value ?? "";

  if (question.type === "choice") {
    correct = value === question.answer;
  } else {
    const input = document.querySelector("#commandInput");
    value = normalizeCommand(input?.value ?? "");
    if (!value) return false;
    correct = question.patterns.some((pattern) => new RegExp(pattern).test(value));
  }

  state.answers[key] = {
    value,
    correct,
    checked: true,
  };
  saveState();
  return true;
}

function getFeedbackText(question, saved) {
  if (!saved?.checked) {
    return state.focusMode
      ? "답을 선택하거나 명령어를 입력한 뒤 다음을 누르세요. 모르면 건너뛰기로 넘길 수 있습니다."
      : "답을 선택하거나 명령어를 입력한 뒤 정답 확인을 누르세요.";
  }

  if (state.focusMode) {
    return "답안이 저장되었습니다. 문제만 풀기 모드에서는 전체 풀이 완료 후 결과와 해설을 확인합니다.";
  }

  return `${saved.correct ? "정답입니다." : "다시 확인해보세요."} ${question.explanation}${
    question.sample ? ` 예: ${question.sample}` : ""
  }`;
}

function moveQuestion(delta) {
  if (state.focusMode) {
    const nextCursor = state.focusCursor + delta;
    if (nextCursor >= 0 && nextCursor < state.focusOrder.length) state.focusCursor = nextCursor;
    saveState();
    render();
    return;
  }

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

function skipQuestion() {
  if (!state.focusMode) return;
  const key = state.focusOrder[state.focusCursor];
  state.answers[key] = {
    value: null,
    correct: false,
    checked: true,
    skipped: true,
  };
  saveState();

  if (isLastQuestion()) {
    render();
    els.resultBody.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  moveQuestion(1);
}

function renderProgress() {
  const score = getScore();
  const progress = getProgress();
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  els.overallProgressText.textContent = `${percent}%`;
  els.overallProgressBar.style.width = `${percent}%`;
  els.scoreText.textContent = `${score.correct} / ${score.total}`;
}

function renderResults() {
  const score = getScore();
  const progress = getProgress();
  const percent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  const progressPercent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const moduleRows = window.VKS_L100.modules.map((module) => {
    const moduleScore = getModuleScore(module);
    const modulePercent = moduleScore.total ? Math.round((moduleScore.correct / moduleScore.total) * 100) : 0;
    return { module, moduleScore, modulePercent };
  });
  const weak = moduleRows.filter((row) => row.modulePercent < 70);
  const incorrect = getIncorrectAnswers();
  const focusComplete = progress.completed === progress.total;

  els.resultBody.innerHTML = `
    <div class="result-summary">
      <div class="metric"><span>총점</span><strong>${percent}%</strong></div>
      <div class="metric"><span>정답</span><strong>${score.correct}</strong></div>
      <div class="metric"><span>진행</span><strong>${progressPercent}%</strong></div>
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
          ? weak.map(({ module }) => `<li>${module.title} 부족</li>`).join("")
          : "<li>현재 기준으로 모든 파트가 안정권입니다. L200 학습으로 확장해도 좋습니다.</li>"
      }
    </ul>
    ${renderAnswerReview(incorrect, focusComplete)}
  `;
}

function renderAnswerReview(incorrect, focusComplete) {
  if (!state.focusMode) return "";

  if (!focusComplete) {
    return `
      <div class="answer-review">
        <h4>오답 리뷰</h4>
        <p>문제만 풀기 모드에서는 전체 문항을 완료한 뒤 오답 해설을 표시합니다.</p>
      </div>
    `;
  }

  if (!incorrect.length) {
    return `
      <div class="answer-review">
        <h4>오답 리뷰</h4>
        <p>오답이 없습니다. 지금 흐름이면 L100 기본 개념은 안정적입니다.</p>
      </div>
    `;
  }

  return `
    <div class="answer-review">
      <h4>오답 리뷰</h4>
      ${incorrect
        .map(({ module, question, index }) => {
          const key = getQuestionKey(module.id, index);
          const answerText = getCorrectAnswerText(question);
          const userAnswerText = getUserAnswerText(question, state.answers[key]);
          return `
            <div class="review-card">
              <span>${module.shortTitle}</span>
              <strong>${question.prompt}</strong>
              <p>내 답: <code>${escapeHtml(userAnswerText)}</code></p>
              <p>정답: <code>${escapeHtml(answerText)}</code></p>
              <p>${question.explanation}</p>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function render() {
  document.body.classList.toggle("focus-mode", state.focusMode);
  document.body.classList.toggle("focus-complete", isFocusComplete());
  els.contentGrid?.classList.toggle("focus-mode", state.focusMode);
  if (els.focusButton) els.focusButton.textContent = state.focusMode ? "개념 같이 보기" : "문제만 풀기";
  if (els.checkButton) els.checkButton.textContent = state.focusMode ? "답안 저장" : "정답 확인";
  if (els.nextQuestionButton) els.nextQuestionButton.textContent = state.focusMode && isLastQuestion() ? "제출" : "다음";
  if (els.prevQuestionButton) els.prevQuestionButton.textContent = state.focusMode ? "건너뛰기" : "이전";
  renderModules();
  renderConcept();
  renderQuestion();
  renderProgress();
  renderResults();
}

els.startButton.addEventListener("click", () => {
  state.focusMode = false;
  state.moduleIndex = 0;
  state.questionIndex = 0;
  saveState();
  render();
  scrollToQuiz();
});

els.focusButton?.addEventListener("click", () => {
  if (state.focusMode) {
    state.focusMode = false;
  } else {
    startFocusSession();
  }
  saveState();
  render();
  scrollToQuiz();
});

els.checkButton.addEventListener("click", checkAnswer);
els.prevQuestionButton.addEventListener("click", () => {
  if (state.focusMode) {
    skipQuestion();
    return;
  }
  moveQuestion(-1);
});
els.nextQuestionButton.addEventListener("click", () => {
  if (state.focusMode) {
    checkAnswer();
    return;
  }
  moveQuestion(1);
});
els.resetButton.addEventListener("click", () => {
  if (!confirm("저장된 진행률을 초기화할까요?")) return;
  state.moduleIndex = 0;
  state.questionIndex = 0;
  state.focusMode = false;
  state.focusOrder = [];
  state.focusCursor = 0;
  state.answers = {};
  saveState();
  render();
});

loadState();
render();
