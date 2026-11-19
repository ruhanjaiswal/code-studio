const htmlDefault = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Website</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #111827, #312e81);
      color: white;
      font-family: system-ui, sans-serif;
    }
    .card {
      text-align: center;
      padding: 48px;
      border-radius: 20px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.15);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello, World!</h1>
    <p>Edit this HTML and watch the preview update.</p>
  </div>
</body>
</html>`;

const cDefault = `#include <stdio.h>

int main(void) {
    char name[50];

    printf("What is your name? ");
    scanf("%49s", name);
    printf("Hello, %s! Welcome to C.\\n", name);

    return 0;
}`;

const editor = document.querySelector("#codeEditor");
const preview = document.querySelector("#preview");
const runButton = document.querySelector("#runButton");
const runLabel = document.querySelector("#runLabel");
const terminal = document.querySelector("#terminal");
const terminalOutput = document.querySelector("#terminalOutput");
const exitCode = document.querySelector("#exitCode");
const stdinInput = document.querySelector("#stdinInput");
let language = "html";
let previewTimer;

const drafts = {
  html: localStorage.getItem("code-studio-html") ?? htmlDefault,
  c: localStorage.getItem("code-studio-c") ?? cDefault
};

function refreshPreview() {
  if (language !== "html") return;
  preview.srcdoc = editor.value;
  preview.hidden = false;
  terminal.hidden = true;
}

function saveDraft() {
  localStorage.setItem(`code-studio-${language}`, editor.value);
  const lines = editor.value.split("\n").length;
  const cursor = editor.selectionStart;
  const before = editor.value.slice(0, cursor);
  const column = cursor - before.lastIndexOf("\n");
  document.querySelector("#documentStats").textContent =
    `Ln ${before.split("\n").length}, Col ${column} | ${editor.value.length} chars`;
  document.querySelector("#statusText").textContent = "Saved";
}

function setLanguage(next) {
  drafts[language] = editor.value;
  language = next;
  editor.value = drafts[language];
  document.querySelectorAll(".language").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === language);
  });

  const isHtml = language === "html";
  document.querySelector("#fileName").textContent = isHtml ? "index.html" : "main.c";
  document.querySelector("#tabIcon").textContent = isHtml ? "#" : "C";
  document.querySelector("#previewTitle").textContent = isHtml ? "Live Preview" : "Terminal";
  runLabel.textContent = isHtml ? "Run" : "Compile";

  if (isHtml) {
    refreshPreview();
  } else {
    preview.hidden = true;
    terminal.hidden = false;
  }
  saveDraft();
  editor.focus();
}

editor.addEventListener("input", () => {
  saveDraft();
  if (language === "html") {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 250);
  }
});

editor.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText("  ", start, end, "end");
    editor.dispatchEvent(new Event("input"));
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runCode();
});

document.querySelectorAll(".language").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});

async function runCode() {
  if (language === "html") {
    refreshPreview();
    document.querySelector("#statusText").textContent = "Preview refreshed";
    return;
  }

  runButton.disabled = true;
  runLabel.textContent = "Running";
  document.querySelector("#statusText").textContent = "Compiling...";
  terminal.hidden = false;
  preview.hidden = true;
  terminalOutput.textContent = "Compiling and running...";
  exitCode.textContent = "";

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: editor.value, input: stdinInput.value })
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "C compilation requires the Node server. GitHub Pages can host HTML, but cannot run gcc. Deploy this repository to Render or Fly.io."
      );
    }
    const result = await response.json();
    terminalOutput.textContent = result.output || result.error || "(No output)";
    exitCode.textContent = result.exitCode === undefined ? "failed" : `exit ${result.exitCode}`;
    document.querySelector("#statusText").textContent =
      response.ok ? "Process finished" : "Compilation failed";
  } catch (error) {
    terminalOutput.textContent = `Could not reach the compiler server.\n${error.message}`;
    exitCode.textContent = "failed";
  } finally {
    runButton.disabled = false;
    runLabel.textContent = "Compile";
  }
}

runButton.addEventListener("click", runCode);
document.querySelector("#refreshPreview").addEventListener("click", refreshPreview);
document.querySelector("#openPreview").addEventListener("click", () => {
  const blob = new Blob([editor.value], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank", "noopener");
});
document.querySelector("#resetButton").addEventListener("click", () => {
  if (!window.confirm(`Reset ${language.toUpperCase()} code?`)) return;
  editor.value = language === "html" ? htmlDefault : cDefault;
  drafts[language] = editor.value;
  saveDraft();
  if (language === "html") refreshPreview();
});

editor.value = drafts.html;
saveDraft();
refreshPreview();
