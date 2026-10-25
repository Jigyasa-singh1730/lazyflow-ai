
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.allowRemoteModels = true;

const MODEL_ID = "Xenova/flan-t5-small";

let generator = null;
let isGenerating = false;

const $ = (id) => document.getElementById(id);

const input = $("userInput");
const generateButton = $("generateButton");
const status = $("aiStatus");
const statusText = $("statusText");
const resultSection = $("resultSection");
const resultOutput = $("resultOutput");
const copyButton = $("copyButton");

const tools = {
  planner: {
    title: "Let's tame those tasks!",
    emoji: "🪄",
    description: "Drop your thoughts here. We'll figure it out together.",
    label: "YOUR BRAIN DUMP",
    hint: "Write whatever is on your mind. No organizing needed!",
    placeholder:
      "Example: finish my assignment, revise C programming, email my teacher, and prepare for tomorrow...",
    prompt: (text, style) =>
      `Organize these tasks into a practical numbered to-do list. ` +
      `Put important tasks first. Use short, clear steps. ` +
      `Do not invent deadlines. Style: ${style}. Tasks: ${text}`
  },

  email: {
    title: "Let's write a lovely email!",
    emoji: "💌",
    description: "Turn your rough notes into a polished email draft.",
    label: "YOUR EMAIL NOTES",
    hint: "Mention the recipient and purpose if you know them.",
    placeholder:
      "Example: email my teacher to request an extra day for my assignment...",
    prompt: (text, style) =>
      `Write a polite email using only these notes. Include a subject, ` +
      `greeting and message. Do not invent names, dates or promises. ` +
      `Style: ${style}. Notes: ${text}`
  },

  summary: {
    title: "Let's keep things simple!",
    emoji: "🍃",
    description: "Get the main ideas without reading everything.",
    label: "TEXT TO SUMMARIZE",
    hint: "Paste an article, passage, or your class notes.",
    placeholder:
      "Paste your text here to create a short and simple summary...",
    prompt: (text, style) =>
      `Summarize the following text using its main ideas and key facts. ` +
      `Use simple language. Do not add facts not present in the text. ` +
      `Style: ${style}. Text: ${text}`
  },

  study: {
    title: "Your study buddy is here!",
    emoji: "🧸",
    description: "Make your revision notes easier to understand.",
    label: "YOUR STUDY MATERIAL",
    hint: "Paste a topic, chapter extract, or class notes.",
    placeholder:
      "Example: explain photosynthesis in simple language with key points...",
    prompt: (text, style) =>
      `Create concise revision notes from this study material. ` +
      `Explain key terms in simple language and list important facts. ` +
      `Do not invent information. Style: ${style}. Material: ${text}`
  }
};

let currentView = "planner";

function setStatus(message, type = "normal") {
  statusText.textContent = message;
  status.classList.remove("loading", "error");

  if (type === "loading") status.classList.add("loading");
  if (type === "error") status.classList.add("error");
}

function selectTool(view) {
  const tool = tools[view];
  if (!tool) return;

  currentView = view;

  $("toolHeading").textContent = `${tool.title} ${tool.emoji}`;
  $("toolDescription").textContent = tool.description;
  $("inputLabel").textContent = tool.label;
  $("inputHint").textContent = tool.hint;
  input.placeholder = tool.placeholder;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle(
      "selected",
      button.dataset.view === view &&
      button.classList.contains("tool-card")
    );

    if (button.classList.contains("tool-card")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === view)
      );
    }
  });

  resultSection.hidden = true;
  setStatus("Ready when you are. Let's make life easier!");
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    selectTool(button.dataset.view);
    $("workspace").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

input.addEventListener("input", () => {
  $("charCount").textContent = `${input.value.length} / 5000`;
});

async function loadModel() {
  if (generator) return generator;

  setStatus(
    "Getting your AI ready! The first download may take a few minutes.",
    "loading"
  );

  generator = await pipeline(
    "text2text-generation",
    MODEL_ID,
    {
      progress_callback: (progress) => {
        if (
          progress.status === "progress" &&
          Number.isFinite(progress.progress)
        ) {
          setStatus(
            `Downloading the AI model: ${Math.round(progress.progress)}%`,
            "loading"
          );
        } else if (progress.status === "downloading") {
          setStatus("Downloading AI model files...", "loading");
        }
      }
    }
  );

  return generator;
}

function getStyle() {
  const selected = $("styleOption").value;

  const styles = {
    simple: "simple and clear",
    detailed: "detailed but organized",
    friendly: "friendly and conversational"
  };

  return styles[selected] || styles.simple;
}

async function generateResult() {
  if (isGenerating) return;

  const text = input.value.trim();

  if (!text) {
    setStatus("Add a little text first, and your AI buddy will help!", "error");
    input.focus();
    return;
  }

  if (text.length > 5000) {
    setStatus("Please keep your input within 5,000 characters.", "error");
    return;
  }

  isGenerating = true;
  generateButton.disabled = true;
  generateButton.innerHTML = "<span>⏳</span> Working on it...";
  resultSection.hidden = true;

  try {
    const ai = await loadModel();
    const tool = tools[currentView];

    setStatus(
      "Your browser is generating your result. A little patience!",
      "loading"
    );

    const output = await ai(tool.prompt(text, getStyle()), {
      max_new_tokens: 180,
      do_sample: false,
      repetition_penalty: 1.1
    });

    const answer = output?.[0]?.generated_text?.trim();

    if (!answer) {
      throw new Error("The AI returned an empty result.");
    }

    resultOutput.textContent = answer;
    resultSection.hidden = false;

    setStatus("Ta-da! Your result is ready. Give it a quick check.");

    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  } catch (error) {
    console.error("LazyFlow AI error:", error);
    generator = null;

    setStatus(
      "Oops! The AI could not load or generate a result. Check your internet connection and browser console, then try again.",
      "error"
    );
  } finally {
    isGenerating = false;
    generateButton.disabled = false;
    generateButton.innerHTML =
      "<span>✨</span> Make the magic happen!";
  }
}

generateButton.addEventListener("click", generateResult);

copyButton.addEventListener("click", async () => {
  const text = resultOutput.textContent;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }

    await navigator.clipboard.writeText(text);
    copyButton.textContent = "Copied! ✓";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(resultOutput);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    setStatus("Text selected! Press Ctrl+C to copy your result.");
  }

  setTimeout(() => {
    copyButton.textContent = "Copy result ↗";
  }, 2000);
});

// Initialize the default tool.
selectTool("planner");

console.info("LazyFlow AI is ready to help you work less and smile more!");
