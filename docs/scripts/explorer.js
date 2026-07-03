const STATE = {
  tasks: [],
  cases: [],
  replay: null,
  activeTaskId: null,
  activeCaseId: null,
  selectedFrameIds: new Set(),
  activeAttentionId: null,
};

const DEMO_DATA_VERSION = "20260703c";
const MIN_RELIABLE_FRAMES = 8;
const els = {};

function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function activeCase() {
  return STATE.cases.find((item) => item.id === STATE.activeCaseId);
}

function activeTask() {
  return STATE.tasks.find((item) => item.id === STATE.activeTaskId);
}

function casesForActiveTask() {
  return STATE.cases.filter((item) => item.taskId === STATE.activeTaskId);
}

function activeAttentionPanel(caseData) {
  return caseData.attentionPanels.find((item) => item.id === STATE.activeAttentionId)
    || caseData.attentionPanels[0];
}

function activeFrames(caseData) {
  return caseData.frames.filter((frame) => STATE.selectedFrameIds.has(frame.id));
}

function resetToEmpty(caseData) {
  STATE.selectedFrameIds = new Set();
  renderExplorer(caseData);
}

function anchorFrameIds(caseData) {
  const anchors = caseData.frames.filter((frame) => frame.role.startsWith("top"));
  return anchors.map((frame) => frame.id);
}

function selectAnchorFrames(caseData) {
  const anchors = anchorFrameIds(caseData);
  STATE.selectedFrameIds = new Set(anchors);
  renderExplorer(caseData);
}

function selectAllFrames(caseData) {
  STATE.selectedFrameIds = new Set(caseData.frames.map((frame) => frame.id));
  renderExplorer(caseData);
}

function setActiveCase(caseId) {
  STATE.activeCaseId = caseId;
  STATE.selectedFrameIds = new Set(anchorFrameIds(activeCase()));
  STATE.activeAttentionId = activeCase().attentionPanels[0]?.id || null;
  renderExplorer(activeCase());
}

function setActiveTask(taskId) {
  STATE.activeTaskId = taskId;
  const nextCase = casesForActiveTask()[0];
  STATE.activeCaseId = nextCase.id;
  STATE.selectedFrameIds = new Set(anchorFrameIds(nextCase));
  STATE.activeAttentionId = nextCase.attentionPanels[0]?.id || null;
  renderExplorer(nextCase);
}

function toggleFrame(frameId) {
  if (STATE.selectedFrameIds.has(frameId)) {
    STATE.selectedFrameIds.delete(frameId);
  } else {
    STATE.selectedFrameIds.add(frameId);
  }
  renderExplorer(activeCase());
}

function replayProbability(caseData, frames) {
  if (frames.length === 0) return null;
  const replayCase = STATE.replay?.cases?.[caseData.id];
  const replayTask = STATE.replay?.tasks?.[caseData.taskId];
  if (!replayCase || !replayTask) return caseData.wholeCaseProbability;

  const selected = frames.map((frame) => replayCase.frames[frame.id]).filter(Boolean);
  if (selected.length === 0) return null;

  const maxScore = Math.max(...selected.map((frame) => frame.score));
  const scoreExp = selected.map((frame) => Math.exp(frame.score - maxScore));
  const scoreDenom = scoreExp.reduce((sum, value) => sum + value, 0);
  const featureDim = STATE.replay.featureDim;
  const pooled = new Float64Array(featureDim);

  selected.forEach((frame, frameIndex) => {
    const weight = scoreExp[frameIndex] / scoreDenom;
    for (let index = 0; index < featureDim; index += 1) {
      pooled[index] += weight * frame.feature[index];
    }
  });

  const logits = replayTask.classifierWeight.map((classWeights, classIndex) => {
    let value = replayTask.classifierBias[classIndex];
    for (let index = 0; index < featureDim; index += 1) {
      value += classWeights[index] * pooled[index];
    }
    return value;
  });
  const maxLogit = Math.max(...logits);
  const exp0 = Math.exp(logits[0] - maxLogit);
  const exp1 = Math.exp(logits[1] - maxLogit);
  return exp1 / (exp0 + exp1);
}

function roleLabel(role) {
  if (role.startsWith("top")) return role.replace("top", "Top ");
  if (role === "bottom1") return "Low";
  if (role === "bottom2") return "Low";
  return "Context";
}

function displayFrameNumber(frame) {
  return Number.isInteger(frame.index) ? frame.index + 1 : frame.imageNumber;
}

function frameById(caseData, frameId) {
  return caseData.frames.find((frame) => frame.id === frameId);
}

function renderTaskTabs() {
  els.taskTabs.innerHTML = "";
  STATE.tasks.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-tab${task.id === STATE.activeTaskId ? " is-active" : ""}`;
    button.innerHTML = `
      <strong>${task.title}</strong>
      <span>${task.subtitle}</span>
    `;
    button.addEventListener("click", () => setActiveTask(task.id));
    els.taskTabs.appendChild(button);
  });
}

function renderCaseTabs(caseData) {
  els.caseTabs.innerHTML = "";
  casesForActiveTask().forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `case-tab${item.id === caseData.id ? " is-active" : ""}`;
    button.innerHTML = `
      <span>${item.referenceText}</span>
      <strong>${item.title}</strong>
      <small>${item.nImages} frames</small>
    `;
    button.addEventListener("click", () => setActiveCase(item.id));
    els.caseTabs.appendChild(button);
  });
}

function renderFrameBank(caseData) {
  els.frameBank.innerHTML = "";
  caseData.frames.forEach((frame) => {
    const selected = STATE.selectedFrameIds.has(frame.id);
    const item = document.createElement("article");
    item.className = `exam-frame${selected ? " is-selected" : ""}${frame.isModelAnchor ? " is-anchor" : ""}`;
    item.tabIndex = 0;
    item.draggable = true;
    item.dataset.frameId = frame.id;
    item.innerHTML = `
      <div class="exam-frame-media">
        <img src="${frame.image}" alt="${caseData.title}, frame ${displayFrameNumber(frame)}">
        <span class="frame-chip">${roleLabel(frame.role)}</span>
      </div>
      <div class="exam-frame-meta">
        <span>Frame ${displayFrameNumber(frame)}</span>
        <strong>${formatPercent(frame.selectionWeight, 1)}</strong>
      </div>
    `;
    item.addEventListener("click", () => toggleFrame(frame.id));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFrame(frame.id);
      }
    });
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", frame.id);
      event.dataTransfer.effectAllowed = "copy";
    });
    els.frameBank.appendChild(item);
  });
}

function renderModelBox(caseData) {
  const frames = activeFrames(caseData);
  els.modelFrames.innerHTML = "";
  els.dropzone.classList.toggle("is-empty", frames.length === 0);
  els.dropzonePrompt.hidden = frames.length > 0;

  frames.forEach((frame) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "model-frame";
    item.title = `Remove frame ${displayFrameNumber(frame)}`;
    item.innerHTML = `
      <img src="${frame.image}" alt="">
      <span>Frame ${displayFrameNumber(frame)}</span>
    `;
    item.addEventListener("click", () => toggleFrame(frame.id));
    els.modelFrames.appendChild(item);
  });
}

function renderOutput(caseData) {
  const frames = activeFrames(caseData);
  const probability = replayProbability(caseData, frames);
  const ready = probability !== null;
  const task = activeTask();
  const selectedScore = frames.reduce((sum, frame) => sum + Number(frame.selectionWeight || 0), 0);
  const limitedEvidence = frames.length === 0 || frames.length < MIN_RELIABLE_FRAMES || selectedScore < 0.35;

  els.outputTitle.textContent = caseData.question;
  els.caseDescription.textContent = `${caseData.nImages} frames`;
  els.outputSelected.textContent = `${frames.length} / ${caseData.nImages} frames`;
  els.outputProbabilityLabel.textContent = ready ? caseData.probabilityLabel : "Awaiting frames";
  els.outputProbability.textContent = ready ? formatPercent(probability) : "--";
  els.outputBar.style.width = ready ? formatPercent(probability) : "0%";
  els.outputPrediction.textContent = ready
    ? (probability >= 0.5 ? caseData.positiveClass : caseData.negativeClass)
    : "Drop frames into the model box";
  els.outputTask.textContent = task ? task.title : "";
  els.outputPrediction.classList.toggle("is-muted", !ready);
  els.referenceText.textContent = caseData.referenceText;
  els.selectionWarning.hidden = !limitedEvidence;
  els.selectionWarning.textContent = frames.length === 0
    ? "Select several representative frames before reading the probability."
    : `Few selected frames or low total image score (${formatPercent(selectedScore, 1)}) can give inaccurate results.`;
}

function renderAttention(caseData) {
  const panel = activeAttentionPanel(caseData);
  if (!panel) return;

  els.attentionNote.textContent = "Fine-tuned Top-5 images with spatial heatmaps.";
  els.attentionList.innerHTML = "";
  caseData.attentionPanels.forEach((item) => {
    const frame = frameById(caseData, item.frameId);
    const displayNumber = frame ? displayFrameNumber(frame) : item.frameNumber;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `attention-row${item.id === panel.id ? " is-active" : ""}`;
    button.innerHTML = `
      <span>${item.label}</span>
      <strong>Frame ${displayNumber}</strong>
      <em>${formatPercent(item.attentionWeight, 2)}</em>
    `;
    button.addEventListener("click", () => {
      STATE.activeAttentionId = item.id;
      renderExplorer(caseData);
    });
    els.attentionList.appendChild(button);
  });

  els.attentionImage.src = panel.image;
  els.attentionHeatmap.src = panel.heatmap;
  const activeFrame = frameById(caseData, panel.frameId);
  els.attentionFrame.textContent = `Frame ${activeFrame ? displayFrameNumber(activeFrame) : panel.frameNumber}`;
  els.attentionScore.textContent = formatPercent(panel.attentionWeight, 2);
  els.addAttentionFrame.onclick = () => {
    STATE.selectedFrameIds.add(panel.frameId);
    renderExplorer(caseData);
  };
}

function renderExplorer(caseData = activeCase()) {
  if (!caseData) return;
  if (!STATE.activeAttentionId && caseData.attentionPanels?.length) {
    STATE.activeAttentionId = caseData.attentionPanels[0].id;
  }
  renderTaskTabs();
  renderCaseTabs(caseData);
  renderFrameBank(caseData);
  renderModelBox(caseData);
  renderOutput(caseData);
  renderAttention(caseData);
}

function bindEvents() {
  els.selectAnchors.addEventListener("click", () => selectAnchorFrames(activeCase()));
  els.selectAll.addEventListener("click", () => selectAllFrames(activeCase()));
  els.clearModel.addEventListener("click", () => resetToEmpty(activeCase()));

  els.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  });

  els.dropzone.addEventListener("dragleave", () => {
    els.dropzone.classList.remove("is-dragging");
  });

  els.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
    const frameId = event.dataTransfer.getData("text/plain");
    if (frameId) {
      STATE.selectedFrameIds.add(frameId);
      renderExplorer(activeCase());
    }
  });
}

async function initExplorer() {
  Object.assign(els, {
    taskTabs: document.querySelector("[data-task-tabs]"),
    caseTabs: document.querySelector("[data-case-tabs]"),
    frameBank: document.querySelector("[data-frame-bank]"),
    dropzone: document.querySelector("[data-model-dropzone]"),
    dropzonePrompt: document.querySelector("[data-dropzone-prompt]"),
    modelFrames: document.querySelector("[data-model-frames]"),
    selectAnchors: document.querySelector("[data-select-anchors]"),
    selectAll: document.querySelector("[data-select-all]"),
    clearModel: document.querySelector("[data-clear-model]"),
    outputTitle: document.querySelector("[data-output-title]"),
    caseDescription: document.querySelector("[data-case-description]"),
    outputSelected: document.querySelector("[data-output-selected]"),
    outputProbabilityLabel: document.querySelector("[data-output-probability-label]"),
    outputProbability: document.querySelector("[data-output-probability]"),
    outputBar: document.querySelector("[data-output-bar]"),
    outputPrediction: document.querySelector("[data-output-prediction]"),
    outputTask: document.querySelector("[data-output-task]"),
    referenceText: document.querySelector("[data-reference-text]"),
    selectionWarning: document.querySelector("[data-selection-warning]"),
    attentionNote: document.querySelector("[data-attention-note]"),
    attentionList: document.querySelector("[data-attention-list]"),
    attentionImage: document.querySelector("[data-attention-image]"),
    attentionHeatmap: document.querySelector("[data-attention-heatmap]"),
    attentionFrame: document.querySelector("[data-attention-frame]"),
    attentionScore: document.querySelector("[data-attention-score]"),
    addAttentionFrame: document.querySelector("[data-add-attention-frame]"),
  });

  const requestOptions = { cache: "no-store" };
  const [response, replayResponse] = await Promise.all([
    fetch(`data/case_explorer.json?v=${DEMO_DATA_VERSION}`, requestOptions),
    fetch(`data/abmil_replay.json?v=${DEMO_DATA_VERSION}`, requestOptions),
  ]);
  const payload = await response.json();
  STATE.replay = await replayResponse.json();
  STATE.tasks = payload.tasks;
  STATE.cases = payload.cases;
  STATE.activeTaskId = STATE.tasks[0].id;
  const firstCase = casesForActiveTask()[0];
  STATE.activeCaseId = firstCase.id;
  STATE.selectedFrameIds = new Set(anchorFrameIds(firstCase));
  STATE.activeAttentionId = firstCase.attentionPanels[0]?.id || null;
  bindEvents();
  renderExplorer(firstCase);
}

document.addEventListener("DOMContentLoaded", initExplorer);
