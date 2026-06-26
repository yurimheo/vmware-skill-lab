import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Command,
  GraduationCap,
  Grid3X3,
  Layers3,
  RotateCcw,
  Shuffle,
  SkipForward,
  Target,
  Terminal,
  Trophy,
  XCircle,
} from "lucide-react";
import { vksTracks } from "./data/vksTracks";
import "./styles.css";

const STORAGE_KEY = "vmware-skill-lab:vks-react";
const SOLUTION_FAMILY = "Cloud Native";
const SOLUTION_NAME = "vSphere Kubernetes Service";
const SOLUTION_CODE = "VKS";
const atlasFamilies = [
  { name: "Core Infrastructure", tracks: "vSphere · vSAN · VCF", state: "planned" },
  { name: "Networking & Security", tracks: "NSX · Avi · Firewall", state: "planned" },
  { name: "Cloud Native", tracks: "VKS · Tanzu · Kubernetes", state: "active" },
  { name: "Operations", tracks: "Aria · VCF Operations", state: "planned" },
  { name: "Automation & DR", tracks: "PowerCLI · HCX · SRM", state: "planned" },
];

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

function normalizeCommand(value, { canonicalResources = true } = {}) {
  const tokens = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!tokens.length) return "";

  if (tokens[0] === "k") tokens[0] = "kubectl";
  if (!canonicalResources) return tokens.join(" ");

  const verbIndex = tokens.findIndex((token) =>
    ["get", "describe", "logs", "exec", "apply", "diff", "edit", "delete"].includes(token),
  );
  if (verbIndex === -1) return tokens.join(" ");

  const verb = tokens[verbIndex];
  const resourceIndex = verbIndex + 1;
  const resource = tokens[resourceIndex];

  if (verb === "get" && resource) {
    const aliases = {
      pod: "pods",
      po: "pods",
      deploy: "deployment",
      deployments: "deployment",
      svc: "svc",
      service: "svc",
      services: "svc",
      ep: "endpoints",
      endpoint: "endpoints",
      ing: "ingress",
      ingresses: "ingress",
      ns: "namespaces",
      namespace: "namespaces",
      sc: "storageclass",
      storageclasses: "storageclass",
      quota: "resourcequota",
      quotas: "resourcequota",
    };
    tokens[resourceIndex] = resource
      .split(",")
      .map((item) => aliases[item] ?? item)
      .join(",");
  }

  if (verb === "describe" && resource) {
    const aliases = {
      pods: "pod",
      po: "pod",
      deployments: "deployment",
      deploy: "deployment",
      services: "svc",
      service: "svc",
      ingresses: "ingress",
      ing: "ingress",
      pvc: "pvc",
    };
    tokens[resourceIndex] = aliases[resource] ?? resource;
  }

  return tokens.join(" ");
}

function commandCandidates(value) {
  return [...new Set([
    normalizeCommand(value, { canonicalResources: false }),
    normalizeCommand(value),
  ])].filter(Boolean);
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
  const [showGate, setShowGate] = useState(true);
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

  function enterTrack(index) {
    selectTrack(index);
    setShowGate(false);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
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
      const candidates = commandCandidates(String(value));
      if (!candidates.length) return false;
      value = candidates[0];
      correct = currentQuestion.patterns.some((pattern) => candidates.some((candidate) => new RegExp(pattern).test(candidate)));
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
  const activeModuleScore = getModuleScore(currentModule);
  const activeModulePercent = activeModuleScore.total ? Math.round((activeModuleScore.completed / activeModuleScore.total) * 100) : 0;
  const weakModules = selectedTrack.modules
    .map((module) => ({ module, score: getModuleScore(module) }))
    .filter(({ score }) => score.total && Math.round((score.correct / score.total) * 100) < 70);
  const incorrect = questionPool.filter((item) => answers[item.key]?.checked && !answers[item.key]?.correct);

  if (showGate) {
    return <LaunchScreen saved={saved} selectedIndex={trackIndex} onSelect={enterTrack} />;
  }

  return (
    <div className={`app-shell ${mode === "focus" ? "focus-mode" : ""}`}>
      <aside className="sidebar">
        <button className="brand brand-button" type="button" onClick={() => setShowGate(true)} aria-label="레벨 선택 화면으로 돌아가기">
          <span className="brand-mark">V</span>
          <div>
            <h1>Skill Atlas</h1>
            <p>{SOLUTION_FAMILY} / {selectedTrack.label}</p>
          </div>
        </button>

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
          <button className="ghost-button compact-button" type="button" onClick={() => setShowGate(true)}>
            레벨 다시 선택
          </button>
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
            <p className="breadcrumb">VMware Skill Atlas / {SOLUTION_FAMILY} / {SOLUTION_CODE} / {selectedTrack.label}</p>
            <RevealText as="h2" text={selectedTrack.title} />
            <p className="topbar-subtitle">{selectedTrack.description}</p>
          </div>
          <div className="score-pill">
            <span>정답</span>
            <strong>
              {score.correct} / {score.total}
            </strong>
          </div>
        </header>

        <DashboardStrip
          mode={mode}
          progressPercent={progressPercent}
          scorePercent={scorePercent}
          progress={progress}
          score={score}
          currentModule={currentModule}
          activeModuleScore={activeModuleScore}
          activeModulePercent={activeModulePercent}
          onToggleMode={mode === "focus" ? startLearn : startFocus}
        />

        <section className="hero-panel">
          <div>
            <p className="eyebrow">Track Workspace</p>
            <RevealText as="h3" text={`${SOLUTION_NAME} 역량 트랙`} />
            <p>
              VMware 전체 스킬 맵 안에서 현재는 Cloud Native 영역의 VKS 트랙을 학습 중입니다.
              모듈별 지식 확인, 커맨드 연습, Assessment 모드 결과를 한 흐름으로 관리합니다.
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

        <ModuleOverview
          modules={selectedTrack.modules}
          activeModuleId={currentModule.id}
          getModuleScore={getModuleScore}
          onSelect={(index) => {
            setMode("learn");
            setModuleIndex(index);
            setQuestionIndex(0);
          }}
        />

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

function DashboardStrip({
  mode,
  progressPercent,
  scorePercent,
  progress,
  score,
  currentModule,
  activeModuleScore,
  activeModulePercent,
  onToggleMode,
}) {
  return (
    <section className="dashboard-strip" aria-label="Learning status">
      <StatusMetric
        icon={<Target size={18} />}
        label="진행률"
        value={`${progressPercent}%`}
        detail={`${progress.completed}/${progress.total} completed`}
        tone="blue"
        hint="전체 문항 중 답을 확인했거나 건너뛴 항목의 비율입니다."
      />
      <StatusMetric
        icon={<Trophy size={18} />}
        label="정답률"
        value={`${scorePercent}%`}
        detail={`${score.correct}/${score.total} correct`}
        tone="green"
        hint="현재 트랙에서 정답 처리된 문항 수입니다. Learn 모드와 Focus 모드 결과가 함께 반영됩니다."
      />
      <StatusMetric
        icon={<Layers3 size={18} />}
        label="현재 모듈"
        value={currentModule.shortTitle}
        detail={`${activeModuleScore.completed}/${activeModuleScore.total} completed · ${activeModulePercent}%`}
        tone="teal"
        hint="지금 열려 있는 Skill Area의 진행 상태입니다. 왼쪽 모듈이나 아래 트랙에서 바로 이동할 수 있습니다."
      />
      <StatusMetric
        icon={mode === "focus" ? <Shuffle size={18} /> : <BookOpen size={18} />}
        label="학습 모드"
        value={mode === "focus" ? "Focus" : "Learn"}
        detail={mode === "focus" ? "Assessment mode" : "Guided study"}
        tone="slate"
        onClick={onToggleMode}
        hint="클릭하면 Guided study와 Assessment mode를 전환합니다."
      />
    </section>
  );
}

function StatusMetric({ icon, label, value, detail, tone, onClick, hint }) {
  const Element = onClick ? "button" : "div";
  return (
    <Element className={`status-metric ${tone} ${onClick ? "interactive" : ""}`} type={onClick ? "button" : undefined} onClick={onClick}>
      <span className="metric-icon">{icon}</span>
      <span className="metric-copy">
        <span className="metric-label">
          {label}
          {hint && <InfoHint text={hint} />}
        </span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      {hint && <span className="tutorial-popover">{hint}</span>}
    </Element>
  );
}

function InfoHint({ text }) {
  return (
    <span className="info-hint" tabIndex={0} aria-label={text}>
      <CircleHelp size={14} />
      <span className="hint-bubble" role="tooltip">{text}</span>
    </span>
  );
}

function RevealText({ text, as: Element = "span", className = "" }) {
  return (
    <Element className={`reveal-text ${className}`} aria-label={text}>
      {[...text].map((char, index) => (
        <span aria-hidden="true" key={`${char}-${index}`} style={{ "--i": index }}>
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </Element>
  );
}

function ModuleOverview({ modules, activeModuleId, getModuleScore, onSelect }) {
  return (
    <section className="module-overview" aria-label="Module progress overview">
      {modules.map((module, index) => {
        const moduleScore = getModuleScore(module);
        const percent = moduleScore.total ? Math.round((moduleScore.completed / moduleScore.total) * 100) : 0;
        const status = moduleScore.completed === moduleScore.total ? "done" : module.id === activeModuleId ? "current" : "ready";
        return (
          <button
            className={`module-node ${status}`}
            key={module.id}
            type="button"
            title={module.title}
            onClick={() => onSelect(index)}
          >
            <span className="node-index">{index + 1}</span>
            <span className="node-copy">
              <strong>{module.shortTitle}</strong>
              <small>{moduleScore.correct}/{moduleScore.total} correct</small>
            </span>
            <span className="node-bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
            <span className="tutorial-popover">
              {module.title}로 이동합니다. 막대는 해당 Skill Area에서 확인한 문항 비율입니다.
            </span>
          </button>
        );
      })}
    </section>
  );
}

function LaunchScreen({ saved, selectedIndex, onSelect }) {
  const [launchStep, setLaunchStep] = useState("intro");

  useEffect(() => {
    if (launchStep !== "intro") return undefined;
    const timer = window.setTimeout(() => setLaunchStep("solution"), 2100);
    return () => window.clearTimeout(timer);
  }, [launchStep]);

  if (launchStep === "intro") {
    return (
      <main className="brand-intro" onClick={() => setLaunchStep("solution")}>
        <div className="intro-pulse" aria-hidden="true" />
        <div className="intro-logo" aria-label="VMware Skill Lab">
          <span>V</span>
          <strong>VMware Skill Atlas</strong>
        </div>
      </main>
    );
  }

  return (
    <main className={`launch-screen ${launchStep === "level" ? "level-step" : "solution-step"}`}>
      <section className="launch-hero" aria-label="VMware skill atlas selection">
        <div className="launch-title">
          <span className="launch-mark">V</span>
          <div>
            <p className="eyebrow">VMware Skill Atlas</p>
            <RevealText
              as="h1"
              text={launchStep === "level" ? "VKS 역량 레벨을 선택하세요." : "VMware 역량 지도를 넓혀갑니다."}
            />
            <p>
              {launchStep === "level"
                ? "Foundation, Implementation, Advanced 레벨을 따라 지식 확인과 실무형 체크를 진행합니다."
                : "솔루션별 스킬셋을 하나의 학습 지도에 쌓아갑니다. 현재는 Cloud Native 영역의 VKS 트랙이 활성화되어 있습니다."}
            </p>
          </div>
        </div>

        {launchStep === "solution" ? (
          <div className="atlas-layout stage-enter">
            <div className="atlas-map" aria-label="VMware solution families">
              {atlasFamilies.map((family) => (
                <button
                  className={`atlas-family ${family.state}`}
                  key={family.name}
                  type="button"
                  disabled={family.state !== "active"}
                  onClick={() => setLaunchStep("level")}
                >
                  <span>{family.name}</span>
                  <strong>{family.tracks}</strong>
                </button>
              ))}
            </div>
            <button className="solution-card selected" type="button" onClick={() => setLaunchStep("level")}>
              <span className="solution-icon"><Grid3X3 size={28} /> {SOLUTION_CODE}</span>
              <span className="profile-name">{SOLUTION_NAME}</span>
              <span className="profile-description">
                Cloud Native 워크로드 운영을 위한 Foundation, Implementation, Advanced 학습 트랙입니다.
              </span>
              <span className="profile-stats">
                <span>3 levels</span>
                <span>{vksTracks.reduce((total, track) => total + track.modules.length, 0)} modules</span>
              </span>
              <span className="profile-footer">
                <span>활성 트랙 열기</span>
                <ChevronRight size={18} />
              </span>
            </button>
          </div>
        ) : (
          <>
            <button className="back-link" type="button" onClick={() => setLaunchStep("solution")}>
              솔루션 다시 선택
            </button>
            <div className="profile-grid stage-enter">
              {vksTracks.map((track, index) => {
                const pool = allQuestions(track);
                const savedAnswers = saved.tracks?.[track.label]?.answers ?? {};
                const completed = pool.filter((item) => savedAnswers[item.key]?.checked).length;
                const correct = pool.filter((item) => savedAnswers[item.key]?.correct).length;
                const percent = pool.length ? Math.round((completed / pool.length) * 100) : 0;

                return (
                  <button
                    className={`profile-card ${index === selectedIndex ? "selected" : ""}`}
                    key={track.label}
                    type="button"
                    onClick={() => onSelect(index)}
                  >
                    <span className="profile-level">{track.label}</span>
                    <span className="profile-name">{track.level.replace(`${track.label} `, "")}</span>
                    <span className="profile-description">{track.description}</span>
                    <span className="profile-stats">
                      <span>{track.modules.length} modules</span>
                      <span>{pool.length} questions</span>
                    </span>
                    <span className="profile-progress" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </span>
                    <span className="profile-footer">
                      <span>
                        {completed}/{pool.length} completed · {correct} correct
                      </span>
                      <ChevronRight size={18} />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function ConceptPanel({ module }) {
  return (
    <article className="study-panel panel-enter">
      <div className="panel-heading">
        <p className="eyebrow">Concept Brief</p>
        <h3><BookOpen size={20} /> {module.title}</h3>
      </div>
      <div className="callout">{module.summary}</div>
      <ul className="concept-list">
        {module.concepts.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="command-bank">
        <p className="eyebrow"><Command size={14} /> Command Bank</p>
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
  const checked = Boolean(answer?.checked);

  return (
    <article className="quiz-panel practice-panel panel-enter">
      <div className="panel-heading inline-heading">
        <div>
          <p className="eyebrow">Practice</p>
          <h3>
            <Target size={20} /> 문제 풀이
            <InfoHint text="선택형은 답을 고른 뒤 정답 확인을 누르고, 커맨드형은 명령어를 입력해 패턴을 검증합니다." />
          </h3>
        </div>
        <div className="question-count">
          {currentNumber} / {totalNumber}
        </div>
      </div>

      <div className="question-meta">
        <span>{mode === "focus" ? `${trackLabel} Focus Mode` : module.shortTitle}</span>
      </div>
      <RevealText key={question.prompt} as="p" text={question.prompt} className="question-text" />

      {question.type === "choice" ? (
        <div className="choice-list">
          {question.options.map((option, index) => {
            const selected = answer?.value === index;
            const isCorrect = checked && index === question.answer;
            const isWrong = checked && selected && index !== question.answer;
            return (
              <button
                className={`choice-button ${selected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                key={option}
                type="button"
                onClick={() => onChoice(index)}
              >
                <span className="choice-index">{String.fromCharCode(65 + index)}</span>
                <span className="choice-copy">{option}</span>
                {isCorrect && <CheckCircle2 size={18} />}
                {isWrong && <XCircle size={18} />}
                {!checked && selected && <CheckCircle2 size={18} />}
              </button>
            );
          })}
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
        <h3><BarChart3 size={20} /> 학습 결과</h3>
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
            <p>오답이 없습니다. 지금 흐름이면 현재 레벨의 핵심 개념은 안정적입니다.</p>
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
