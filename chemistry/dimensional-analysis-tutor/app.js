import {
  PREFIXES,
  decimalFromScientific,
  exponentOptions,
  formatExponent,
  generateConversion,
  generateNotation,
  magnitudeCheck,
  makeConversion,
  nearlyEqual,
} from "./core.js?v=gnosys-20260806-3";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  view: "conversion",
  mode: "guided",
  difficulty: "foundations",
  problem: makeConversion(1.194, "mg", "Gg"),
  step: 0,
  selected: null,
  hintLevel: 0,
  notation: generateNotation(),
  notationHint: false,
  stats: loadStats(),
};

const stepContent = [
  {
    label: "Decode the starting unit",
    question: (p) => `What does 1 ${p.start.symbol} equal in grams?`,
    explanation: (p) => `${p.start.prefix} is the prefix attached to grams. First we translate that prefix into a power of ten.`,
    coachTitle: "Translate the prefix first",
    coachCopy: "The prefix is an instruction. Milli means 10⁻³, kilo means 10³, and so on. Writing that relationship gives us an amount equal to one starting unit.",
  },
  {
    label: "Make the first unit cancel",
    question: (p) => `${p.start.symbol} is on top of the starting fraction. Where must ${p.start.symbol} go in the next fraction?`,
    explanation: () => "Matching units cancel only when one is above a fraction bar and the other is below one.",
    coachTitle: "Opposite sides cancel",
    coachCopy: "This is the key move: find the unit you do not want and place the same unit on the opposite side of the next fraction. You are choosing the direction of the conversion factor.",
  },
  {
    label: "Decode the destination unit",
    question: (p) => `What does 1 ${p.target.symbol} equal in grams?`,
    explanation: (p) => `Now translate the ${p.target.prefix} prefix. This creates the bridge from grams into ${p.target.symbol}.`,
    coachTitle: "Build a bridge through grams",
    coachCopy: "Both units can be described using grams. That shared base unit lets us travel from the starting prefix to the destination prefix without guessing decimal places.",
  },
  {
    label: "Make grams cancel",
    question: () => "After the first fraction, grams are on top. Where must grams go in the next fraction?",
    explanation: (p) => `We want grams to disappear and ${p.target.symbol} to survive.`,
    coachTitle: "Look at what should survive",
    coachCopy: "Grams are temporary scaffolding. Put grams on the bottom so they cancel, while the requested destination unit stays on top and survives.",
  },
  {
    label: "Do the exponent arithmetic",
    question: (p) => `What is ${p.start.exp} − (${p.target.exp})?`,
    explanation: () => "The first power of ten is multiplied. The second is in the denominator, so its exponent is subtracted.",
    coachTitle: "The denominator means subtract",
    coachCopy: "Use one literal rule: when dividing powers with the same base, subtract the denominator’s exponent. If that exponent is negative, subtracting a negative becomes addition.",
  },
  {
    label: "Write the final answer",
    question: (p) => `Complete the coefficient and exponent for the answer in ${p.target.symbol}.`,
    explanation: () => "The units have already decided the direction. Now copy the coefficient and use the exponent you calculated.",
    coachTitle: "Finish, then check the size",
    coachCopy: "The coefficient stays the same in this setup. The power of ten records the size difference between the two prefixes. Finally, ask whether the number moved in a sensible direction.",
  },
];

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem("metricMindStats")) || { attempts: 0, correct: 0, solved: 0, streak: 0 };
  } catch {
    return { attempts: 0, correct: 0, solved: 0, streak: 0 };
  }
}

function saveStats() {
  localStorage.setItem("metricMindStats", JSON.stringify(state.stats));
  renderStats();
}

function renderStats() {
  const accuracy = state.stats.attempts ? Math.round((state.stats.correct / state.stats.attempts) * 100) : 0;
  $("#accuracy-value").textContent = state.stats.attempts ? `${accuracy}%` : "—";
  $("#solved-count").textContent = state.stats.solved;
  $("#streak-count").textContent = state.stats.streak;
  $("#progress-ring").style.setProperty("--progress", `${accuracy}%`);
}

function powerHTML(exp) {
  return `<span class="power">10<sup>${formatExponent(exp)}</sup></span>`;
}

function fractionHTML(top, bottom, placeholder = false) {
  return `<span class="fraction${placeholder ? " placeholder" : ""}"><span>${top}</span><span>${bottom}</span></span>`;
}

function renderTrain() {
  const p = state.problem;
  const firstReady = state.mode === "independent" || state.step >= 2;
  const secondReady = state.mode === "independent" || state.step >= 4;
  const resultReady = state.mode === "independent" ? false : state.step >= 6;
  const startFraction = fractionHTML(`${p.value} ${state.step >= 2 ? `<span class="cancelled">${p.start.symbol}</span>` : p.start.symbol}`, "1");
  const first = firstReady
    ? fractionHTML(`${powerHTML(p.start.exp)} g`, `1 <span class="cancelled">${p.start.symbol}</span>`)
    : fractionHTML("first conversion", "?", true);
  const second = secondReady
    ? fractionHTML(`1 ${p.target.symbol}`, `${powerHTML(p.target.exp)} <span class="cancelled">g</span>`)
    : fractionHTML("second conversion", "?", true);
  const result = resultReady
    ? `<span class="math-op">=</span>${p.value} × ${powerHTML(p.resultExp)} ${p.target.symbol}`
    : "";

  $("#unit-train").innerHTML = `${startFraction}<span class="math-op">×</span>${first}<span class="math-op">×</span>${second}${result}`;
}

function choiceButtons(options, formatter = String) {
  return options.map((value) => `<button class="choice-button${state.selected === value ? " selected" : ""}" data-choice="${value}">${formatter(value)}</button>`).join("");
}

function renderAnswerArea() {
  const area = $("#answer-area");
  const p = state.problem;
  if (state.mode === "independent") {
    area.innerHTML = `<div class="math-answer"><label class="answer-label">Coefficient <input class="answer-field" id="coefficient-input" inputmode="decimal" placeholder="1.194"></label><span>× 10</span><label class="answer-label">Exponent <input class="answer-field" id="exponent-input" inputmode="numeric" placeholder="−12"></label><strong>${p.target.symbol}</strong></div>`;
    return;
  }

  switch (state.step) {
    case 0: {
      const options = exponentOptions(p.start.exp);
      area.innerHTML = choiceButtons(options, (exp) => `1 ${p.start.symbol} = 10<sup>${formatExponent(exp)}</sup> g`);
      break;
    }
    case 1:
    case 3:
      area.innerHTML = choiceButtons(["top", "bottom"], (side) => `Put it on the ${side}`);
      break;
    case 2: {
      const options = exponentOptions(p.target.exp);
      area.innerHTML = choiceButtons(options, (exp) => `1 ${p.target.symbol} = 10<sup>${formatExponent(exp)}</sup> g`);
      break;
    }
    case 4:
      area.innerHTML = `<div class="math-answer"><span>${p.start.exp} − (${p.target.exp}) =</span><input class="answer-field" id="step-input" inputmode="numeric" aria-label="Resulting exponent"></div>`;
      break;
    case 5:
      area.innerHTML = `<div class="math-answer"><label class="answer-label">Coefficient <input class="answer-field" id="coefficient-input" inputmode="decimal" placeholder="number"></label><span>× 10</span><label class="answer-label">Exponent <input class="answer-field" id="exponent-input" inputmode="numeric" placeholder="power"></label><strong>${p.target.symbol}</strong></div>`;
      break;
    default:
      area.innerHTML = `<div class="solved-message"><strong>Problem complete.</strong> Choose “New problem” when you are ready.</div>`;
  }
}

function renderLesson() {
  const p = state.problem;
  $("#problem-prompt").textContent = `Convert ${p.value} ${p.start.symbol} into ${p.target.symbol}`;
  $("#magnitude-check").textContent = magnitudeCheck(p);
  $("#feedback").className = "feedback";
  $("#feedback").textContent = "";
  $("#help-button").textContent = "I’m lost — teach this step";

  if (state.mode === "independent") {
    $("#step-chip").textContent = "Independent practice";
    $("#step-number").textContent = "•";
    $("#step-label").textContent = "Solve the whole conversion";
    $("#step-question").textContent = `Enter your answer in ${p.target.symbol}.`;
    $("#step-explanation").textContent = "You can use the same two conversion fractions. Ask for help if you want the setup revealed.";
    $("#coach-title").textContent = "Your three checks";
    $("#coach-copy").textContent = "Did the starting unit cancel? Did grams cancel? Is the remaining unit the one requested? If all three answers are yes, your setup is facing the right direction.";
    $("#check-button").textContent = "Check final answer";
  } else if (state.step < stepContent.length) {
    const content = stepContent[state.step];
    $("#step-chip").textContent = `Step ${state.step + 1} of 6`;
    $("#step-number").textContent = state.step + 1;
    $("#step-label").textContent = content.label;
    $("#step-question").textContent = content.question(p);
    $("#step-explanation").textContent = content.explanation(p);
    $("#coach-title").textContent = content.coachTitle;
    $("#coach-copy").textContent = content.coachCopy;
    $("#check-button").textContent = state.step === 5 ? "Check final answer" : "Check this step";
  } else {
    $("#step-chip").textContent = "Solved";
    $("#step-number").textContent = "✓";
    $("#step-label").textContent = "You built the entire conversion";
    $("#step-question").textContent = `${p.value} ${p.start.symbol} = ${p.value} × 10${p.resultExp < 0 ? "⁻" : ""}${Math.abs(p.resultExp)} ${p.target.symbol}`;
    $("#step-explanation").textContent = `In ordinary decimal form: ${decimalFromScientific(p.value, p.resultExp)} ${p.target.symbol}.`;
    $("#coach-title").textContent = "The units did the steering";
    $("#coach-copy").textContent = "You did not guess whether to multiply or divide. You arranged the units so the unwanted ones canceled, and that arrangement determined the arithmetic.";
    $("#check-button").textContent = "Next problem";
    $("#help-button").style.visibility = "hidden";
  }

  if (state.step <= 5) $("#help-button").style.visibility = "visible";
  renderTrain();
  renderAnswerArea();
  bindChoices();
}

function bindChoices() {
  $$(".choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      const raw = button.dataset.choice;
      state.selected = /^-?\d+$/.test(raw) ? Number(raw) : raw;
      $$(".choice-button").forEach((item) => item.classList.toggle("selected", item === button));
    });
  });
}

function giveFeedback(message, type) {
  const feedback = $("#feedback");
  feedback.className = `feedback ${type}`;
  feedback.innerHTML = message;
}

function recordAttempt(correct, solved = false) {
  state.stats.attempts += 1;
  if (correct) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    if (solved) state.stats.solved += 1;
  } else {
    state.stats.streak = 0;
  }
  saveStats();
}

function checkGuided() {
  const p = state.problem;
  let correct = false;
  let wrongMessage = "Not quite. Ask for the teaching hint and we will slow this exact decision down.";

  if (state.step === 0) {
    correct = state.selected === p.start.exp;
    wrongMessage = `Look only at the prefix <strong>${p.start.prefix}</strong>. It has one fixed meaning everywhere: 10<sup>${formatExponent(p.start.exp)}</sup>.`;
  } else if (state.step === 1) {
    correct = state.selected === "bottom";
    wrongMessage = `${p.start.symbol} is already on top in the starting measurement. A second ${p.start.symbol} on top would not cancel it. Put the matching unit on the opposite side.`;
  } else if (state.step === 2) {
    correct = state.selected === p.target.exp;
    wrongMessage = `The prefix <strong>${p.target.prefix}</strong> always means 10<sup>${formatExponent(p.target.exp)}</sup>. This is a vocabulary fact, not a calculation yet.`;
  } else if (state.step === 3) {
    correct = state.selected === "bottom";
    wrongMessage = `Grams are on top after the first conversion. Put grams on the bottom of the next fraction so one top g cancels one bottom g.`;
  } else if (state.step === 4) {
    const input = Number($("#step-input")?.value);
    correct = input === p.resultExp;
    wrongMessage = `Write it literally: ${p.start.exp} − (${p.target.exp}). The second exponent is subtracted because it belongs to the denominator.`;
  } else if (state.step === 5) {
    const coefficient = $("#coefficient-input")?.value;
    const exponent = Number($("#exponent-input")?.value);
    correct = nearlyEqual(coefficient, p.value) && exponent === p.resultExp;
    if (nearlyEqual(coefficient, p.value) && exponent === -p.resultExp) {
      wrongMessage = `Your coefficient is right, but the exponent sign is reversed. ${magnitudeCheck(p)}`;
    } else {
      wrongMessage = `The coefficient remains ${p.value}. The exponent is the prefix calculation: ${p.start.exp} − (${p.target.exp}) = ${p.resultExp}.`;
    }
  }

  if (!correct) {
    recordAttempt(false);
    giveFeedback(wrongMessage, "error");
    return;
  }

  const solved = state.step === 5;
  recordAttempt(true, solved);
  giveFeedback(solved ? "Correct. Every unwanted unit canceled, and the requested unit survived." : "Correct. That decision is now locked into the setup.", "success");
  setTimeout(() => {
    state.step += 1;
    state.selected = null;
    state.hintLevel = 0;
    renderLesson();
  }, 550);
}

function checkIndependent() {
  const p = state.problem;
  const coefficient = $("#coefficient-input")?.value;
  const exponent = Number($("#exponent-input")?.value);
  const correct = nearlyEqual(coefficient, p.value) && exponent === p.resultExp;
  recordAttempt(correct, correct);
  if (correct) {
    giveFeedback(`Correct: ${p.value} × 10<sup>${formatExponent(p.resultExp)}</sup> ${p.target.symbol}. ${magnitudeCheck(p)}`, "success");
  } else {
    const signHint = exponent === -p.resultExp ? ` The exponent sign is reversed. ${magnitudeCheck(p)}` : "";
    giveFeedback(`Not yet.${signHint} Use “I’m lost” to reveal the conversion setup without losing the problem.`, "error");
  }
}

function showHint() {
  const p = state.problem;
  state.hintLevel += 1;
  let message = "";
  if (state.mode === "independent") {
    message = `Start here: <strong>${p.value} ${p.start.symbol} / 1</strong>. Then multiply by <strong>(10<sup>${formatExponent(p.start.exp)}</sup> g / 1 ${p.start.symbol})</strong> and <strong>(1 ${p.target.symbol} / 10<sup>${formatExponent(p.target.exp)}</sup> g)</strong>. The ${p.start.symbol} and g units cancel.`;
  } else {
    const hints = [
      [`The word “${p.start.prefix}” is the only clue you need. Find ${p.start.prefix} in the prefix reference.`, `Because ${p.start.prefix} means 10<sup>${formatExponent(p.start.exp)}</sup>, choose <strong>1 ${p.start.symbol} = 10<sup>${formatExponent(p.start.exp)}</sup> g</strong>.`],
      [`Point at ${p.start.symbol} in the starting measurement. It sits above the fraction bar. Matching units need opposite positions.`, `Choose <strong>bottom</strong>. Then the starting ${p.start.symbol} and the conversion fraction’s ${p.start.symbol} appear on opposite sides and cancel.`],
      [`Look up “${p.target.prefix}” in the prefix map. Its power never changes from problem to problem.`, `Because ${p.target.prefix} means 10<sup>${formatExponent(p.target.exp)}</sup>, choose <strong>1 ${p.target.symbol} = 10<sup>${formatExponent(p.target.exp)}</sup> g</strong>.`],
      [`At this point g is on top. Ask: “Where must another g go to be opposite?”`, `Choose <strong>bottom</strong>. That makes g cancel while ${p.target.symbol} stays on top.`],
      [`Copy the signs exactly before doing anything: ${p.start.exp} − (${p.target.exp}).`, `The answer is <strong>${p.resultExp}</strong>. You subtract the destination exponent: ${p.start.exp} − (${p.target.exp}) = ${p.resultExp}.`],
      [`The coefficient did not change; it is still ${p.value}. Use the exponent you found in the previous step.`, `Enter coefficient <strong>${p.value}</strong> and exponent <strong>${p.resultExp}</strong>. The complete answer is ${p.value} × 10<sup>${formatExponent(p.resultExp)}</sup> ${p.target.symbol}.`],
    ];
    message = hints[state.step][Math.min(state.hintLevel - 1, 1)];
  }
  giveFeedback(message, "hint");
  if (state.hintLevel === 1 && state.mode === "guided") $("#help-button").textContent = "I need the full answer to this step";
}

function newProblem() {
  state.problem = generateConversion(state.difficulty, state.mode === "guided");
  state.step = 0;
  state.selected = null;
  state.hintLevel = 0;
  renderLesson();
}

function renderNotation() {
  const n = state.notation;
  state.notationHint = false;
  $("#notation-feedback").className = "feedback";
  $("#notation-feedback").textContent = "";
  $("#decimal-track").textContent = "Ask for help to see which direction the decimal moves.";
  if (n.direction === "toStandard") {
    $("#notation-prompt").innerHTML = `Write ${n.coefficient} × 10<sup>${formatExponent(n.exponent)}</sup> in standard form.`;
    $("#notation-answer").innerHTML = `<label class="answer-label">Standard number <input class="answer-field" id="notation-standard" inputmode="decimal" placeholder="type the number"></label>`;
  } else {
    $("#notation-prompt").textContent = `Write ${n.standard} in scientific notation.`;
    $("#notation-answer").innerHTML = `<div class="math-answer"><label class="answer-label">Coefficient <input class="answer-field" id="notation-coefficient" inputmode="decimal"></label><span>× 10</span><label class="answer-label">Exponent <input class="answer-field" id="notation-exponent" inputmode="numeric"></label></div>`;
  }
}

function checkNotation() {
  const n = state.notation;
  let correct;
  if (n.direction === "toStandard") {
    correct = nearlyEqual($("#notation-standard")?.value, n.standard);
  } else {
    correct = nearlyEqual($("#notation-coefficient")?.value, n.coefficient) && Number($("#notation-exponent")?.value) === n.exponent;
  }
  recordAttempt(correct, correct);
  const feedback = $("#notation-feedback");
  feedback.className = `feedback ${correct ? "success" : "error"}`;
  feedback.innerHTML = correct
    ? `Correct. ${n.coefficient} × 10<sup>${formatExponent(n.exponent)}</sup> = ${n.standard}.`
    : `Not yet. The decimal moves ${Math.abs(n.exponent)} places ${n.exponent > 0 ? "right" : "left"}. Use the movement button to see why.`;
}

function showNotationHelp() {
  const n = state.notation;
  state.notationHint = true;
  $("#decimal-track").innerHTML = `<div><strong>${n.exponent > 0 ? "Positive" : "Negative"} exponent:</strong> start at the decimal in ${n.coefficient}. Move it <strong>${Math.abs(n.exponent)} places ${n.exponent > 0 ? "right" : "left"}</strong>. Fill empty places with zeros.<br>Result: <strong>${n.standard}</strong></div>`;
}

function renderReference() {
  $("#prefix-scale").innerHTML = PREFIXES.map((item) => `<div class="prefix-tile${item.exp === 0 ? " base" : ""}"><strong>${item.symbol}</strong><span>${item.name}</span><small>10<sup>${formatExponent(item.exp)}</sup> g</small></div>`).join("");
}

function switchView(view) {
  state.view = view;
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  const titles = { conversion: "Unit conversions", notation: "Scientific notation", reference: "Prefix reference" };
  $("#page-title").textContent = titles[view];
}

function currentInstruction() {
  if (state.view === "conversion") return `${$("#step-question").textContent}. ${$("#step-explanation").textContent}`;
  if (state.view === "notation") return $("#notation-prompt").textContent;
  return "The metric prefix map. Every prefix represents a fixed power of ten attached to grams.";
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    $$("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
    newProblem();
  }));
  $("#difficulty-select").addEventListener("change", (event) => { state.difficulty = event.target.value; newProblem(); });
  $("#new-problem").addEventListener("click", newProblem);
  $("#check-button").addEventListener("click", () => {
    if (state.mode === "guided" && state.step > 5) return newProblem();
    state.mode === "guided" ? checkGuided() : checkIndependent();
  });
  $("#help-button").addEventListener("click", showHint);
  $("#new-notation").addEventListener("click", () => { state.notation = generateNotation(); renderNotation(); });
  $("#notation-check").addEventListener("click", checkNotation);
  $("#notation-help").addEventListener("click", showNotationHelp);
  $("#reset-progress").addEventListener("click", () => {
    state.stats = { attempts: 0, correct: 0, solved: 0, streak: 0 };
    saveStats();
  });
  $("#read-button").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(currentInstruction()));
  });
}

renderStats();
renderReference();
renderLesson();
renderNotation();
bindEvents();
