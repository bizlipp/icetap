// reportUI.js
// UI tools for report export, copy, and print preview

export function createCopyButton(content, label = "Copy Report") {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'primary-button';
  btn.onclick = () => {
    navigator.clipboard.writeText(content).then(() => {
      alert("Copied to clipboard!");
    });
  };
  return btn;
}
