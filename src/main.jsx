import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  RotateCcw,
  Shuffle,
  SkipForward,
  Terminal,
} from "lucide-react";
import { vksTracks } from "./data/vksTracks";
import "./styles.css";

const STORAGE_KEY = "vmware-skill-lab:vks-react";

function questionKey(moduleId, index) {
  return `${moduleId}:${index}`;
}

function allQuestions(track) {
  return track.modules.flatMap((module) =>
    module.questions.map((question, index) => ({ module, question, index, key: questionKey(module.id, index) })),
  );
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function normalizeCommand(value) {
  return value.trim().replace(/\s+/g, " ");
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

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function App() {
  const saved = useMemo(loadState, []);
  const [trackIndex, setTrackIndex] = useState(saved.trackIndex ?? 0);
  const selectedTrack = vksTracks[trackIndex] ?? vksTracks[0];
  const trackState = saved.tracks?.[selectedTrack.label] ?? {};
  const [mode, setMode] = useState(saved.mode ?? "learn");
  const [moduleIndex, setModuleIndex] = useState(trackState.moduleIndex ?? 0);
  const [questionIndex, setQuestionIndex] = useState(trackState.questionIndex ?? 0);
  const [focusOrder, setFocusOrder] = useState(trackState.focusOrder ?? []);
  const [focusCursor, setFocusCursor] = useState(trackState.focusCursor ?? 0);
  const [answers, setAnswers] = useState(trackState.answers ?? {});
  const [cardTick, setCardTick] = useState(0);

  const questionPool = useMemo(() => allQuestions(selectedTrack), [selectedTrack]);
  const currentFocusItem = mode === "focus" ? getFocusItem() : null;
  const currentModule = mode === "focus" ? currentFocusItem.module : selectedTrack.modules[moduleIndex] ?? selectedTrack.modules[0];
  const safeQuestionIndex = Math.min(questionIndex, currentModule.questions.length - 1);
  const currentQuestion = mode === "focus" ? currentFocusItem.question : currentModule.questions[safeQuestionIndex];
  const currentKey = mode === "focus" ? currentFocusItem.key : questionKey(currentModule.id, safeQuestionIndex);
  const currentAnswer = answers[currentKey];
  const focusComplete = mode === "focus" && getProgress().completed === questionPool.length;
  const isLastFocusQuestion = mode === "focus" && focusCursor === focusOrder.length - 1;

  useEffect(() => {
    const previous = loadState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...previous,
        mode,
        trackIndex,
        tracks: {
          ...(previous.tracks ?? {}),
          [selectedTrack.label]: { moduleIndex, questionIndex, focusOrder, focusCursor, answers },
        },
      }),
    );
  }, [mode, trackIndex, selectedTrack.label, moduleIndex, questionIndex, focusOrder, focusCursor, answers]);

  useEffect(() => {
    setCardTick((value) => value + 1);
  }, [mode, moduleIndex, questionIndex, focusCursor]);

  function selectTrack(index) {
    const nextTrack = vksTracks[index] ?? vksTracks[0];
    const savedForTrack = loadState().tracks?.[nextTrack.label] ?? {};
    setTrackIndex(index);
    setMode("learn");
    setModuleIndex(savedForTrack.moduleIndex ?? 0);
    setQuestionIndex(savedForTrack.questionIndex ?? 0);
    setFocusOrder(savedForTrack.focusOrder ?? []);
    setFocusCursor(savedForTrack.focusCursor ?? 0);
    setAnswers(savedForTrack.answers ?? {});
  }

  function getFocusItem() {
    const order = focusOrder.length ? focusOrder : questionPool.map((item) => item.key);
    const key = order[Math.min(focusCursor, order.length - 1)];
    return questionPool.find((item) => item.key === key) ?? questionPool[0];
  }

  function getScore() {
    const correct = questionPool.filter((item) => answers[item.key]?.correct).length;
    return { correct, total: questionPool.length };
  }

  function getProgress() {
    const completed = questionPool.filter((item) => answers[item.key]?.checked).length;
    return { completed, total: questionPool.length };
  }

  function getModuleScore(module) {
    const total = module.questions.length;
    const correct = module.questions.filter((_, index) => answers[questionKey(module.id, index)]?.correct).length;
    const completed = module.questions.filter((_, index) => answers[questionKey(module.id, index)]?.checked).length;
    return { correct, completed, total };
  }

  function startLearn() {
    setMode("learn");
    setModuleIndex(0);
    setQuestionIndex(0);
    requestAnimationFrame(() => document.querySelector(".practice-panel")?.scrollIntoView({ behavior: "smooth" }));
  }

  function startFocus() {
    setMode("focus");
    setFocusOrder(shuffle(questionPool.map((item) => item.key)));
    setFocusCursor(0);
    setAnswers({});
    requestAnimationFrame(() => document.querySelector(".practice-panel")?.scrollIntoView({ behavior: "smooth" }));
  }

  function updateChoice(value) {
    setAnswers((prev) => ({
      ...prev,
      [currentKey]: { value, correct: false, checked: false },
    }));
  }

  function updateCommand(value) {
    setAnswers((prev) => ({
      ...prev,
      [currentKey]: { value, correct: false, checked: false },
    }));
  }

  function gradeCurrent() {
    const answer = answers[currentKey];
    if (!answer && currentQuestion.type === "choice") return false;

    let value = answer?.value ?? "";
    let correct = false;
    if (currentQuestion.type === "choice") {
      correct = value === currentQuestion.answer;
    } else {
      value = normalizeCommand(String(value));
      if (!value) return false;
      correct = currentQuestion.patterns.some((pattern) => new RegExp(pattern).test(value));
    }

    setAnswers((prev) => ({
      ...prev,
      [currentKey]: { value, correct, checked: true },
    }));
    return true;
  }

  function next() {
    if (mode === "focus") {
      if (!gradeCurrent()) return;
      if (isLastFocusQuestion) {
        requestAnimationFrame(() => document.querySelector(".result-panel")?.scrollIntoView({ behavior: "smooth" }));
        return;
      }
      setFocusCursor((value) => Math.min(value + 1, focusOrder.length - 1));
      return;
    }

    if (questionIndex < currentModule.questions.length - 1) {
      setQuestionIndex((value) => value + 1);
    } else if (moduleIndex < selectedTrack.modules.length - 1) {
      setModuleIndex((value) => value + 1);
      setQuestionIndex(0);
    }
  }

  function previous() {
    if (mode === "focus") return skip();
    if (questionIndex > 0) setQuestionIndex((value) => value - 1);
    else if (moduleIndex > 0) {
      const prevModuleIndex = moduleIndex - 1;
      setModuleIndex(prevModuleIndex);
      setQuestionIndex(selectedTrack.modules[prevModuleIndex].questions.length - 1);
    }
  }

  function skip() {
    setAnswers((prev) => ({
      ...prev,
      [currentKey]: { value: null, correct: false, checked: true, skipped: true },
    }));
    if (isLastFocusQuestion) {
      requestAnimationFrame(() => document.querySelector(".result-panel")?.scrollIntoView({ behavior: "smooth" }));
      return;
    }
    setFocusCursor((value) => Math.min(value + 1, focusOrder.length - 1));
  }

  function checkLearnAnswer() {
    gradeCurrent();
  }

  function reset() {
    if (!confirm("저장된 진행률을 초기화할까요?")) return;
    setMode("learn");
    setModuleIndex(0);
    setQuestionIndex(0);
    setFocusOrder([]);
    setFocusCursor(0);
    setAnswers({});
  }

  const score = getScore();
  const progress = getProgress();
  const progressPercent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const scorePercent = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  const weakModules = selectedTrack.modules
    .map((module) => ({ module, score: getModuleScore(module) }))
    .filter(({ score }) => score.total && Math.round((score.correct / score.total) * 100) < 70);
  const incorrect = questionPool.filter((item) => answers[item.key]?.checked && !answers[item.key]?.correct);

  return (
    <div className={`app-shell ${mode === "focus" ? "focus-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <div>
            <h1>VMware Skill Lab</h1>
            <p>{selectedTrack.level}</p>
          </div>
        </div>

        <div className="level-tabs" aria-label="VKS levels">
          {vksTracks.map((track, index) => (
            <button
              className={index === trackIndex ? "active" : ""}
              key={track.label}
              type="button"
              onClick={() => selectTrack(index)}
            >
              {track.label}
            </button>
          ))}
        </div>

        <nav className="module-list" aria-label={`${selectedTrack.label} modules`}>
          {selectedTrack.modules.map((module, index) => {
            const moduleScore = getModuleScore(module);
            return (
              <button
                className={`module-button ${mode === "learn" && index === moduleIndex ? "active" : ""}`}
                key={module.id}
                type="button"
                onClick={() => {
                  setMode("learn");
                  setModuleIndex(index);
                  setQuestionIndex(0);
                }}
              >
                <span className="module-index">{index + 1}</span>
                <span>
                  <span className="module-name">{module.shortTitle}</span>
                  <span className="module-meta">
                    {moduleScore.completed}/{moduleScore.total} completed
                  </span>
                </span>
                <span className="module-score">
                  {moduleScore.correct}/{moduleScore.total}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-summary" aria-label={`${selectedTrack.label} coverage`}>
          <p className="eyebrow">{selectedTrack.label} Coverage</p>
          <div className="summary-grid">
            <span>
              <strong>{selectedTrack.modules.length}</strong>
              <small>Modules</small>
            </span>
            <span>
              <strong>{questionPool.length}</strong>
              <small>Questions</small>
            </span>
          </div>
          <div className="summary-mode">
            <ClipboardList size={16} />
            <span>{mode === "focus" ? "Focus session active" : "Learning mode"}</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="progress-label">
            <span>전체 진행률</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <button className="ghost-button" type="button" onClick={reset}>
            <RotateCcw size={16} /> 진행 초기화
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Interactive VMware Learning</p>
            <h2>{selectedTrack.title}</h2>
          </div>
          <div className="score-pill">
            <span>정답</span>
            <strong>
              {score.correct} / {score.total}
            </strong>
          </div>
        </header>

        <section className="hero-panel">
          <div>
            <p className="eyebrow">MVP Scope</p>
            <h3>{selectedTrack.label}을 퀴즈와 커맨드 실습으로 점검합니다.</h3>
            <p>
              {selectedTrack.description} 문제 순서는 Focus 모드에서 매번 섞이며,
              결과에서 부족한 영역과 오답 리뷰를 확인합니다.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={startLearn}>
              <GraduationCap size={18} /> 첫 문제 시작
            </button>
            <button className="secondary-button" type="button" onClick={startFocus}>
              <Shuffle size={18} /> 문제만 풀기
            </button>
          </div>
        </section>

        <section className="content-grid">
          {mode === "learn" && (
            <ConceptPanel module={currentModule} />
          )}

          <PracticePanel
            key={`${mode}-${cardTick}`}
            mode={mode}
            module={currentModule}
            question={currentQuestion}
            answer={currentAnswer}
            currentNumber={mode === "focus" ? focusCursor + 1 : safeQuestionIndex + 1}
            totalNumber={mode === "focus" ? focusOrder.length : currentModule.questions.length}
            onChoice={updateChoice}
            onCommand={updateCommand}
            onCheck={checkLearnAnswer}
            onPrev={previous}
            onNext={next}
            isLast={isLastFocusQuestion}
            trackLabel={selectedTrack.label}
          />
        </section>

        {(!mode.includes("focus") || focusComplete) && (
          <ResultPanel
            mode={mode}
            scorePercent={scorePercent}
            score={score}
            progressPercent={progressPercent}
            modules={selectedTrack.modules}
            getModuleScore={getModuleScore}
            weakModules={weakModules}
            incorrect={incorrect}
            answers={answers}
          />
        )}
      </main>
    </div>
  );
}

function ConceptPanel({ module }) {
  return (
    <article className="study-panel panel-enter">
      <div className="panel-heading">
        <p className="eyebrow">Concept Brief</p>
        <h3>{module.title}</h3>
      </div>
      <div className="callout">{module.summary}</div>
      <ul className="concept-list">
        {module.concepts.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="command-bank">
        <p className="eyebrow">Command Bank</p>
        {module.commands.map((command) => (
          <code className="command-chip" key={command}>{command}</code>
        ))}
      </div>
    </article>
  );
}

function PracticePanel({
  mode,
  module,
  question,
  answer,
  currentNumber,
  totalNumber,
  onChoice,
  onCommand,
  onCheck,
  onPrev,
  onNext,
  isLast,
  trackLabel,
}) {
  const feedback = getFeedback(mode, question, answer);

  return (
    <article className="quiz-panel practice-panel panel-enter">
      <div className="panel-heading inline-heading">
        <div>
          <p className="eyebrow">Practice</p>
          <h3>문제 풀이</h3>
        </div>
        <div className="question-count">
          {currentNumber} / {totalNumber}
        </div>
      </div>

      <div className="question-meta">
        <span>{mode === "focus" ? `${trackLabel} Focus Mode` : module.shortTitle}</span>
      </div>
      <p className="question-text">{question.prompt}</p>

      {question.type === "choice" ? (
        <div className="choice-list">
          {question.options.map((option, index) => (
            <button
              className={`choice-button ${answer?.value === index ? "selected" : ""}`}
              key={option}
              type="button"
              onClick={() => onChoice(index)}
            >
              {option}
              {answer?.value === index && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="terminal-box">
          <div className="terminal-prompt">
            <Terminal size={16} /> student@vks-lab:~$
          </div>
          <input
            className="command-input"
            value={answer?.value ?? ""}
            autoComplete="off"
            spellCheck="false"
            placeholder="kubectl ..."
            onChange={(event) => onCommand(event.target.value)}
          />
        </div>
      )}

      <div className={`feedback ${feedback.kind}`}>{feedback.text}</div>

      <div className="quiz-actions">
        <button className="secondary-button" type="button" onClick={onPrev}>
          {mode === "focus" ? <SkipForward size={18} /> : null}
          {mode === "focus" ? "건너뛰기" : "이전"}
        </button>
        {mode === "learn" && (
          <button className="primary-button" type="button" onClick={onCheck}>
            정답 확인
          </button>
        )}
        <button className="secondary-button next-button" type="button" onClick={onNext}>
          {mode === "focus" && isLast ? "제출" : "다음"}
          <ArrowRight size={18} />
        </button>
      </div>
    </article>
  );
}

function getFeedback(mode, question, answer) {
  if (!answer?.checked) {
    return {
      kind: "",
      text:
        mode === "focus"
          ? "답을 선택하거나 명령어를 입력한 뒤 다음을 누르세요. 모르면 건너뛰기로 넘길 수 있습니다."
          : "답을 선택하거나 명령어를 입력한 뒤 정답 확인을 누르세요.",
    };
  }

  if (mode === "focus") {
    return { kind: "", text: "답안이 저장되었습니다. 전체 풀이 완료 후 결과와 해설을 확인합니다." };
  }

  return {
    kind: answer.correct ? "correct" : "wrong",
    text: `${answer.correct ? "정답입니다." : "다시 확인해보세요."} ${question.explanation}${
      question.sample ? ` 예: ${question.sample}` : ""
    }`,
  };
}

function ResultPanel({ mode, scorePercent, score, progressPercent, modules, getModuleScore, weakModules, incorrect, answers }) {
  return (
    <section className="result-panel panel-enter">
      <div className="panel-heading">
        <p className="eyebrow">Result Report</p>
        <h3>학습 결과</h3>
      </div>

      <div className="result-summary">
        <Metric label="총점" value={`${scorePercent}%`} />
        <Metric label="정답" value={`${score.correct}`} />
        <Metric label="진행" value={`${progressPercent}%`} />
      </div>

      <div className="skill-bars">
        {modules.map((module) => {
          const moduleScore = getModuleScore(module);
          const percent = moduleScore.total ? Math.round((moduleScore.correct / moduleScore.total) * 100) : 0;
          return (
            <div className="skill-row" key={module.id}>
              <span>{module.shortTitle}</span>
              <div className="bar">
                <span style={{ width: `${percent}%` }} />
              </div>
              <strong>
                {moduleScore.correct}/{moduleScore.total}
              </strong>
            </div>
          );
        })}
      </div>

      <ul className="review-list">
        {weakModules.length ? (
          weakModules.map(({ module }) => <li key={module.id}>{module.title} 부족</li>)
        ) : (
          <li>현재 기준으로 모든 파트가 안정권입니다. 다음 레벨 학습으로 확장해도 좋습니다.</li>
        )}
      </ul>

      {mode === "focus" && (
        <div className="answer-review">
          <h4>오답 리뷰</h4>
          {!incorrect.length ? (
            <p>오답이 없습니다. 지금 흐름이면 L100 기본 개념은 안정적입니다.</p>
          ) : (
            incorrect.map(({ module, question, index, key }) => {
              const answer = answers[key] ?? answers[questionKey(module.id, index)];
              return (
                <div className="review-card" key={key}>
                  <span>{module.shortTitle}</span>
                  <strong>{question.prompt}</strong>
                  <p>
                    내 답: <code>{getUserAnswerText(question, answer)}</code>
                  </p>
                  <p>
                    정답: <code>{getCorrectAnswerText(question)}</code>
                  </p>
                  <p>{question.explanation}</p>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
