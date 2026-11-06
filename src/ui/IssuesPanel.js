/**
 * IssuesPanel.js - Plain-Language "Circuit Issues" Diagnostics Drawer
 */

export class IssuesPanel {
  constructor(containerElement, stateManager) {
    this.container = containerElement;
    this.state = stateManager;
    this.isOpen = false;
    this.currentIssues = [];

    this.render();

    this.state.onIssues((issues) => {
      this.currentIssues = issues;
      this.updateContent();
    });

    document.getElementById('btn-toggle-issues')?.addEventListener('click', () => {
      this.toggle();
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle('open', this.isOpen);
  }

  render() {
    this.container.className = 'issues-drawer';
    this.container.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          Circuit Diagnostics & Verification
        </div>
        <button id="btn-close-issues" class="drawer-close" title="Close Panel">✕</button>
      </div>
      <div class="drawer-body" id="issues-list"></div>
    `;

    document.getElementById('btn-close-issues')?.addEventListener('click', () => {
      this.toggle();
    });

    this.updateContent();
  }

  updateContent() {
    const list = this.container.querySelector('#issues-list');
    if (!list) return;

    if (this.currentIssues.length === 0) {
      list.innerHTML = `
        <div class="issues-clean">
          <div class="clean-icon">✓</div>
          <h4>All Clear! No Circuit Faults Detected</h4>
          <p>Power rails, polarity, IC pins, and jumper wires are verified. Ready for live simulation!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this.currentIssues
      .map(
        (issue) => `
        <div class="issue-card ${issue.type}">
          <div class="issue-title-bar">
            <span class="issue-badge ${issue.type}">${issue.type.toUpperCase()}</span>
            <strong class="issue-name">${issue.title}</strong>
          </div>
          <div class="issue-msg">${issue.message}</div>
        </div>
      `
      )
      .join('');
  }
}

